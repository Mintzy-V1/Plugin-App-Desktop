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
