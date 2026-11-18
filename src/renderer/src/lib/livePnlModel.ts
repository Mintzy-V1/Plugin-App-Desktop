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

export function formatMoney(n: number) {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const POSITION_QTY_KEYS = [
  'net_qty', 'NetQty', 'netqty', 'position_qty',
  'qty', 'quantity', 'Quantity', 'QTY', 'Qty',
];

export function symbolNet(row: SymbolRow | undefined): { realized: number; unrealized: number; total: number } {
  if (!row) return { realized: 0, unrealized: 0, total: 0 };
  const realized = Number(row.realized_pnl) || 0;
  const unrealized = Number(row.unrealized_pnl) || 0;
  return { realized, unrealized, total: realized + unrealized };
}
