import axios from 'axios';
import type { SessionEvent } from './sessionEvents';
import type { SessionDataSource } from './sessionDataSource';
import type { DashboardData, LivePnlResponse, PnlSnapshot, TradingSession } from './pluginApi';

const API_BASE = import.meta.env.VITE_API_URL || 'https://gateway.mintzy.in';
const TOKEN_KEY = 'mintzy_admin_token';

/**
 * Admin token: kept in memory and sessionStorage only (gone when the app
 * closes), never localStorage, and separate from the user token so the user
 * client's refresh logic never sees it. The admin key itself is never stored.
 */
let adminToken: string | null = (() => {
  try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
})();

export function getAdminToken(): string | null {
  return adminToken;
}

export function setAdminToken(token: string | null): void {
  adminToken = token;
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}

export const ADMIN_EXPIRED_EVENT = 'admin:expired';

/** Stop waits for the square-off; the gateway allows 150s, so the app waits a little longer. */
const STOP_TIMEOUT_MS = 160000;

const adminHttp = axios.create({ baseURL: `${API_BASE}/api/v1/admin`, timeout: 60000 });

adminHttp.interceptors.request.use((config) => {
  if (adminToken) config.headers.Authorization = `Bearer ${adminToken}`;
  return config;
});

adminHttp.interceptors.response.use(
  (res) => res,
  (error) => {
    // No refresh for admin tokens: an expired or revoked token ends the admin session.
    if (error.response?.status === 401 && !error.config?.url?.endsWith('/login')) {
      setAdminToken(null);
      window.dispatchEvent(new CustomEvent(ADMIN_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  },
);

// --- Types --------------------------------------------------------------------

export type AdminRole = 'admin' | 'master';
export type AdminBroker = 'angle_one' | 'tradex' | 'bear_street' | 'firstock';
export type SessionPhase = 'live' | 'simulation' | 'scheduled';

export interface AdminLoginResponse {
  success: boolean;
  token: string;
  expiresAt: string;
  role: AdminRole;
  name: string;
}

export interface AdminUserSummary {
  _id: string;
  name: string;
  email: string;
  broker?: string | null;
  isActive?: boolean;
}

export interface OverviewSession {
  session_id: string;
  node_session_id: string;
  broker: AdminBroker | null;
  status: string;
  simulation_status: string | null;
  phase: SessionPhase;
  configuration_name: string | null;
  created_at: string;
  live_started_at: string | null;
  scheduled_start_at: string | null;
  user: AdminUserSummary | null;
  pnl: {
    total: number;
    realized: number;
    unrealized: number;
    open_positions: number;
    symbols: number;
    sampled_at: string;
    age_seconds: number;
  } | null;
  stale: boolean;
  /** Critical / error events in the last hour (gateway: session_events) */
  problems?: { critical: number; error: number; last_at: string | null };
}

export interface OverviewResponse {
  success: boolean;
  generated_at: string;
  market_date: string;
  totals: {
    sessions: number;
    live: number;
    simulation: number;
    scheduled: number;
    total_pnl: number;
    realized_pnl: number;
    unrealized_pnl: number;
  };
  sessions: OverviewSession[];
}

export interface AdminAccount extends AdminUserSummary {
  createdAt?: string;
  lastLogin?: string;
  session_count: number;
  live_session_count: number;
  last_session_at: string | null;
}

export interface AdminSession extends TradingSession {
  broker?: AdminBroker;
  phase: SessionPhase;
  scheduled_start?: { status?: string; start_at?: string } | null;
}

export interface AdminKey {
  _id: string;
  name: string;
  email: string | null;
  keyPrefix: string;
  createdBy: string;
  createdAt: string;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  revokedAt: string | null;
}

export interface AuditEntry {
  _id: string;
  at: string;
  role: AdminRole | null;
  adminKeyId: string | null;
  adminName?: string;
  action?: string;
  ip?: string;
  method: string;
  path: string;
  query?: Record<string, unknown>;
  targetUserId: string | null;
  targetSessionId: string | null;
  status: number;
  detail?: string;
}

/** One symbol of the signal service's 13:00 capital pyramid (gateway: signalPyramid.service). */
export type SignalPyramidStatus = 'live' | 'not_opened' | 'dropped';

export interface SignalPyramidSymbol {
  symbol: string;
  rank: number | null;
  /** live: given capital and opened at 13:00; not_opened: given capital, not opened (out for the day); dropped: no capital. */
  status: SignalPyramidStatus;
  status_reason: string | null;
  /** Capital given at 13:00 (0 when dropped). */
  capital: number;
  /** Pyramid shares (EXP104); null for the threshold strategy, which sizes by capital only. */
  qty: number | null;
  stop_loss: number | null;
  price_1300: number | null;
  group: string | null;
  position_status: string | null;
  exit_reason: string | null;
  morning_capital: number | null;
  realized_pnl: number | null;
  unrealized_pnl: number | null;
  total_pnl: number | null;
  profit_threshold: number | null;
  is_profitable: boolean | null;
  /** From the end-of-day summary: P&L from the 13:00 handoff (null when it did not trade the afternoon). */
  afternoon_pnl: number | null;
  full_day_pnl: number | null;
  afternoon_traded: boolean | null;
  // The research sizing: sent to the master key only (detail === 'full').
  score?: number | null;
  trajectory_status?: string | null;
  desired_pyramid?: number | null;
  sizing?: Record<string, string | number | boolean | null> | null;
}

export interface SignalDeliveryIssue {
  symbol: string | null;
  seq: number | null;
  action: string | null;
  status: string | null;
  http_status: number | null;
  /** The counterparty's error text: master key only (null for other admins). */
  error: string | null;
}

export interface SignalDelivery {
  dest: string;
  dry_run: boolean | null;
  /** Outbox rows by status: sent, dead, unknown, expired, skipped, superseded, pending, inflight (still open at the close). */
  counts: Record<string, number>;
  issues: SignalDeliveryIssue[];
}

/** The day's result at close (paper, before costs); null before the square-off. */
export interface SignalDayResults {
  recorded_at: string | null;
  source: string | null;
  basis: string | null;
  signals: number | null;
  full_day_pnl: number | null;
  /** From the 13:00 handoff (EXP104); null on rank-threshold days. */
  afternoon_pnl: number | null;
  morning_pnl: number | null;
  delivery: SignalDelivery[];
  issue_count: number;
}

export interface SignalPyramidTotals {
  evaluated: number;
  allocated: number;
  live: number;
  not_opened: number;
  dropped: number;
  allocated_capital: number;
  live_capital: number;
}

export interface SignalPyramidDaySummary {
  date: string;
  feed: string;
  recorded_at: string | null;
  /** False for a day with only an end-of-day summary: the 13:00 pyramid saved nothing. */
  pyramid_recorded: boolean;
  /** 'exp104' | 'threshold', or null when the record does not say. */
  strategy: string | null;
  applied: boolean;
  live_allowed: boolean;
  reason: string | null;
  account: number | null;
  /** account / research reference mean: master key only. */
  account_scale?: number | null;
  totals: SignalPyramidTotals;
}

export interface SignalPyramidDay extends SignalPyramidDaySummary {
  /** 'full' for the master key (research sizing included), 'summary' for other admins. */
  detail: 'full' | 'summary';
  results: SignalDayResults | null;
  symbols: SignalPyramidSymbol[];
}

export interface SignalPyramidDayListItem extends SignalPyramidDaySummary {
  results: Pick<SignalDayResults, 'recorded_at' | 'full_day_pnl' | 'afternoon_pnl' | 'morning_pnl' | 'issue_count'> | null;
  /** Names given capital (live and not opened). */
  allocated_symbols: { symbol: string; status: SignalPyramidStatus; capital: number; qty: number | null }[];
}

/** Live status of the signal service (gateway: signalStatus.service, from the service's /api/status). */
export interface SignalLivePosition {
  symbol: string;
  side: 'LONG' | 'SHORT' | null;
  qty: number | null;
  avg_price: number | null;
  ltp: number | null;
  unrealized_pnl: number | null;
}

export type SignalLiveStatus =
  | { configured: false }
  | { configured: true; reachable: false; checked_at: string; error?: string }
  | {
    configured: true;
    reachable: true;
    checked_at: string;
    status: 'ok' | 'error' | null;
    phase: 'starting' | 'idle' | 'waiting' | 'warmup' | 'running' | 'stopped' | 'error' | null;
    /** Free text from the service: master key only. */
    detail: string | null;
    day: string | null;
    session_id: string | null;
    service_time: string | null;
    trader_alive: boolean | null;
    tick_source: string | null;
    seconds_since_last_tick: number | null;
    feed_stale: boolean | null;
    ticks: number | null;
    signals_emitted: number | null;
    signals_dropped: number | null;
    sink_errors: number | null;
    outbox_open: number | null;
    restarts: number | null;
    uptime_seconds: number | null;
    rms_triggered: boolean | null;
    eod_exit_done: boolean | null;
    realized_pnl: number | null;
    unrealized_pnl: number | null;
    destinations: { name: string; dry_run: boolean | null; sent: number | null; failed: number | null; consecutive_failures: number | null }[];
    pyramid: { live_allowed: boolean | null; reason: string | null; live_symbols: string[]; removed: string[] } | null;
    positions: SignalLivePosition[];
  };

interface Paged {
  page: number;
  limit: number;
  total: number;
}

// --- API ----------------------------------------------------------------------

const enc = encodeURIComponent;

export const adminApi = {
  login(key: string) {
    return adminHttp.post<AdminLoginResponse>('/login', { key });
  },
  me() {
    return adminHttp.get<{ success: boolean; role: AdminRole; name: string }>('/me');
  },
  getOverview(includeStale = false) {
    return adminHttp.get<OverviewResponse>('/overview', { params: includeStale ? { include_stale: 1 } : undefined });
  },
  listUsers(params: { search?: string; broker?: string; page?: number; limit?: number }) {
    return adminHttp.get<Paged & { success: boolean; users: AdminAccount[] }>('/users', { params });
  },
  /** One account's raw error events across its sessions (default: last 7 days). */
  getUserEvents(userId: string, params: { from?: string; to?: string; severity?: string; code?: string; session_id?: string; page?: number; limit?: number } = {}) {
    return adminHttp.get<Paged & { success: boolean; events: SessionEvent[]; from: string; to: string }>(
      `/users/${enc(userId)}/events`,
      { params },
    );
  },
  getUser(userId: string) {
    return adminHttp.get<{ success: boolean; user: AdminAccount; sessions: AdminSession[] }>(`/users/${enc(userId)}`);
  },
  getSession(sessionId: string) {
    return adminHttp.get<{ success: boolean; broker: AdminBroker; session: AdminSession; user: AdminAccount | null }>(
      `/sessions/${enc(sessionId)}`,
    );
  },
  /**
   * Stop a session or exit one of its symbols. Both need the account's own
   * Mintzy API key, which the gateway checks against the session's owner. The
   * key is sent once in the body and never stored.
   */
  stopSession(sessionId: string, apiKey: string) {
    // A Stop squares off first (the plugin can wait up to 60s for exit fills)
    return adminHttp.post<{ success: boolean; message?: string }>(`/sessions/${enc(sessionId)}/stop`, { apiKey }, { timeout: STOP_TIMEOUT_MS });
  },
  exitSymbol(sessionId: string, symbol: string, apiKey: string) {
    return adminHttp.post<{ success: boolean; symbol: string; message?: string }>(
      `/sessions/${enc(sessionId)}/exit-symbol/${enc(symbol)}`,
      { apiKey },
    );
  },
  listKeys() {
    return adminHttp.get<{ success: boolean; keys: AdminKey[] }>('/keys');
  },
  createKey(name: string, email?: string) {
    return adminHttp.post<{ success: boolean; key: string; adminKey: AdminKey }>('/keys', { name, email: email || undefined });
  },
  revokeKey(id: string) {
    return adminHttp.post<{ success: boolean; adminKey: AdminKey }>(`/keys/${enc(id)}/revoke`);
  },
  listAudit(params: { adminKeyId?: string; from?: string; to?: string; page?: number; limit?: number }) {
    return adminHttp.get<Paged & { success: boolean; entries: AuditEntry[] }>('/audit', { params });
  },
  /** The signal service's recent pyramid days, newest first. */
  listSignalPyramidDays(limit = 30) {
    return adminHttp.get<{ success: boolean; feed: string; days: SignalPyramidDayListItem[]; skipped: number }>('/signal/pyramid', { params: { limit } });
  },
  /** The signal service's live status ({configured: false} when the gateway is not connected to it). */
  getSignalStatus() {
    return adminHttp.get<{ success: boolean; status: SignalLiveStatus }>('/signal/status');
  },
  /** One day's pyramid book (YYYY-MM-DD). 404 when the service recorded nothing that day. */
  getSignalPyramidDay(date: string) {
    return adminHttp.get<{ success: boolean; day: SignalPyramidDay }>(`/signal/pyramid/${enc(date)}`);
  },
};

/** Brokers that run the simulation → live pyramid flow (mirrors pluginApi.supportsPyramidPnl). */
const PYRAMID_BROKERS: AdminBroker[] = ['angle_one', 'bear_street', 'firstock'];

/**
 * Session data source for the live dashboard components, reading any user's
 * session through the admin API. Pyramid support follows the session's broker,
 * not the (absent) user JWT.
 */
export function createAdminSessionSource(broker: AdminBroker | null | undefined): SessionDataSource {
  const pyramid = broker != null && PYRAMID_BROKERS.includes(broker);
  const path = (sessionId: string, suffix = '') => `/sessions/${enc(sessionId)}${suffix}`;

  return {
    getDashboard: (sessionId) => adminHttp.get<DashboardData>(path(sessionId, '/dashboard')),
    getSessionStatus: (sessionId) => adminHttp.get<Record<string, unknown>>(path(sessionId, '/status')),
    getSessionTrades: (sessionId) => adminHttp.get(path(sessionId, '/trades')),
    getSessionById: (id) => adminHttp.get(path(id)),
    getPnlSummary: (sessionId, year, month) => adminHttp.get(path(sessionId, '/pnl'), { params: { year, month } }),
    getFullSessionState: (sessionId) => adminHttp.get(path(sessionId, '/state')),
    getLivePnl: (sessionId) => adminHttp.get<LivePnlResponse>(path(sessionId, '/live-pnl')),
    getLivePnlHistory: (sessionId, date, step) =>
      adminHttp.get<{ success: boolean; snapshots: PnlSnapshot[] }>(path(sessionId, '/live-pnl/history'), { params: { date, step } }),
    getPyramidPnl: (sessionId) => adminHttp.get<Record<string, unknown>>(path(sessionId, '/pyramid-pnl')),
    getExitedSymbols: (sessionId) => adminHttp.get(path(sessionId, '/exited-symbols')),
    getSessionEvents: (sessionId, since) => adminHttp.get(path(sessionId, '/events'), { params: { since: since || undefined } }),
    supportsPyramidPnl: () => pyramid,
    supportsExitedSymbols: () => pyramid,
    viewOnly: true,
  };
}
