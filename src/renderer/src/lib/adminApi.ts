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
    return adminHttp.post<{ success: boolean; message?: string }>(`/sessions/${enc(sessionId)}/stop`, { apiKey });
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
