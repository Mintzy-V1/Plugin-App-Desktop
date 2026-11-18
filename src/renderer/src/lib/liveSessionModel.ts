import {
  parsePyramidPnlBySymbol,
  parsePyramidPriceBySymbol,
  extractSimClosePricesFromHistory,
  mergePyramidMaps,
  isSimClosePriceWindow,
  isSimCloseIstLog,
  isLastMorningSimIstLog,
  isSessionSquareOffIstLog,
  istWallClockMs,
} from './pyramidPnl';
import {
  sessionStatusLabel,
  resolveSessionStatus,
  isLiveSessionStatus,
  isTerminalSessionStatus,
  isConfigurableSessionStatus,
  isSimulationRunningStatus,
  simulationStatusLabel,
  simulationStatusBadgeClass,
} from './sessionStatus';
import { formatTradeLabel, isWaitAction } from './tradeSignals';
import {
  isLockedOutRecord,
  lockMessageFor,
  lockReasonText,
  parseLockedOutSymbols,
  resolveLockedOut,
  type LockedOutSymbol,
} from './lockedOut';
import {
  parseExitedSymbols,
  rmsHitInWindow,
  exitedSymbolPnl,
  exitedSymbolTimeRaw,
  isManualSymbolExit,
  type ExitedSymbol,
} from './exitedSymbols';
import type { TradingSession } from './pluginApi';

export interface TradeLogRow {
  time: string;
  /** Epoch ms for comparing against simulation_live_started_at; null if unparseable. */
  timeMs: number | null;
  /** Wall-clock when the row was logged, if the engine sent `logged_at`; else timeMs. */
  chartTimeMs: number | null;
  symbol: string;
  signal: string;
  action: string;
  quantity: string | number;
  price: string | number;
  change: string | number;
  pnl: string | number;
  capital: string | number;
  return_pct: string | number;
  /** `simulation_logs` from the trading-logs record; null when the field is absent (pre-field logs). */
  simulation: boolean | null;
  /** Engine RMS / risk exit — often missing from the native trade log. */
  rmsHit?: boolean;
  rmsReason?: string;
  /** Client pressed Exit on this symbol. The system did not auto-exit it. */
  manualExit?: boolean;
  /** EXP104: the engine locked this stock at 13:00 and will not trade it again today. */
  lockedOut?: boolean;
  lockReason?: string;
  lockMessage?: string;
}

/** Engine logs often use naive IST wall times (`YYYY-MM-DD HH:mm:ss`). */
export function parseTradeTimeMs(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw <= 0) return null;
    return raw < 1e12 ? Math.round(raw * 1000) : Math.round(raw);
  }
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    return parseTradeTimeMs(o.$date ?? o.$numberLong ?? o.$numberInt);
  }
  const s = String(raw).trim();
  if (!s) return null;
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    const ms = Date.parse(s);
    return Number.isNaN(ms) ? null : ms;
  }
  const normalized = s.includes('T') ? s : s.replace(' ', 'T');
  const ms = Date.parse(`${normalized}+05:30`);
  if (!Number.isNaN(ms)) return ms;
  const fallback = Date.parse(normalized);
  return Number.isNaN(fallback) ? null : fallback;
}

export function parseInstantMs(raw: unknown): number | null {
  return parseTradeTimeMs(raw);
}

export function pickStatus(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const nested = obj.status;
    if (typeof nested === 'string') return nested;
    if (nested && typeof nested === 'object' && typeof (nested as Record<string, unknown>).status === 'string') {
      return (nested as Record<string, unknown>).status as string;
    }
  }
  return null;
}

export const QTY_KEYS = [
  'net_qty', 'NetQty', 'netqty', 'position_qty',
  'Quantity', 'quantity', 'QTY', 'Qty', 'qty',
];

export function unwrapQuantity(value: unknown): string | number | null {
  if (value == null || value === '' || value === '-') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '-') return null;
    const n = Number(trimmed.replace(/,/g, ''));
    return Number.isFinite(n) ? n : trimmed;
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (o.$numberInt != null) return unwrapQuantity(o.$numberInt);
    if (o.$numberDouble != null) return unwrapQuantity(o.$numberDouble);
    if (o.$numberLong != null) return unwrapQuantity(o.$numberLong);
    for (const key of QTY_KEYS) {
      if (key in o) {
        const nested = unwrapQuantity(o[key]);
        if (nested != null) return nested;
      }
    }
  }
  return null;
}

