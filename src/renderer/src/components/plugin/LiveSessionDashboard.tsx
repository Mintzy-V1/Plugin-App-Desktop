import { useState, useEffect, useRef, useMemo, Fragment } from 'react';
import { StopCircle, AlertTriangle, Download, RefreshCw, Loader2, WifiOff, IndianRupee } from 'lucide-react';
import { pluginApi, supportsPyramidPnl, supportsExitedSymbols } from '../../lib/pluginApi';
import {
  parsePyramidPnlBySymbol,
  extractOnePmPnlFromHistory,
  mergePyramidMaps,
  isSimCloseIstLog,
  istWallClockMs,
} from '../../lib/pyramidPnl';
import { useToast } from '../ui/Toast';
import ConfirmDialog from '../ui/ConfirmDialog';
import {
  sessionStatusLabel,
  resolveSessionStatus,
  isLiveSessionStatus,
  isTerminalSessionStatus,
  isSimulationRunningStatus,
  simulationStatusLabel,
  simulationStatusBadgeClass,
} from '../../lib/sessionStatus';
import { downloadSessionCsv } from '../../lib/downloadSessionCsv';
import { pickCash, rememberBrokerCash } from '../../lib/brokerCash';
import { isWaitAction } from '../../lib/tradeSignals';
import LivePnlPanel from './LivePnlPanel';
import TradeActionPill from './TradeActionPill';
import { pluginErrorMessage } from '../../lib/pluginErrors';
import type { TradingSession } from '../../lib/pluginApi';
import {
  parseExitedSymbols,
  rmsHitInWindow,
  exitedSymbolPnl,
  exitedSymbolTimeRaw,
  type ExitedSymbol,
} from '../../lib/exitedSymbols';

interface Props {
  sessionId: string;
  /** Known status from the sessions list (e.g. trading_active) — used until dashboard hydrates. */
  initialStatus?: string;
  /** Free cash captured from the TOTP / broker-connect response. */
  initialFreeCash?: number | null;
  /** Past / ended sessions open read-only (no stop controls, slower refresh). */
  readOnly?: boolean;
  onStop: () => void;
  onConfigure: () => void;
}

type Tab = 'logs' | 'pnl';

interface TradeLogRow {
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
}

/** Engine logs often use naive IST wall times (`YYYY-MM-DD HH:mm:ss`). */
function parseTradeTimeMs(raw: unknown): number | null {
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

function parseInstantMs(raw: unknown): number | null {
  return parseTradeTimeMs(raw);
}

function pickStatus(value: unknown): string | null {
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

const QTY_KEYS = [
  'Quantity', 'quantity', 'QTY', 'Qty', 'qty',
  'qty_traded', 'filled_qty', 'FilledQty', 'filledQty',
  'lots', 'Lots', 'net_qty', 'netqty', 'NetQty',
  'position_qty', 'traded_qty', 'order_qty',
];

function unwrapQuantity(value: unknown): string | number | null {
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

function pickQuantity(r: Record<string, unknown> | null | undefined): string | number {
  if (!r) return '-';
  for (const key of QTY_KEYS) {
    const v = unwrapQuantity(r[key]);
    if (v != null) return v;
  }
  for (const [key, val] of Object.entries(r)) {
    if (/qty|quantity|lots/i.test(key) && !/price|pnl|pct|percent/i.test(key)) {
      const v = unwrapQuantity(val);
      if (v != null) return v;
    }
  }
  return '-';
}

function isPlaceholderValue(v: unknown): boolean {
  return v == null || v === '' || v === '-' || v === '—' || v === '--';
}

function hasQuantity(v: string | number | null | undefined): boolean {
  return v != null && v !== '' && v !== '-';
}

/** Live-pnl often reports 0 after sim→live or when a position is flat. Never treat that as a fill. */
function isPositiveQty(v: string | number | null | undefined): boolean {
  if (!hasQuantity(v)) return false;
  const n = Number(v);
  return Number.isFinite(n) ? n !== 0 : true;
}

function applySymbolQuantities(
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
    if (isPositiveQty(row.quantity) || isWaitAction(row.action) || isWaitAction(row.signal)) return row;
    const qty = bySym.get(String(row.symbol).toUpperCase());
    return qty != null ? { ...row, quantity: qty } : row;
  });
}

function mergeLogQuantities(primary: TradeLogRow[], ...fallbacks: TradeLogRow[][]): TradeLogRow[] {
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
    if (isPositiveQty(row.quantity) || isWaitAction(row.action) || isWaitAction(row.signal)) return row;
    const qty = byKey.get(`${row.timeMs ?? row.time}|${String(row.symbol).toUpperCase()}`);
    return qty != null ? { ...row, quantity: qty } : row;
  });
}

