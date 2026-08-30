import { pluginApi, type TradingSession } from './pluginApi';
import { isWaitAction } from './tradeSignals';
import { istDateKey } from './istClock';

export interface SessionTrade {
  sessionId: string;
  symbol: string;
  pnl: number;
  capital: number | null;
  timeMs: number;
  dateKey: string;
  simulation: boolean;
  wait: boolean;
}

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

function asBool(raw: unknown): boolean | null {
  if (typeof raw === 'boolean') return raw;
  if (raw === 'true' || raw === 1) return true;
  if (raw === 'false' || raw === 0) return false;
  return null;
}

function extractRows(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.rows)) return o.rows as Record<string, unknown>[];
    if (Array.isArray(o.logs)) return o.logs as Record<string, unknown>[];
    if (Array.isArray(o.data)) return o.data as Record<string, unknown>[];
  }
  return [];
}

function num(raw: unknown): number | null {
  if (raw == null || raw === '' || raw === '-' || raw === '—') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function tradesFromPayload(sessionId: string, raw: unknown): SessionTrade[] {
  const out: SessionTrade[] = [];
  for (const item of extractRows(raw)) {
    const r = item || {};
    const symbol = String(r.Symbol ?? r.symbol ?? '').toUpperCase().trim();
    if (!symbol || symbol === '-') continue;
    const timeMs = parseTradeTimeMs(r.logged_at ?? r.loggedAt ?? r.timestamp ?? r.time ?? r.Timestamp ?? r.Time);
    if (timeMs == null) continue;
    const pnl = num(r['P&L'] ?? r.PnL ?? r.pnl ?? r.unrealized_pnl ?? r.realized_pnl);
    if (pnl == null) continue;
    const sim = asBool(r.simulation_logs ?? r.simulationLogs ?? r.is_simulation);
    if (sim === true) continue;
    const action = String(r.Action_Status ?? r.Action ?? r.action ?? r.action_status ?? r.status ?? '');
    const signal = String(r.Signal ?? r.signal ?? r.side ?? r.Side ?? '');
    out.push({
      sessionId,
      symbol,
      pnl,
      capital: num(r['Total_Capital'] ?? r.TotalCapital ?? r.total_capital ?? r.capital ?? r.cash_balance ?? r.portfolio_cash_balance),
      timeMs,
      dateKey: istDateKey(timeMs),
      simulation: false,
      wait: isWaitAction(action) || isWaitAction(signal),
    });
  }
  return out;
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

export function sessionFingerprint(sessions: TradingSession[]): string {
  return sessions
    .map((s) => `${s._id}:${s.status}:${s.ended_at ?? ''}:${s.python_session_id}`)
    .sort()
    .join('|');
}

export async function loadSessionTrades(sessions: TradingSession[]): Promise<SessionTrade[]> {
  const withId = sessions.filter((s) => s.python_session_id);
  const batches = await mapPool(withId, 4, async (session) => {
    try {
      const res = await pluginApi.getSessionTrades(session.python_session_id);
      return tradesFromPayload(session.python_session_id, res.data);
    } catch {
      return [] as SessionTrade[];
    }
  });
  return batches.flat();
}