export function pickQuantity(r: Record<string, unknown> | null | undefined): string | number {
  if (!r) return '-';
  for (const key of QTY_KEYS) {
    const v = unwrapQuantity(r[key]);
    if (v != null) return v;
  }
  return '-';
}

export function isPlaceholderValue(v: unknown): boolean {
  return v == null || v === '' || v === '-' || v === '—' || v === '--';
}

export function numOrNull(v: unknown): number | null {
  if (v == null || v === '' || v === '-') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function isNumericZero(v: unknown): boolean {
  return numOrNull(v) === 0;
}

/** Realized + unrealized when both exist. A flat book writes P&L=0; realized still holds the exit profit. */
export function readSymbolNetPnl(row: Record<string, unknown> | null | undefined): number | null {
  if (!row) return null;
  const realized = numOrNull(
    row.symbol_realized_pnl ?? row.realized_pnl ?? row.portfolio_realized_pnl,
  );
  const unrealized = numOrNull(
    row.symbol_unrealized_pnl
    ?? row.unrealized_pnl
    ?? row.live_unrealized_pnl
    ?? row.portfolio_unrealized_pnl,
  );
  if (realized != null && unrealized != null) return realized + unrealized;
  const marked = numOrNull(
    row.final_pnl ?? row.symbol_pnl ?? row.total_pnl ?? row['P&L'] ?? row.PnL ?? row.pnl,
  );
  if (realized != null && realized !== 0) return realized;
  if (unrealized != null && unrealized !== 0) return unrealized;
  if (marked != null && marked !== 0) return marked;
  if (realized != null) return realized;
  if (unrealized != null) return unrealized;
  if (marked != null) return marked;
  return null;
}

export function pickRowPnl(r: Record<string, unknown>): string | number {
  const net = readSymbolNetPnl(r);
  return net != null ? net : '-';
}

export function hasQuantity(v: string | number | null | undefined): boolean {
  return v != null && v !== '' && v !== '-';
}

/** Live-pnl often reports 0 after sim→live or when a position is flat. Never treat that as a fill. */
export function isPositiveQty(v: string | number | null | undefined): boolean {
  if (!hasQuantity(v)) return false;
  const n = Number(v);
  return Number.isFinite(n) ? n !== 0 : true;
}

/** A logged 0 is a flat position. Do not replace it with an older or cumulative size. */
export function hasExplicitQty(v: string | number | null | undefined): boolean {
  return isPositiveQty(v) || isNumericZero(v);
}

export function applySymbolQuantities(
  logs: TradeLogRow[],
  symbols: Record<string, unknown> | null | undefined,
): TradeLogRow[] {
  if (!symbols || typeof symbols !== 'object') return logs;
  const bySym = new Map<string, string | number>();
  for (const [sym, data] of Object.entries(symbols)) {
    const qty = pickQuantity(
      data && typeof data === 'object' ? data as Record<string, unknown> : null,
    );
    if (isPositiveQty(qty)) bySym.set(sym.toUpperCase(), qty);
  }
  if (bySym.size === 0) return logs;
  return logs.map((row) => {
    if (hasExplicitQty(row.quantity) || isWaitAction(row.action) || isWaitAction(row.signal)) return row;
    const qty = bySym.get(String(row.symbol).toUpperCase());
    return qty != null ? { ...row, quantity: qty } : row;
  });
}

export function mergeLogQuantities(primary: TradeLogRow[], ...fallbacks: TradeLogRow[][]): TradeLogRow[] {
  if (primary.length === 0) return fallbacks.find((rows) => rows.length > 0) ?? [];
  const byKey = new Map<string, string | number>();
  for (const rows of [...fallbacks, primary]) {
    for (const row of rows) {
      if (!isPositiveQty(row.quantity)) continue;
      const key = `${row.timeMs ?? row.time}|${String(row.symbol).toUpperCase()}`;
      byKey.set(key, row.quantity);
    }
  }
  if (byKey.size === 0) return primary;
  return primary.map((row) => {
    if (hasExplicitQty(row.quantity) || isWaitAction(row.action) || isWaitAction(row.signal)) return row;
    const qty = byKey.get(`${row.timeMs ?? row.time}|${String(row.symbol).toUpperCase()}`);
    return qty != null ? { ...row, quantity: qty } : row;
  });
}

export function pickLivePnlSymbols(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.symbols && typeof o.symbols === 'object' && !Array.isArray(o.symbols)) {
    return o.symbols as Record<string, unknown>;
  }
  if (Array.isArray(o.symbols)) {
    const mapped: Record<string, unknown> = {};
    for (const item of o.symbols) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const sym = String(row.symbol ?? row.Symbol ?? '').toUpperCase();
      if (sym) mapped[sym] = row;
    }
    return Object.keys(mapped).length ? mapped : null;
  }
  if (o.data && typeof o.data === 'object') return pickLivePnlSymbols(o.data);
  return null;
}