function pickLivePnlSymbols(raw: unknown): Record<string, unknown> | null {
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

interface QtySample {
  ts: number;
  bySym: Map<string, string | number>;
}

function qtyMapFromSymbols(raw: unknown): Map<string, string | number> {
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
function buildQtyTimeline(raw: unknown): QtySample[] {
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

function qtyAsOf(timeline: QtySample[], symbol: string, timeMs: number | null): string | number | null {
  if (timeline.length === 0) return null;
  const key = symbol.toUpperCase();
  let last: string | number | null = null;
  for (const sample of timeline) {
    if (timeMs != null && sample.ts > timeMs) break;
    const q = sample.bySym.get(key);
    if (q != null && isPositiveQty(q)) last = q;
  }
  if (last != null) return last;
  for (const sample of timeline) {
    const q = sample.bySym.get(key);
    if (q != null && isPositiveQty(q)) return q;
  }
  return null;
}

function applyHistoryQuantities(logs: TradeLogRow[], timeline: QtySample[]): TradeLogRow[] {
  if (timeline.length === 0) return logs;
  return logs.map((row) => {
    if (isPositiveQty(row.quantity) || isWaitAction(row.action) || isWaitAction(row.signal)) return row;
    const qty = qtyAsOf(timeline, String(row.symbol), row.timeMs);
    return qty != null ? { ...row, quantity: qty } : row;
  });
}

function logRowKey(row: TradeLogRow): string {
  return `${row.timeMs ?? row.time}|${String(row.symbol).toUpperCase()}`;
}

function scoreLogRow(row: TradeLogRow): number {
  let score = 0;
  for (const v of [row.quantity, row.price, row.pnl, row.capital, row.change, row.signal, row.action]) {
    if (!isPlaceholderValue(v)) score += 1;
    if (isPositiveQty(v as string | number)) score += 1;
  }
  return score;
}

function scoreLogs(rows: TradeLogRow[]): number {
  return rows.reduce((n, row) => n + scoreLogRow(row), 0) + rows.length;
}

function fillMissingLogFields(row: TradeLogRow, fallback?: TradeLogRow | null): TradeLogRow {
  if (!fallback) return row;
  const next = { ...row };
  const keys: Array<keyof TradeLogRow> = [
    'quantity', 'price', 'change', 'pnl', 'capital', 'return_pct', 'signal', 'action',
  ];
  for (const key of keys) {
    const cur = next[key];
    const prev = fallback[key];
    if (isPlaceholderValue(cur) && !isPlaceholderValue(prev)) {
      (next as TradeLogRow)[key] = prev as never;
    }
  }
  if (
    !isWaitAction(next.action) &&
    !isWaitAction(next.signal) &&
    !isPositiveQty(next.quantity) &&
    isPositiveQty(fallback.quantity)
  ) {
    next.quantity = fallback.quantity;
  }
  if (next.chartTimeMs == null && fallback.chartTimeMs != null) next.chartTimeMs = fallback.chartTimeMs;
  if (next.timeMs == null && fallback.timeMs != null) next.timeMs = fallback.timeMs;
  return next;
}

function carryForwardQuantities(logs: TradeLogRow[]): TradeLogRow[] {
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
    if (isWaitAction(row.action) || isWaitAction(row.signal)) {
      updated.set(i, row);
      continue;
    }
    const last = lastBySym.get(key);
    updated.set(i, last != null ? { ...row, quantity: last } : row);
  }
  return logs.map((row, i) => updated.get(i) ?? row);
}

function mergeIncomingLogs(
  fromPlugin: TradeLogRow[],
  fromTrades: TradeLogRow[],
  fromDash: TradeLogRow[],
  previous: TradeLogRow[],
  timeline: QtySample[],
  snapSymbols: Record<string, unknown> | null,
  liveSymbols: Record<string, unknown> | null,
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
  merged = applySymbolQuantities(merged, snapSymbols);
  merged = applySymbolQuantities(merged, liveSymbols);
  merged = merged.map((row) => fillMissingLogFields(row, byKey.get(logRowKey(row))));
  merged = carryForwardQuantities(merged);

  if (previous.length > 0 && scoreLogs(merged) < scoreLogs(previous) * 0.5) {
    return carryForwardQuantities(previous.map((row) => fillMissingLogFields(row, byKey.get(logRowKey(row)))));
  }
  return merged;
}

function normalizeLogs(raw: unknown): TradeLogRow[] {
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
      pnl: r['P&L'] ?? r.PnL ?? r.pnl ?? r.unrealized_pnl ?? r.realized_pnl ?? '-',
      capital: r['Total_Capital'] ?? r.TotalCapital ?? r.total_capital ?? r.capital ?? r.cash_balance ?? r.portfolio_cash_balance ?? '-',
      return_pct: r['Return(%)'] ?? r.Return ?? r.return_pct ?? r.return ?? '-',
      simulation: typeof simRaw === 'boolean'
        ? simRaw
        : simRaw === 'true' || simRaw === 1
          ? true
          : simRaw === 'false' || simRaw === 0
            ? false
            : null,
    };
  });
}

