import { isWaitAction } from './tradeSignals';

export interface PnlPoint {
  ts: number;
  total: number;
  realized: number;
  unrealized: number;
  symbols?: Record<string, SymbolRow>;
}

export interface SymbolRow {
  unrealized_pnl: number;
  realized_pnl?: number;
  qty?: number;
  side?: string;
}

export interface LogTickerHint {
  symbol: string;
  quantity: string | number;
  pnl: string | number;
  price?: string | number;
  signal: string;
  action: string;
  timeMs?: number | null;
  chartTimeMs?: number | null;
  capital?: string | number;
  simulation?: boolean | null;
}

/**
 * Live P&L poll interval. The owner sees 1s updates; an admin watching any
 * account polls every 3s; an ended or stopped session only every 30s. One
 * request is in flight at a time, so a slow gateway never stacks calls.
 */
export function livePnlPollMs({ viewOnly, readOnly, stopped }: { viewOnly: boolean; readOnly: boolean; stopped: boolean }): number {
  if (readOnly || stopped) return 30000;
  return viewOnly ? 3000 : 1000;
}

export type ChartType = 'area' | 'candle';

export const IST = 'Asia/Kolkata';

export const IST_OFFSET_MS = 5.5 * 3600 * 1000;

export function parseChartTimeMs(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw <= 0) return null;
    return raw < 1e12 ? Math.round(raw * 1000) : Math.round(raw);
  }
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    return parseChartTimeMs(o.$date ?? o.$numberLong ?? o.$numberInt);
  }
  const s = String(raw).trim();
  if (!s) return null;
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    const ms = Date.parse(s);
    return Number.isNaN(ms) ? null : ms;
  }
  const normalized = s.includes('T') ? s : s.replace(' ', 'T');
  const ist = Date.parse(`${normalized}+05:30`);
  if (!Number.isNaN(ist)) return ist;
  const fallback = Date.parse(normalized);
  return Number.isNaN(fallback) ? null : fallback;
}

export function isPlausibleTs(ms: number): boolean {
  const min = Date.parse('2020-01-01T00:00:00+05:30');
  const max = Date.now() + 36 * 3600 * 1000;
  return ms >= min && ms <= max;
}

export function roundTs(ms: number): number {
  return Math.round(ms / 1000) * 1000;
}

export function mergeBySecond(existing: PnlPoint[], incoming: PnlPoint[]): PnlPoint[] {
  const byTs = new Map<number, PnlPoint>();
  for (const p of existing) {
    if (!isPlausibleTs(p.ts)) continue;
    byTs.set(roundTs(p.ts), { ...p, ts: roundTs(p.ts) });
  }
  for (const p of incoming) {
    if (!isPlausibleTs(p.ts)) continue;
    byTs.set(roundTs(p.ts), { ...p, ts: roundTs(p.ts) });
  }
  return Array.from(byTs.values()).sort((a, b) => a.ts - b.ts);
}

export function downsamplePoints(points: PnlPoint[], maxPoints = 220, keepTs: number | null = null): PnlPoint[] {
  if (points.length <= maxPoints) return points;
  const start = points[0].ts;
  const end = points[points.length - 1].ts;
  const bucketMs = Math.max(Math.ceil((end - start) / (maxPoints - 2)), 1000);
  const picked = new Map<number, PnlPoint>();
  for (const p of points) {
    const key = Math.floor((p.ts - start) / bucketMs);
    picked.set(key, p);
  }
  const out = Array.from(picked.values()).sort((a, b) => a.ts - b.ts);
  const first = points[0];
  const last = points[points.length - 1];
  if (out[0]?.ts !== first.ts) out.unshift(first);
  if (out[out.length - 1]?.ts !== last.ts) out.push(last);
  if (keepTs != null) {
    const near = points.reduce((best, p) =>
      Math.abs(p.ts - keepTs) < Math.abs(best.ts - keepTs) ? p : best, points[0]);
    if (!out.some((p) => p.ts === near.ts)) {
      out.push(near);
      out.sort((a, b) => a.ts - b.ts);
    }
  }
  return out;
}

export interface CandlePoint {
  ts: number;
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  total: number;
  isSwitch?: boolean;
}

export function alignBucketStart(ts: number, bucketMs: number): number {
  return Math.floor((ts + IST_OFFSET_MS) / bucketMs) * bucketMs - IST_OFFSET_MS;
}

export function candlesFromSegment(
  points: PnlPoint[],
  bucketMs: number,
  spanForLabel: number,
): CandlePoint[] {
  if (points.length === 0) return [];
  const buckets = new Map<number, PnlPoint[]>();
  for (const p of points) {
    const key = alignBucketStart(p.ts, bucketMs);
    const list = buckets.get(key);
    if (list) list.push(p);
    else buckets.set(key, [p]);
  }

  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([bucketStart, samples]) => {
      const ordered = [...samples].sort((a, b) => a.ts - b.ts);
      const totals = ordered.map((s) => s.total);
      const open = ordered[0].total;
      const close = ordered[ordered.length - 1].total;
      return {
        ts: bucketStart,
        label: formatAxisTick(bucketStart, spanForLabel),
        open,
        high: Math.max(...totals),
        low: Math.min(...totals),
        close,
        total: close,
        isSwitch: false,
      };
    });
}