/** LTP/mark from a live-pnl payload — used only while still in simulation. */
export function pricesFromLivePnl(raw: unknown): Record<string, number> {
  const symbols = pickLivePnlSymbols(raw);
  if (!symbols) return {};
  const out: Record<string, number> = {};
  for (const [sym, data] of Object.entries(symbols)) {
    const row = data && typeof data === 'object' ? data as Record<string, unknown> : null;
    if (!row) continue;
    const n = numOrNull(
      row.ltp
      ?? row.LTP
      ?? row.last_traded_price
      ?? row.last_price
      ?? row.curr_price
      ?? row.mark_price
      ?? row.close_price
      ?? row.last
      ?? (row.tick && typeof row.tick === 'object' ? (row.tick as Record<string, unknown>).ltp : undefined)
      ?? (row.quote && typeof row.quote === 'object' ? (row.quote as Record<string, unknown>).ltp : undefined),
    );
    if (n != null && n !== 0) out[sym.toUpperCase()] = n;
  }
  return out;
}

export interface QtySample {
  ts: number;
  bySym: Map<string, string | number>;
}

export function qtyMapFromSymbols(raw: unknown): Map<string, string | number> {
  const bySym = new Map<string, string | number>();
  const symbols = pickLivePnlSymbols(raw);
  if (!symbols) return bySym;
  for (const [sym, data] of Object.entries(symbols)) {
    const qty = pickQuantity(
      data && typeof data === 'object' ? data as Record<string, unknown> : null,
    );
    if (isPositiveQty(qty)) bySym.set(sym.toUpperCase(), qty);
  }
  return bySym;
}

/** Time-ordered qty samples from `/trading/live-pnl/:id/history`. */
export function buildQtyTimeline(raw: unknown): QtySample[] {
  let snapshots: unknown[] = [];
  if (Array.isArray(raw)) snapshots = raw;
  else if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.snapshots)) snapshots = o.snapshots;
    else if (o.data && typeof o.data === 'object' && Array.isArray((o.data as Record<string, unknown>).snapshots)) {
      snapshots = (o.data as Record<string, unknown>).snapshots as unknown[];
    }
  }

  const samples: QtySample[] = [];
  for (const item of snapshots) {
    if (!item || typeof item !== 'object') continue;
    const snap = item as Record<string, unknown>;
    const ts = parseInstantMs(snap.sampled_at)
      ?? parseInstantMs(snap.source_ts)
      ?? parseInstantMs((snap.data as Record<string, unknown> | undefined)?.ts);
    if (ts == null) continue;
    const bySym = qtyMapFromSymbols(snap.data ?? snap);
    if (bySym.size === 0) continue;
    samples.push({ ts, bySym });
  }
  samples.sort((a, b) => a.ts - b.ts);
  return samples;
}

export function qtyAsOf(timeline: QtySample[], symbol: string, timeMs: number | null): string | number | null {
  if (timeline.length === 0) return null;
  const key = symbol.toUpperCase();
  let last: string | number | null = null;
  for (const sample of timeline) {
    if (timeMs != null && sample.ts > timeMs) break;
    const q = sample.bySym.get(key);
    if (q != null && isPositiveQty(q)) last = q;
  }
  if (last != null) return last;
  return null;
}

