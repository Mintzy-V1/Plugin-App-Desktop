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