function formatMoney(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatLogDate(ms: number): string {
  return new Date(ms)
    .toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    })
    .replace(/,/g, '');
}

function formatLogTime(ms: number): string {
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

function rmsRowFromExit(
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

function withRmsLogRows(logs: TradeLogRow[], exits: ExitedSymbol[]): TradeLogRow[] {
  if (exits.length === 0) return logs;
  const extra: TradeLogRow[] = [];
  for (const ex of exits) {
    const ms = parseTradeTimeMs(exitedSymbolTimeRaw(ex));
    const key = ex.symbol.toUpperCase();
    const already = logs.some((l) => {
      if (String(l.symbol || '').toUpperCase() !== key) return false;
      if (l.rmsHit) return true;
      if (l.timeMs != null && ms != null && Math.abs(l.timeMs - ms) < 2000) return true;
      return false;
    });
    if (already) continue;
    extra.push(rmsRowFromExit(ex, ms));
  }
  if (extra.length === 0) return logs;
  return [...logs, ...extra].sort((a, b) => (a.timeMs ?? 0) - (b.timeMs ?? 0));
}

function formatCell(v: string | number, asMoney = false) {
  if (isPlaceholderValue(v)) return '—';
  const n = Number(v);
  if (asMoney && Number.isFinite(n)) return formatMoney(n);
  if (Number.isFinite(n) && asMoney === false && typeof v === 'number') return n.toFixed(2);
  return String(v);
}

function formatQuantity(v: string | number, action?: string, signal?: string) {
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
function resolveSimulation(log: TradeLogRow, liveCutoff: { hasLiveCutoff: boolean; liveStartedAtMs: number | null }): boolean {
  if (log.simulation !== null) return log.simulation;
  return liveCutoff.hasLiveCutoff
    && liveCutoff.liveStartedAtMs != null
    && log.timeMs != null
    && log.timeMs < liveCutoff.liveStartedAtMs;
}

/**
 * Display-only 12:59 IST sim-close rows: copy the last sim block (e.g. 11:45)
 * and set P&L from `/trading/pyramid-pnl`. Live 1pm rows are left unchanged.
 */
function withPyramidSimCloseRows(
  logs: TradeLogRow[],
  pyramidBySymbol: Record<string, number>,
  liveStartedAtMs: number | null,
  exited: ExitedSymbol[] = [],
): TradeLogRow[] {
  const symbols = Object.keys(pyramidBySymbol).filter((sym) => Number.isFinite(pyramidBySymbol[sym]));
  if (logs.length === 0 || (symbols.length === 0 && exited.length === 0)) return logs;

  const cutoff = { hasLiveCutoff: liveStartedAtMs != null, liveStartedAtMs };
  const refMs = liveStartedAtMs
    ?? logs.reduce<number | null>((best, row) => {
      if (row.timeMs == null) return best;
      return best == null || row.timeMs > best ? row.timeMs : best;
    }, null)
    ?? Date.now();
  const closeMs = istWallClockMs(refMs, 12, 59, 0);
  if (!Number.isFinite(closeMs)) return logs;

  const lastSimBySym = new Map<string, TradeLogRow>();
  let lastSimBlockMs = Number.NEGATIVE_INFINITY;
  for (const log of logs) {
    if (isSimCloseIstLog(log.timeMs)) continue;
    if (log.rmsHit) continue;
    if (!resolveSimulation(log, cutoff)) continue;
    const key = String(log.symbol || '').toUpperCase();
    if (!key || key === '-') continue;
    lastSimBySym.set(key, log);
    if (log.timeMs != null && log.timeMs > lastSimBlockMs) lastSimBlockMs = log.timeMs;
  }

  const blockOrder: string[] = [];
  if (Number.isFinite(lastSimBlockMs) && lastSimBlockMs > 0) {
    for (const log of logs) {
      if (log.timeMs !== lastSimBlockMs) continue;
      const key = String(log.symbol || '').toUpperCase();
      if (key && key !== '-' && !blockOrder.includes(key)) blockOrder.push(key);
    }
  }

  const ordered = [
    ...blockOrder.filter((sym) => symbols.includes(sym)),
    ...symbols.filter((sym) => !blockOrder.includes(sym)),
  ];

  const closeTime = `${formatLogDate(closeMs)} ${formatLogTime(closeMs)}`;
  const injected: TradeLogRow[] = [];
  for (const sym of ordered) {
    const template = lastSimBySym.get(sym);
    const fromMs = template?.timeMs
      ?? (Number.isFinite(lastSimBlockMs) && lastSimBlockMs > 0 ? lastSimBlockMs : Number.NEGATIVE_INFINITY);
    const rms = rmsHitInWindow(exited, sym, fromMs, closeMs, parseTradeTimeMs);
    if (rms) {
      injected.push(rmsRowFromExit(rms, closeMs, {
        capital: template?.capital ?? '-',
        simulation: true,
      }));
      continue;
    }
    if (!template) continue;
    injected.push({
      ...template,
      time: closeTime,
      timeMs: closeMs,
      chartTimeMs: closeMs,
      symbol: template.symbol,
      pnl: pyramidBySymbol[sym],
      simulation: true,
      rmsHit: false,
      rmsReason: undefined,
    });
  }
  if (injected.length === 0) return logs;

  const rest = logs.filter((row) => {
    if (!isSimCloseIstLog(row.timeMs)) return true;
    const key = String(row.symbol || '').toUpperCase();
    return !pyramidBySymbol[key] && !injected.some((r) => String(r.symbol).toUpperCase() === key);
  });
  const before = rest.filter((row) => row.timeMs == null || row.timeMs < closeMs);
  const after = rest.filter((row) => row.timeMs != null && row.timeMs >= closeMs);
  return [...before, ...injected, ...after];
}

function extractTradingSession(raw: unknown): TradingSession | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const session = (o.session && typeof o.session === 'object' ? o.session : o) as TradingSession;
  return session?.python_session_id || session?.status != null ? session : null;
}

export default function LiveSessionDashboard({ sessionId, initialStatus, initialFreeCash, readOnly = false, onStop }: Props) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('logs');
  const [logs, setLogs] = useState<TradeLogRow[]>([]);
  const [sessionStatus, setSessionStatus] = useState<string>(initialStatus || '');
  const [simulationStatus, setSimulationStatus] = useState<string | null>(null);
  const [liveStartedAtMs, setLiveStartedAtMs] = useState<number | null>(null);
  const [availableCash, setAvailableCash] = useState<number | null>(
    initialFreeCash != null && Number.isFinite(initialFreeCash) ? initialFreeCash : null
  );
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [confirming, setConfirming] = useState<'stop' | 'force' | null>(null);
  const [stopping, setStopping] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [pyramidPnlBySymbol, setPyramidPnlBySymbol] = useState<Record<string, number>>({});
  const [exitedSymbols, setExitedSymbols] = useState<ExitedSymbol[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const seenLiveRef = useRef(!readOnly && isLiveSessionStatus(initialStatus));
  const logsRef = useRef<TradeLogRow[]>([]);
  const fetchForSessionRef = useRef(sessionId);

  useEffect(() => {
    if (isLiveSessionStatus(sessionStatus || initialStatus)) seenLiveRef.current = true;
    if (isTerminalSessionStatus(sessionStatus || initialStatus)) seenLiveRef.current = false;
  }, [sessionStatus, initialStatus]);

  const effectiveStatus = sessionStatus || initialStatus || '';
  // Keep Stop/Force visible for live sessions even if a poll briefly returns a
  // non-active status (e.g. authenticated / unknown). Only hide on terminal.
  const showStopControls =
    !isTerminalSessionStatus(effectiveStatus) &&
    (seenLiveRef.current || isLiveSessionStatus(effectiveStatus) || !readOnly);

  const isLive = showStopControls;
  const hasLiveCutoff = liveStartedAtMs != null;
  const simLabel = simulationStatusLabel(simulationStatus);
  const simRunning = isSimulationRunningStatus(simulationStatus);
  const displayLogs = useMemo(() => {
    const withRms = withRmsLogRows(logs, exitedSymbols);
    return withPyramidSimCloseRows(withRms, pyramidPnlBySymbol, liveStartedAtMs, exitedSymbols);
  }, [logs, pyramidPnlBySymbol, liveStartedAtMs, exitedSymbols]);

  const fetchDashboard = async () => {
    const forSession = sessionId;
    // Pull from several endpoints in parallel — same strategy as the web plugin UI.
    // A failure in one source must not blank out status / cash / logs.
    const [dashRes, statusRes, tradesRes, tsRes, pnlRes, fullRes, livePnlRes, historyRes, pyramidRes, exitedRes] = await Promise.allSettled([
      pluginApi.getDashboard(sessionId),
      pluginApi.getSessionStatus(sessionId),
      pluginApi.getSessionTrades(sessionId),
      pluginApi.getSessionById(sessionId),
      pluginApi.getPnlSummary(sessionId),
      pluginApi.getFullSessionState(),
      pluginApi.getLivePnl(sessionId),
      pluginApi.getLivePnlHistory(sessionId),
      supportsPyramidPnl() ? pluginApi.getPyramidPnl(sessionId) : Promise.resolve(null),
      supportsExitedSymbols() ? pluginApi.getExitedSymbols(sessionId) : Promise.resolve(null),
    ]);
    if (fetchForSessionRef.current !== forSession) return;

    const dash = dashRes.status === 'fulfilled' ? dashRes.value.data : null;
    const pluginStatus = statusRes.status === 'fulfilled' ? statusRes.value.data : null;
    const tradesRaw = tradesRes.status === 'fulfilled' ? tradesRes.value.data : null;
    const tradingSession = tsRes.status === 'fulfilled'
      ? extractTradingSession(tsRes.value.data)
      : null;
    const pnlSummary = pnlRes.status === 'fulfilled' ? pnlRes.value.data as Record<string, any> : null;
    const fullState = fullRes.status === 'fulfilled' ? fullRes.value.data : null;
    // /session always returns the user's latest session — only trust it for this id
    const fullMatches = fullState?.python_session_id === sessionId ? fullState : null;

    const livePnl = livePnlRes.status === 'fulfilled' ? livePnlRes.value.data : null;
    const historyRaw = historyRes.status === 'fulfilled' ? historyRes.value.data : null;
    if (supportsPyramidPnl()) {
      const fromApi = pyramidRes.status === 'fulfilled' && pyramidRes.value != null
        ? parsePyramidPnlBySymbol(pyramidRes.value.data)
        : {};
      const fromHistory = Object.keys(fromApi).length === 0
        ? extractOnePmPnlFromHistory(historyRaw)
        : {};
      const mergedPyramid = mergePyramidMaps(fromHistory, fromApi);
      if (Object.keys(mergedPyramid).length > 0) setPyramidPnlBySymbol(mergedPyramid);
    }
    if (supportsExitedSymbols() && exitedRes.status === 'fulfilled' && exitedRes.value != null) {
      const parsed = parseExitedSymbols(exitedRes.value.data);
      setExitedSymbols(parsed);
    }
    const anyOk = [dashRes, statusRes, tradesRes, tsRes, pnlRes, fullRes, livePnlRes, historyRes, pyramidRes, exitedRes].some(r => r.status === 'fulfilled');
    setConnected(anyOk);

    const snapshot = (fullMatches?.snapshot as any)?.data
      || fullMatches?.snapshot
      || (dash?.snapshot as any)?.data
      || dash?.snapshot
      || null;

    if (tradingSession) {
      if (typeof tradingSession.simulation_status === 'string' && tradingSession.simulation_status.trim()) {
        setSimulationStatus(tradingSession.simulation_status.trim().toLowerCase());
      }
      const liveStart = parseInstantMs(tradingSession.simulation_live_started_at);
      if (liveStart != null) setLiveStartedAtMs(liveStart);
    }

    const resolved = resolveSessionStatus(
      pickStatus(pluginStatus),
      pickStatus(fullMatches?.status),
      pickStatus(dash?.status),
      pickStatus(snapshot),
      pickStatus(tradingSession),
      initialStatus,
    );
    if (resolved) {
      setSessionStatus((prev) => {
        // Don't let a flaky poll demote a live session to a non-terminal status.
        if (
          isLiveSessionStatus(prev) &&
          !isLiveSessionStatus(resolved) &&
          !isTerminalSessionStatus(resolved)
        ) {
          return prev;
        }
        return resolved;
      });
    }

    const cash = pickCash(snapshot, pluginStatus, fullMatches?.status, dash?.status, tradingSession, pnlSummary?.current);
    if (cash != null) {
      setAvailableCash(cash);
      rememberBrokerCash(cash);
    }

    // Prefer the richest log source. After market close the live VM often
    // returns empty qty/price — keep last known values instead of flashing —.
    const merged = mergeIncomingLogs(
      normalizeLogs(fullMatches?.logs),
      normalizeLogs(tradesRaw),
      normalizeLogs(dash?.logs),
      logsRef.current,
      buildQtyTimeline(historyRaw),
      pickLivePnlSymbols(snapshot),
      pickLivePnlSymbols(livePnl),
    );
    if (merged.length > 0) {
      logsRef.current = merged;
      setLogs(merged);
    }

    if (anyOk) setLastUpdated(new Date());
    setLoading(false);
  };

  useEffect(() => {
    fetchForSessionRef.current = sessionId;
    setLoading(true);
    setLogs([]);
    logsRef.current = [];
    setLastUpdated(null);
    setConnected(true);
    setSimulationStatus(null);
    setLiveStartedAtMs(null);
    setPyramidPnlBySymbol({});
    setExitedSymbols([]);
    seenLiveRef.current = !readOnly && isLiveSessionStatus(initialStatus);
    if (initialStatus) setSessionStatus(initialStatus);
    else setSessionStatus('');
    if (initialFreeCash != null && Number.isFinite(initialFreeCash)) setAvailableCash(initialFreeCash);
    else setAvailableCash(null);
    setTab('logs');
    fetchDashboard();

    // Live sessions poll; past sessions only need a one-shot load (plus a slow refresh).
    const ms = readOnly ? 60000 : 10000;
    intervalRef.current = setInterval(fetchDashboard, ms);
    return () => clearInterval(intervalRef.current);
  }, [sessionId, readOnly]);

  const handleStop = async (force: boolean) => {
    setStopping(true);
    try {
      if (force) await pluginApi.adminStopSession(sessionId);
      else await pluginApi.stopTrading(sessionId);
      toast.success(force ? 'Session force-stopped' : 'Session stopped');
      setSessionStatus('stopped');
      seenLiveRef.current = false;
      setConfirming(null);
      if (availableCash != null) rememberBrokerCash(availableCash);
      onStop();
    } catch (err: any) {
      toast.error(pluginErrorMessage(err, 'Could not stop the session. It may still be running.'));
      setConfirming(null);
    } finally {
      setStopping(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      // Past sessions: Mongo logs first (VM final-tradebook is usually gone).
      const kind = await downloadSessionCsv(sessionId, { preferLogs: readOnly || !isLive });
      toast.success(kind === 'logs' ? 'Session logs CSV downloaded' : 'Tradebook CSV downloaded');
    } catch (err: any) {
      const status = err?.response?.status;
      toast.error(status === 404
        ? 'No tradebook or logs are available for this session yet.'
        : 'Could not download the tradebook. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const statusColor = (() => {
    if (simRunning && !hasLiveCutoff) return 'text-amber-600';
    const s = (sessionStatus || '').toLowerCase();
    if (['trading_active', 'active', 'running', 'started'].includes(s)) return 'text-emerald-600';
    if (['stopped', 'completed', 'abandoned'].includes(s)) return 'text-slate-500';
    if (['error', 'failed'].includes(s)) return 'text-red-600';
    return 'text-slate-900';
  })();

  return (
    <div className="page-stack">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-sm">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Free cash</p>
          <p className="mt-0.5 flex items-center gap-1 text-[15px] font-semibold text-slate-900">
            <IndianRupee className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
            {availableCash != null ? formatMoney(availableCash).replace(/^₹\s?/, '') : <span className="font-medium text-slate-400">—</span>}
          </p>
        </div>

        <div className="hidden h-8 w-px bg-slate-100 sm:block" aria-hidden="true" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Status</p>
            {simLabel && (
              <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${simulationStatusBadgeClass(simulationStatus)}`}>
                Simulation · {simLabel}
              </span>
            )}
            {!connected && (
              <span className="flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                <WifiOff className="h-3 w-3" aria-hidden="true" /> Reconnecting…
              </span>
            )}
          </div>
          <p className={`mt-0.5 text-[15px] font-semibold capitalize ${statusColor}`}>
            {simRunning && !hasLiveCutoff
              ? 'Simulating'
              : (sessionStatusLabel(sessionStatus) || 'Loading…')}
          </p>
          {lastUpdated && (
            <p className="text-[11px] text-slate-400">
              Updated {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={handleDownload} disabled={downloading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 disabled:opacity-50">
            {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Download className="h-3.5 w-3.5" aria-hidden="true" />}
            CSV
          </button>
          {showStopControls && (
            <>
              <button type="button" onClick={() => setConfirming('stop')}
                className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-2.5 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40">
                <StopCircle className="h-3.5 w-3.5" aria-hidden="true" /> Stop
              </button>
              <button type="button" onClick={() => setConfirming('force')}
                className="flex items-center gap-1.5 rounded-lg bg-red-500 px-2.5 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Force
              </button>
            </>
          )}
        </div>
      </div>

      <div role="tablist" aria-label="Session data" className="inline-flex gap-0.5 rounded-lg bg-slate-200/60 p-0.5">
        {(['logs', 'pnl'] as Tab[]).map(t => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 ${
              tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {t === 'logs' ? 'Trade logs' : 'Live P&L'}
          </button>
        ))}
      </div>

      {/* Keep both panes mounted so Live P&L history/polling survives tab switches. */}
      <div hidden={tab !== 'pnl'}>
        <LivePnlPanel key={sessionId} sessionId={sessionId} logRows={logs} liveStartedAtMs={liveStartedAtMs} />
      </div>

      <div hidden={tab !== 'logs'}>
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          {loading && logs.length === 0 && displayLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-slate-400">
              <RefreshCw className="h-5 w-5 animate-spin" aria-hidden="true" />
              <p className="text-sm">Loading trades…</p>
            </div>
          ) : displayLogs.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-medium text-slate-500">No trades yet</p>
              <p className="mt-1 text-xs text-slate-400">
                Executed trades will appear here as the engine runs.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {displayLogs.some(l => resolveSimulation(l, { hasLiveCutoff, liveStartedAtMs })) && (
                <p className="border-b border-slate-100 bg-slate-50/80 px-3.5 py-2 text-[11px] text-slate-500">
                  Rows tagged Sim are simulation trades. Untagged rows are live.
                </p>
              )}
              {displayLogs.some(l => l.rmsHit) && (
                <p className="border-b border-red-100 bg-red-50/70 px-3.5 py-2 text-[11px] text-red-800">
                  Rows tagged RMS were exited by risk management and may not appear in the engine log.
                </p>
              )}
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th scope="col" className="px-3.5 py-2.5">Time</th>
                    <th scope="col" className="px-3.5 py-2.5">Symbol</th>
                    <th scope="col" className="px-3.5 py-2.5">Signal</th>
                    <th scope="col" className="px-3.5 py-2.5">Action</th>
                    <th scope="col" className="px-3.5 py-2.5 text-right">Qty</th>
                    <th scope="col" className="px-3.5 py-2.5 text-right">Price</th>
                    <th scope="col" className="px-3.5 py-2.5 text-right">Change</th>
                    <th scope="col" className="px-3.5 py-2.5 text-right">P&L</th>
                    <th scope="col" className="px-3.5 py-2.5 text-right">Capital</th>
                  </tr>
                </thead>
                <tbody>
                  {displayLogs.map((log, i) => {
                    const pnlNum = Number(log.pnl);
                    const changeNum = Number(log.change);
                    const pnlColor = Number.isFinite(pnlNum) ? (pnlNum >= 0 ? 'text-emerald-600' : 'text-red-600') : 'text-slate-700';
                    const changeColor = Number.isFinite(changeNum) ? (changeNum >= 0 ? 'text-emerald-600' : 'text-red-600') : 'text-slate-700';
                    const cutoff = { hasLiveCutoff, liveStartedAtMs };
                    const isSimTrade = resolveSimulation(log, cutoff);
                    const prev = i > 0 ? displayLogs[i - 1] : null;
                    const prevWasSim = prev != null && resolveSimulation(prev, cutoff);
                    const showLiveDivider = !log.rmsHit && !isSimTrade && (i === 0 || prevWasSim);

                    return (
                      <Fragment key={`${log.time}-${log.symbol}-${log.rmsHit ? 'rms' : 'row'}-${i}`}>
                        {showLiveDivider && (
                          <tr className="bg-emerald-50/70">
                            <td colSpan={9} className="px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                              Live trading
                            </td>
                          </tr>
                        )}
                        <tr
                          className={`border-b border-slate-50 text-slate-700 last:border-0 ${
                            log.rmsHit
                              ? 'bg-red-50/80 hover:bg-red-50'
                              : isSimTrade
                                ? 'bg-slate-50/40 hover:bg-slate-50'
                                : 'hover:bg-slate-50'
                          }`}
                          title={log.rmsHit ? (log.rmsReason ? `Hit RMS · ${log.rmsReason}` : 'Hit RMS') : isSimTrade ? 'Simulation trade' : undefined}
                        >
                          <td className="px-3.5 py-2 text-xs font-mono">
                            <div className="flex flex-col gap-0.5">
                              {log.timeMs != null && (
                                <span className="whitespace-nowrap">{formatLogDate(log.timeMs)}</span>
                              )}
                              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                                {log.rmsHit && (
                                  <span className="rounded bg-red-200/80 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-red-800">
                                    RMS
                                  </span>
                                )}
                                {isSimTrade && !log.rmsHit && (
                                  <span className="rounded bg-slate-200/80 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                                    Sim
                                  </span>
                                )}
                                <span>
                                  {log.timeMs != null ? formatLogTime(log.timeMs) : log.time}
                                </span>
                              </span>
                            </div>
                          </td>
                          <td className="px-3.5 py-2 font-semibold">{log.symbol}</td>
                          <td className="px-3.5 py-2">
                            <TradeActionPill value={log.signal} />
                          </td>
                          <td className="px-3.5 py-2">
                            <TradeActionPill value={log.action} />
                          </td>
                          <td className="px-3.5 py-2 text-right font-mono">{formatQuantity(log.quantity, log.action, log.signal)}</td>
                          <td className="px-3.5 py-2 text-right font-mono">{formatCell(log.price, true)}</td>
                          <td className={`px-3.5 py-2 text-right font-mono ${changeColor}`}>
                            {isPlaceholderValue(log.change) ? '—' : `${Number.isFinite(changeNum) && changeNum > 0 ? '+' : ''}${formatCell(log.change)}${Number.isFinite(changeNum) ? '%' : ''}`}
                          </td>
                          <td className={`px-3.5 py-2 text-right font-mono ${pnlColor}`}>{formatCell(log.pnl, true)}</td>
                          <td className="px-3.5 py-2 text-right font-mono">{formatCell(log.capital, true)}</td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog open={!!confirming}
        title={confirming === 'force' ? 'Force stop session?' : 'Stop session?'}
        description={confirming === 'force'
          ? 'This immediately terminates the engine. Open positions will not be closed automatically — you may need to exit them manually with your broker.'
          : 'The engine will finish gracefully: it stops taking new positions and winds down the session.'}
        confirmLabel={confirming === 'force' ? 'Force stop' : 'Stop session'}
        tone={confirming === 'force' ? 'danger' : 'warning'}
        busy={stopping}
        onConfirm={() => handleStop(confirming === 'force')}
        onCancel={() => { if (!stopping) setConfirming(null); }} />
    </div>
  );
}