export function applyHistoryQuantities(logs: TradeLogRow[], timeline: QtySample[]): TradeLogRow[] {
  if (timeline.length === 0) return logs;
  return logs.map((row) => {
    if (hasExplicitQty(row.quantity) || isWaitAction(row.action) || isWaitAction(row.signal)) return row;
    const qty = qtyAsOf(timeline, String(row.symbol), row.timeMs);
    return qty != null ? { ...row, quantity: qty } : row;
  });
}

export interface PnlSample {
  ts: number;
  bySym: Map<string, number>;
}

export function pnlMapFromSymbols(raw: unknown): Map<string, number> {
  const bySym = new Map<string, number>();
  const symbols = pickLivePnlSymbols(raw);
  if (!symbols) return bySym;
  for (const [sym, data] of Object.entries(symbols)) {
    const pnl = readSymbolNetPnl(
      data && typeof data === 'object' ? data as Record<string, unknown> : null,
    );
    if (pnl != null && pnl !== 0) bySym.set(sym.toUpperCase(), pnl);
  }
  return bySym;
}

export function buildPnlTimeline(raw: unknown): PnlSample[] {
  let snapshots: unknown[] = [];
  if (Array.isArray(raw)) snapshots = raw;
  else if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.snapshots)) snapshots = o.snapshots;
    else if (o.data && typeof o.data === 'object' && Array.isArray((o.data as Record<string, unknown>).snapshots)) {
      snapshots = (o.data as Record<string, unknown>).snapshots as unknown[];
    }
  }

  const samples: PnlSample[] = [];
  for (const item of snapshots) {
    if (!item || typeof item !== 'object') continue;
    const snap = item as Record<string, unknown>;
    const ts = parseInstantMs(snap.sampled_at)
      ?? parseInstantMs(snap.source_ts)
      ?? parseInstantMs((snap.data as Record<string, unknown> | undefined)?.ts);
    if (ts == null) continue;
    const bySym = pnlMapFromSymbols(snap.data ?? snap);
    if (bySym.size === 0) continue;
    samples.push({ ts, bySym });
  }
  samples.sort((a, b) => a.ts - b.ts);
  return samples;
}

export function pnlAsOf(
  timeline: PnlSample[],
  symbol: string,
  timeMs: number | null,
  notBeforeMs: number | null = null,
): number | null {
  if (timeline.length === 0) return null;
  const key = symbol.toUpperCase();
  let last: number | null = null;
  for (const sample of timeline) {
    if (notBeforeMs != null && sample.ts < notBeforeMs) continue;
    if (timeMs != null && sample.ts > timeMs + 15_000) break;
    const v = sample.bySym.get(key);
    if (v != null && v !== 0) last = v;
  }
  return last;
}

export function applyHistoryPnl(
  logs: TradeLogRow[],
  timeline: PnlSample[],
  liveAt: number | null = null,
): TradeLogRow[] {
  if (timeline.length === 0) return logs;
  return logs.map((row) => {
    if (!isPlaceholderValue(row.pnl)) return row;
    const rowIsLive = liveAt != null && row.timeMs != null && row.timeMs >= liveAt;
    const pnl = pnlAsOf(timeline, String(row.symbol), row.timeMs, rowIsLive ? liveAt : null);
    return pnl != null && pnl !== 0 ? { ...row, pnl } : row;
  });
}

export function logRowKey(row: TradeLogRow): string {
  return `${row.timeMs ?? row.time}|${String(row.symbol).toUpperCase()}`;
}

export function scoreLogRow(row: TradeLogRow): number {
  let score = 0;
  for (const v of [row.quantity, row.price, row.pnl, row.capital, row.change, row.signal, row.action]) {
    if (!isPlaceholderValue(v)) score += 1;
    if (isPositiveQty(v as string | number)) score += 1;
  }
  return score;
}

export function scoreLogs(rows: TradeLogRow[]): number {
  return rows.reduce((n, row) => n + scoreLogRow(row), 0) + rows.length;
}