/** Bucket P&L samples into fixed-width OHLC candles on a single IST-aligned clock. */
export function bucketForCandles(points: PnlPoint[], liveAt: number | null = null): CandlePoint[] {
  if (points.length === 0) return [];
  const span = Math.max(points[points.length - 1].ts - points[0].ts, 1);
  const bucketMs = span > 4 * 3600 * 1000 ? 5 * 60 * 1000 : 60 * 1000;

  const sim = liveAt != null ? points.filter((p) => p.ts < liveAt) : points;
  const live = liveAt != null ? points.filter((p) => p.ts >= liveAt) : [];
  const simCandles = candlesFromSegment(sim, bucketMs, span);
  const liveCandles = candlesFromSegment(live, bucketMs, span);

  if (liveAt != null && simCandles.length > 0) {
    simCandles[simCandles.length - 1] = { ...simCandles[simCandles.length - 1], isSwitch: true };
  } else if (liveAt != null && liveCandles.length > 0) {
    liveCandles[0] = { ...liveCandles[0], isSwitch: true };
  }

  return [...simCandles, ...liveCandles];
}

export function formatAxisTick(ts: number, spanMs: number) {
  const d = new Date(ts);
  if (spanMs > 14 * 3600 * 1000) {
    return d.toLocaleString('en-IN', {
      timeZone: IST,
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
  return d.toLocaleTimeString('en-IN', {
    timeZone: IST,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatMoney(n: number) {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const POSITION_QTY_KEYS = [
  'net_qty', 'NetQty', 'netqty', 'position_qty',
  'qty', 'quantity', 'Quantity', 'QTY', 'Qty',
];

/** Open position. An explicit 0 is flat — do not replace it with filled/traded/order qty. */
export function pickPositionQty(row: Record<string, unknown> | null | undefined): number | undefined {
  if (!row) return undefined;
  for (const key of POSITION_QTY_KEYS) {
    if (!(key in row)) continue;
    const n = Number(row[key]);
    if (!Number.isFinite(n)) continue;
    return n;
  }
  return undefined;
}

export function normalizeSymbols(raw: unknown): Record<string, SymbolRow> {
  if (!raw || typeof raw !== 'object') return {};
  const mapped: Record<string, SymbolRow> = {};
  const entries = Array.isArray(raw)
    ? (raw as unknown[]).map((item) => {
        const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
        return [String(row.symbol ?? row.Symbol ?? ''), row] as const;
      })
    : Object.entries(raw as Record<string, unknown>);

  for (const [sym, data] of entries) {
    const key = String(sym || '').toUpperCase();
    if (!key) continue;
    const row = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
    const unrealized = Number(row.unrealized_pnl ?? row.live_unrealized_pnl ?? row.pnl ?? 0);
    const realized = Number(row.realized_pnl ?? 0);
    const qty = pickPositionQty(row);
    const side = row.side != null ? String(row.side) : undefined;
    mapped[key] = {
      unrealized_pnl: Number.isFinite(unrealized) ? unrealized : 0,
      realized_pnl: Number.isFinite(realized) ? realized : 0,
      qty,
      side,
    };
  }
  return mapped;
}

export function symbolNet(row: SymbolRow | undefined): { realized: number; unrealized: number; total: number } {
  if (!row) return { realized: 0, unrealized: 0, total: 0 };
  const realized = Number(row.realized_pnl) || 0;
  const unrealized = Number(row.unrealized_pnl) || 0;
  return { realized, unrealized, total: realized + unrealized };
}

export function carrySymbolMaps(points: PnlPoint[], liveAt: number | null = null): PnlPoint[] {
  const last: Record<string, SymbolRow> = {};
  let crossed = false;
  return points.map((p) => {
    if (liveAt != null && !crossed && p.ts >= liveAt) {
      crossed = true;
      for (const key of Object.keys(last)) delete last[key];
    }
    if (p.symbols) {
      for (const [k, v] of Object.entries(p.symbols)) last[k] = v;
    }
    return { ...p, symbols: { ...last, ...(p.symbols ?? {}) } };
  });
}

export function scopedPoint(p: PnlPoint, selected: Set<string>): PnlPoint {
  let realized = 0;
  let unrealized = 0;
  for (const sym of selected) {
    const part = symbolNet(p.symbols?.[sym]);
    realized += part.realized;
    unrealized += part.unrealized;
  }
  return { ...p, total: realized + unrealized, realized, unrealized };
}

export function ensureDrawable(points: PnlPoint[]): PnlPoint[] {
  if (points.length !== 1) return points;
  const p = points[0];
  return [{ ...p, ts: p.ts - 5 * 60 * 1000 }, p];
}

export function pnlSeriesFromLogs(
  logs: LogTickerHint[] | undefined,
  selected: Set<string> | null = null,
  resetAt: number | null = null,
): PnlPoint[] {
  if (!logs?.length) return [];
  const events: Array<{ ts: number; symbol: string; pnl: number }> = [];
  for (const row of logs) {
    const ts = parseChartTimeMs(row.chartTimeMs ?? row.timeMs);
    if (ts == null || !isPlausibleTs(ts)) continue;
    const pnl = Number(row.pnl);
    if (!Number.isFinite(pnl)) continue;
    const sym = String(row.symbol || '').toUpperCase();
    if (!sym || sym === '-') continue;
    if (selected && !selected.has(sym)) continue;
    events.push({ ts: roundTs(ts), symbol: sym, pnl });
  }
  events.sort((a, b) => a.ts - b.ts);
  const lastBySym = new Map<string, number>();
  const byTs = new Map<number, number>();
  let reset = false;
  for (const ev of events) {
    if (resetAt != null && !reset && ev.ts >= resetAt) {
      lastBySym.clear();
      reset = true;
    }
    lastBySym.set(ev.symbol, ev.pnl);
    let total = 0;
    for (const v of lastBySym.values()) total += v;
    byTs.set(ev.ts, total);
  }
  return Array.from(byTs.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([ts, total]) => ({ ts, total, realized: 0, unrealized: total }));
}

export function snapshotPoint(s: {
  sampled_at?: string;
  source_ts?: number;
  data: { total_pnl: number; realized_pnl: number; live_unrealized_pnl: number; symbols?: Record<string, unknown>; ts?: number };
}): PnlPoint | null {
  const ts = parseChartTimeMs(s.data?.ts)
    ?? parseChartTimeMs(s.source_ts)
    ?? parseChartTimeMs(s.sampled_at);
  if (ts == null || !isPlausibleTs(ts)) return null;
  const total = Number(s.data.total_pnl);
  if (!Number.isFinite(total)) return null;
  return {
    ts: roundTs(ts),
    total,
    realized: Number(s.data.realized_pnl) || 0,
    unrealized: Number(s.data.live_unrealized_pnl) || 0,
    symbols: normalizeSymbols(s.data.symbols),
  };
}

export function buildSyncedSeries(
  logs: LogTickerHint[] | undefined,
  snapshots: PnlPoint[],
  livePoint: PnlPoint | null,
  liveAt: number | null,
  selected: Set<string> | null = null,
): PnlPoint[] {
  const logSeries = pnlSeriesFromLogs(logs, selected, liveAt);
  const goodSnaps = carrySymbolMaps(snapshots.filter((p) => isPlausibleTs(p.ts)), liveAt);
  const lastSnapSymbols = goodSnaps[goodSnaps.length - 1]?.symbols;
  const live = livePoint && isPlausibleTs(livePoint.ts)
    ? { ...livePoint, symbols: { ...(lastSnapSymbols ?? {}), ...(livePoint.symbols ?? {}) } }
    : null;

  const remap = (pts: PnlPoint[]) => (selected ? pts.map((p) => scopedPoint(p, selected)) : pts);

  if (liveAt != null) {
    const simLogs = logSeries.filter((p) => p.ts < liveAt);
    const simSnaps = goodSnaps.filter((p) => p.ts < liveAt);
    // Morning segment is the tick history from before the handoff. Logs cover
    // sessions whose history no longer includes those snapshots.
    const sim = simSnaps.length > 0 ? mergeBySecond(simLogs, simSnaps) : simLogs;
    let livePts = remap(goodSnaps.filter((p) => p.ts >= liveAt - 60_000));
    if (live && live.ts >= liveAt - 60_000) {
      livePts = mergeBySecond(livePts, remap([live]));
    }
    if (livePts.length === 0) {
      livePts = logSeries.filter((p) => p.ts >= liveAt);
    }
    return ensureDrawable(downsamplePoints(mergeBySecond(sim, livePts), 220, liveAt));
  }

  let pts = remap(goodSnaps);
  if (live) pts = mergeBySecond(pts, remap([live]));
  if (pts.length === 0) pts = logSeries;
  return ensureDrawable(downsamplePoints(pts, 220, null));
}

export function inferLiveStartedAt(explicit: number | null | undefined, logs?: LogTickerHint[]): number | null {
  if (explicit != null && Number.isFinite(explicit) && isPlausibleTs(explicit)) return explicit;
  if (!logs?.length) return null;
  const liveTimes = logs
    .filter((r) => r.simulation === false)
    .map((r) => parseChartTimeMs(r.chartTimeMs ?? r.timeMs))
    .filter((n): n is number => n != null && isPlausibleTs(n));
  if (liveTimes.length === 0) return null;
  return Math.min(...liveTimes);
}
