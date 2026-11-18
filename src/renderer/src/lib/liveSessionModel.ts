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