export function fillMissingLogFields(row: TradeLogRow, fallback?: TradeLogRow | null): TradeLogRow {
  if (!fallback) return row;
  const next = { ...row };
  if (!next.lockedOut && fallback.lockedOut) {
    next.lockedOut = true;
    next.lockReason = fallback.lockReason;
    next.lockMessage = fallback.lockMessage;
  }
  const keys: Array<keyof TradeLogRow> = [
    'quantity', 'price', 'change', 'pnl', 'capital', 'return_pct', 'signal', 'action',
  ];
  for (const key of keys) {
    const cur = next[key];
    const prev = fallback[key];
    if (key === 'pnl') {
      if (isPlaceholderValue(cur) && !isPlaceholderValue(prev)) {
        next.pnl = prev as TradeLogRow['pnl'];
      }
      continue;
    }
    if (isPlaceholderValue(cur) && !isPlaceholderValue(prev)) {
      (next as TradeLogRow)[key] = prev as never;
    }
  }
  if (
    !isWaitAction(next.action) &&
    !isWaitAction(next.signal) &&
    !hasExplicitQty(next.quantity) &&
    isPositiveQty(fallback.quantity)
  ) {
    next.quantity = fallback.quantity;
  }
  if (next.chartTimeMs == null && fallback.chartTimeMs != null) next.chartTimeMs = fallback.chartTimeMs;
  if (next.timeMs == null && fallback.timeMs != null) next.timeMs = fallback.timeMs;
  return next;
}

export function carryForwardQuantities(logs: TradeLogRow[]): TradeLogRow[] {
  const indexed = logs.map((row, i) => ({ row, i }));
  indexed.sort((a, b) => (a.row.timeMs ?? 0) - (b.row.timeMs ?? 0));
  const lastBySym = new Map<string, string | number>();
  const updated = new Map<number, TradeLogRow>();
  for (const { row, i } of indexed) {
    const key = String(row.symbol).toUpperCase();
    if (isPositiveQty(row.quantity)) {
      lastBySym.set(key, row.quantity);
      updated.set(i, row);
      continue;
    }
    if (isNumericZero(row.quantity) || isWaitAction(row.action) || isWaitAction(row.signal)) {
      if (isNumericZero(row.quantity)) lastBySym.delete(key);
      updated.set(i, row);
      continue;
    }
    const last = lastBySym.get(key);
    updated.set(i, last != null ? { ...row, quantity: last } : row);
  }
  return logs.map((row, i) => updated.get(i) ?? row);
}

export function mergeIncomingLogs(
  fromPlugin: TradeLogRow[],
  fromTrades: TradeLogRow[],
  fromDash: TradeLogRow[],
  previous: TradeLogRow[],
  timeline: QtySample[],
  snapSymbols: Record<string, unknown> | null,
  liveSymbols: Record<string, unknown> | null,
  pnlTimeline: PnlSample[] = [],
  liveAt: number | null = null,
): TradeLogRow[] {
  const sources = [fromPlugin, fromTrades, fromDash].filter((rows) => rows.length > 0);
  if (sources.length === 0) return previous;

  const primary = sources.reduce((best, cur) => {
    const bestScore = scoreLogs(best);
    const curScore = scoreLogs(cur);
    if (curScore !== bestScore) return curScore > bestScore ? cur : best;
    return cur.length > best.length ? cur : best;
  });

  const byKey = new Map<string, TradeLogRow>();
  for (const rows of [...sources, previous]) {
    for (const row of rows) {
      const key = logRowKey(row);
      const existing = byKey.get(key);
      byKey.set(key, existing ? fillMissingLogFields(existing, row) : row);
    }
  }

  let merged = primary.map((row) => fillMissingLogFields(byKey.get(logRowKey(row)) ?? row, row));
  merged = mergeLogQuantities(merged, fromPlugin, fromTrades, fromDash, previous);
  merged = applyHistoryQuantities(merged, timeline);
  merged = applyHistoryPnl(merged, pnlTimeline, liveAt);
  merged = applySymbolQuantities(merged, snapSymbols);
  merged = applySymbolQuantities(merged, liveSymbols);
  merged = merged.map((row) => fillMissingLogFields(row, byKey.get(logRowKey(row))));
  merged = carryForwardQuantities(merged);

  if (previous.length > 0 && scoreLogs(merged) < scoreLogs(previous) * 0.5) {
    return carryForwardQuantities(previous.map((row) => fillMissingLogFields(row, byKey.get(logRowKey(row)))));
  }
  return merged;
}

export function normalizeLogs(raw: unknown): TradeLogRow[] {
  let rows: unknown[] = [];
  if (Array.isArray(raw)) rows = raw;
  else if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.rows)) rows = o.rows;
    else if (Array.isArray(o.logs)) rows = o.logs;
    else if (Array.isArray(o.data)) rows = o.data;
  }

  return rows.map((item) => {
    const r = (item && typeof item === 'object' ? item : {}) as Record<string, any>;
    const timeRaw = r.timestamp ?? r.time ?? r.Timestamp ?? r.Time;
    const timeMs = parseTradeTimeMs(timeRaw);
    const chartTimeMs = parseTradeTimeMs(r.logged_at ?? r.loggedAt ?? r.Logged_At) ?? timeMs;
    let time = '-';
    if (timeMs != null) {
      time = `${formatLogDate(timeMs)} ${formatLogTime(timeMs)}`;
    } else if (timeRaw != null) {
      time = String(timeRaw);
    }

    const simRaw = r.simulation_logs ?? r.simulationLogs ?? r.is_simulation;
    const lockedOut = isLockedOutRecord(r);
    const lockReason = lockedOut ? String(r.lock_reason ?? r.lockReason ?? '').toUpperCase() : undefined;
    const symbolText = String(r.Symbol ?? r.symbol ?? '-');

    return {
      time,
      timeMs,
      chartTimeMs,
      symbol: String(r.Symbol ?? r.symbol ?? '-'),
      signal: String(r.Signal ?? r.signal ?? r.side ?? r.Side ?? '-'),
      action: String(r.Action_Status ?? r.Action ?? r.action ?? r.action_status ?? r.status ?? '-'),
      quantity: pickQuantity(r),
      price: r.Price ?? r.price ?? r.curr_price ?? '-',
      change: r['Change(%)'] ?? r.Change ?? r.change ?? r.return_pct ?? '-',
      pnl: pickRowPnl(r),
      capital: r['Total_Capital'] ?? r.TotalCapital ?? r.total_capital ?? r.capital ?? r.cash_balance ?? r.portfolio_cash_balance ?? '-',
      return_pct: r['Return(%)'] ?? r.Return ?? r.return_pct ?? r.return ?? '-',
      simulation: typeof simRaw === 'boolean'
        ? simRaw
        : simRaw === 'true' || simRaw === 1
          ? true
          : simRaw === 'false' || simRaw === 0
            ? false
            : null,
      ...(lockedOut
        ? {
          lockedOut: true,
          lockReason,
          lockMessage: String(r.lock_message ?? r.lockMessage ?? '').trim() || lockMessageFor(symbolText, lockReason),
        }
        : {}),
    };
  });
}

export function formatMoney(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatLogDate(ms: number): string {
  return new Date(ms)
    .toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    })
    .replace(/,/g, '');
}

export function formatLogTime(ms: number): string {
  return new Date(ms)
    .toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
    .replace(/\s+(am|pm)/i, '\u00a0$1');
}

export function rmsRowFromExit(
  ex: ExitedSymbol,
  timeMs: number | null,
  extras?: Pick<TradeLogRow, 'capital' | 'simulation'>,
): TradeLogRow {
  const time = timeMs != null
    ? `${formatLogDate(timeMs)} ${formatLogTime(timeMs)}`
    : (ex.exit_time || '-');
  const pnl = exitedSymbolPnl(ex);
  return {
    time,
    timeMs,
    chartTimeMs: timeMs,
    symbol: ex.symbol,
    signal: ex.entry_side || '-',
    action: 'Hit RMS',
    quantity: ex.qty ?? '-',
    price: ex.exit_price ?? ex.entry_price ?? '-',
    change: '-',
    pnl: pnl ?? '-',
    capital: extras?.capital ?? '-',
    return_pct: '-',
    simulation: extras?.simulation ?? null,
    rmsHit: true,
    rmsReason: ex.exit_reason,
  };
}

export function lastNonZeroLogPnl(logs: TradeLogRow[], symbol: string, minMs: number | null = null): number | null {
  const key = symbol.toUpperCase();
  let last: number | null = null;
  for (const row of logs) {
    if (String(row.symbol || '').toUpperCase() !== key) continue;
    if (minMs != null && (row.timeMs == null || row.timeMs < minMs)) continue;
    const n = numOrNull(row.pnl);
    if (n != null && n !== 0) last = n;
  }
  return last;
}

export function formatCell(v: string | number, asMoney = false) {
  if (isPlaceholderValue(v)) return '—';
  const n = Number(v);
  if (asMoney && Number.isFinite(n)) return formatMoney(n);
  if (Number.isFinite(n) && asMoney === false && typeof v === 'number') return n.toFixed(2);
  return String(v);
}

export function formatQuantity(v: string | number, action?: string, signal?: string) {
  if (isPlaceholderValue(v)) return '—';
  const n = Number(v);
  if (Number.isFinite(n) && n === 0 && (isWaitAction(action) || isWaitAction(signal))) return '—';
  if (!Number.isFinite(n)) return String(v);
  return Number.isInteger(n) ? String(n) : n.toLocaleString('en-IN');
}

/**
 * Simulation/live per row. Prefer the record's `simulation_logs` field; older
 * logs without it fall back to the timestamp cutoff before simulation_live_started_at.
 */
export function resolveSimulation(log: TradeLogRow, liveCutoff: { hasLiveCutoff: boolean; liveStartedAtMs: number | null }): boolean {
  if (log.simulation !== null) return log.simulation;
  return liveCutoff.hasLiveCutoff
    && liveCutoff.liveStartedAtMs != null
    && log.timeMs != null
    && log.timeMs < liveCutoff.liveStartedAtMs;
}

/** 12:59 price is the sim-close mark. A copied morning-candle price is cleared. */
export function stampSimClosePrices(
  logs: TradeLogRow[],
  prices: Record<string, number>,
): TradeLogRow[] {
  const lastCandle = new Map<string, number>();
  return logs.map((row) => {
    const key = String(row.symbol || '').toUpperCase();
    if (!key || key === '-' || row.rmsHit || !isSimCloseIstLog(row.timeMs)) {
      const n = Number(row.price);
      if (key && key !== '-' && Number.isFinite(n) && n !== 0) lastCandle.set(key, n);
      return row;
    }
    const mark = prices[key];
    if (mark != null && Number.isFinite(mark) && mark !== 0) return { ...row, price: mark };
    const candle = lastCandle.get(key);
    const current = Number(row.price);
    if (!Number.isFinite(current) || current === 0 || (candle != null && current === candle)) {
      return { ...row, price: '-' };
    }
    return row;
  });
}

export function textIsClientManualExit(row: TradeLogRow): boolean {
  return /manual\s*exit/i.test(`${row.action ?? ''} ${row.signal ?? ''}`);
}

export function isBuySellTone(raw: string | number | null | undefined): boolean {
  const { tone } = formatTradeLabel(raw);
  return tone === 'buy' || tone === 'sell' || tone === 'hold-long' || tone === 'hold-short';
}

export function invertBuySell(raw: string | number | null | undefined): string | null {
  const { tone } = formatTradeLabel(raw);
  if (tone === 'buy' || tone === 'hold-long') return 'Sell';
  if (tone === 'sell' || tone === 'hold-short') return 'Buy';
  return null;
}

export function closingSideFromPrior(prior: TradeLogRow): string | null {
  return invertBuySell(prior.signal) ?? invertBuySell(prior.action);
}

/**
 * Engine manual-exit snapshots often look like the old square-off shape:
 * side in Action (or both columns dashed) and Change 0 / —.
 */
export function looksLikeBrokenExitRow(row: TradeLogRow): boolean {
  if (row.rmsHit) return false;
  const signalEmpty = isPlaceholderValue(row.signal);
  const actionEmpty = isPlaceholderValue(row.action);
  const changeEmptyOrZero = isPlaceholderValue(row.change) || isNumericZero(row.change);
  if (actionEmpty && changeEmptyOrZero) return true;
  if (signalEmpty && isBuySellTone(row.action) && changeEmptyOrZero) return true;
  return false;
}
