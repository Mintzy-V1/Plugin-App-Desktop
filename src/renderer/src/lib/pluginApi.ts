import api from './api';

export type BrokerKey = 'tradex' | 'bear_street' | 'angle_one';

/** Normalized broker key from the JWT onboard claim. */
export const getBrokerKey = (): BrokerKey => {
  try {
    const token = localStorage.getItem('mintzy_token');
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      // Broker comes from Mintzy API-key onboard, e.g. "angle one" | "tradex" | "bear street"
      const broker = String(payload.broker || '').toLowerCase().replace(/[\s_-]+/g, '');
      if (broker === 'tradex') return 'tradex';
      if (broker === 'bearstreet' || broker.includes('bear')) return 'bear_street';
    }
  } catch {}
  return 'angle_one';
};

/** All supported brokers expose the saved-configuration leverage endpoint. */
export const supportsLeverageMultiplier = () => true;

/** Angel One and Bear Street run the sim → live pyramid flow and expose pyramid P&L. */
export function supportsPyramidPnl(): boolean {
  const key = getBrokerKey();
  return key === 'bear_street' || key === 'angle_one';
}

const getBase = () => {
  const key = getBrokerKey();
  if (key === 'tradex') return '/api/v1/tradex';
  if (key === 'bear_street') return '/api/v1/bear_street';
  return '/api/v1/angle_one';
};

/** Angel One and Bear Street use /start-simulation; TradeX keeps /start. */
const getStartPath = () => {
  const key = getBrokerKey();
  const route = key === 'tradex' ? 'start' : 'start-simulation';
  return `${getBase()}/${route}`;
};

export type AngelCredentialsPayload = {
  api_key: string;
  client_code: string;
  password: string;
};

export type TradeXCredentialsPayload = {
  userId: string;
  access_key: string;
  access_secret: string;
  base_url?: string;
  token?: string;
};

export type BearStreetCredentialsPayload = {
  api_key: string;
  userId: string;
  client_code: string;
  password: string;
  second_auth: string;
  source?: string;
  base_url?: string;
};

export type CredentialsPayload =
  | AngelCredentialsPayload
  | TradeXCredentialsPayload
  | BearStreetCredentialsPayload;

export interface CredentialsResponse {
  success: boolean;
  session_id: string;
  status: string;
  requires_totp: boolean;
  node_session_id: string;
}

export interface StartPayload {
  session_id: string;
  saved_configuration_id?: string;
  strategy?: string;
  candle?: string;
  symbols?: { symbol: string; capital: number; stop_loss: number }[];
}

export interface LivePnlSymbol {
  unrealized_pnl: number;
  realized_pnl?: number;
  total_pnl?: number;
  qty?: number;
  ltp?: number;
  entry?: number;
  side?: string;
}

export interface LivePnlData {
  total_pnl: number;
  realized_pnl: number;
  live_unrealized_pnl: number;
  symbols: Record<string, LivePnlSymbol>;
  ts: number;
}

export interface LivePnlResponse {
  success: boolean;
  ready: boolean;
  data: LivePnlData | null;
  stopped: boolean;
  status: string | null;
}

export interface PnlSnapshot {
  sampled_at: string;
  source_ts?: number;
  market_date?: string;
  data: {
    total_pnl: number;
    realized_pnl: number;
    live_unrealized_pnl: number;
    symbols: Record<string, unknown>;
    ts?: number;
  };
}

export interface DashboardData {
  success: boolean;
  session_id: string;
  status: Record<string, unknown> | null;
  snapshot: Record<string, unknown> | null;
  logs: Record<string, unknown>[];
}

export interface SavedConfig {
  _id: string;
  name: string;
  description?: string;
  configuration: Record<string, unknown>;
  /** 1–5× position scale on this saved strategy. */
  leverage_multiplier?: number;
  created_at: string;
  updated_at?: string;
}

export interface TradingSession {
  _id: string;
  python_session_id: string;
  status: string;
  created_at: string;
  ended_at?: string;
  /** Present when the session ran a pre-live simulation (Angel One pyramid flow). */
  simulation_status?: string | null;
  simulation_started_at?: string | null;
  simulation_completed_at?: string | null;
  /** Cutoff: trades before this are simulation; at/after are live. */
  simulation_live_started_at?: string | null;
  simulation_live_switch_triggered?: boolean;
  simulation_trade_date?: string | null;
  configuration_name?: string | null;
}

export const pluginApi = {
  submitCredentials(payload: CredentialsPayload) {
    return api.post<CredentialsResponse>(`${getBase()}/credentials`, payload);
  },

  submitTotp(session_id: string, totp: string) {
    return api.post<{
      success: boolean;
      session_id: string;
      message?: string;
      free_cash?: number;
      account_info?: {
        user?: string;
        free_cash?: number;
        balance_details?: Record<string, unknown>;
      };
    }>(`${getBase()}/totp`, { session_id, totp });
  },

  startTrading(payload: StartPayload) {
    return api.post(getStartPath(), payload);
  },

  stopTrading(sessionId: string) {
    return api.post(`${getBase()}/stop/${sessionId}`);
  },

  stopSession(sessionId: string) {
    return api.post(`${getBase()}/sessions/${sessionId}/stop`);
  },

  /** Close a session that has not started trading (e.g. from the config form). */
  abandonSession(sessionId: string) {
    return api.post(`${getBase()}/trading/${sessionId}/abandon`);
  },

  adminStopSession(sessionId: string) {
    return api.post(`${getBase()}/admin/sessions/${sessionId}/stop`);
  },

  exitSymbol(sessionId: string, symbol: string) {
    return api.post(`${getBase()}/${sessionId}/exit-symbol/${symbol}`);
  },

  getActiveSession() {
    return api.get<{ success: boolean; session: TradingSession | null }>(`${getBase()}/trading/active-session`);
  },

  getSessions() {
    return api.get<{ success: boolean; sessions: TradingSession[] }>(`${getBase()}/trading/sessions`);
  },

  getSessionById(id: string) {
    return api.get(`${getBase()}/trading/sessions/${id}`);
  },

  deleteSession(id: string) {
    return api.delete(`${getBase()}/tradingsession/${id}`);
  },

  getPnlAggregate(year?: number, month?: number) {
    return api.get<Record<string, unknown>>(`${getBase()}/dashboard/pnl/aggregate`, { params: { year, month } });
  },

  getPnlSummary(sessionId: string, year?: number, month?: number) {
    return api.get(`${getBase()}/dashboard/pnl`, { params: { session_id: sessionId, year, month } });
  },

  getDashboard(sessionId?: string) {
    return api.get<DashboardData>(`${getBase()}/dashboard`, { params: { session_id: sessionId } });
  },

  /** Plugin DB session status document (object with nested `status`, optional `free_cash`). */
  getSessionStatus(sessionId: string) {
    return api.get<Record<string, unknown>>(`${getBase()}/sessions/${sessionId}/status`);
  },

  /** Live trade rows from the plugin engine (preferred for the Trade Logs tab). */
  getSessionTrades(sessionId: string) {
    return api.get<Record<string, unknown>[] | { logs?: Record<string, unknown>[]; rows?: Record<string, unknown>[] }>(
      `${getBase()}/sessions/${sessionId}/trades`
    );
  },

  /**
   * Full live session state from the plugin VM (status, snapshot, execution trades).
   * Uses the user's latest session on the gateway — caller should verify python_session_id.
   */
  getFullSessionState() {
    return api.get<{
      success?: boolean;
      python_session_id?: string;
      status?: Record<string, unknown> | null;
      snapshot?: Record<string, unknown> | null;
      logs?: Record<string, unknown>[];
    }>(`${getBase()}/session`);
  },

  /** Current live P&L, including per-symbol `data.symbols`. */
  getLivePnl(sessionId: string) {
    return api.get<LivePnlResponse>(`${getBase()}/trading/live-pnl/${sessionId}`);
  },

  /**
   * Saved snapshots for the session market date.
   * Each snapshot already includes `data.symbols` (per-ticker P&L) — the chart
   * filters/combines tickers on the client; there is no separate ticker endpoint.
   */
  getLivePnlHistory(sessionId: string, date?: string) {
    return api.get<{ success: boolean; snapshots: PnlSnapshot[] }>(
      `${getBase()}/trading/live-pnl/${sessionId}/history`,
      { params: { date } }
    );
  },

  /** Unrealized P&L at the 1 PM pyramid snapshot (Angel One + Bear Street). */
  getPyramidPnl(sessionId: string) {
    return api.get<Record<string, unknown>>(`${getBase()}/trading/pyramid-pnl/${sessionId}`);
  },

  downloadTradebook(sessionId: string) {
    return api.get<Blob>(`${getBase()}/trading/${sessionId}/final-tradebook`, { responseType: 'blob' });
  },

  /** Stored trading-logs CSV from the plugin DB (works for ended sessions). */
  downloadSessionLogs(sessionId: string) {
    return api.get<Blob>(`${getBase()}/sessions/${sessionId}/download`, { responseType: 'blob' });
  },

  getSavedConfigs() {
    return api.get<{ success: boolean; configurations: SavedConfig[] }>(`${getBase()}/saved-configurations`);
  },

  createSavedConfig(name: string, configuration: Record<string, unknown>, description?: string) {
    return api.post(`${getBase()}/saved-configurations`, { name, description, configuration });
  },

  updateSavedConfig(id: string, data: {
    name?: string;
    description?: string;
    configuration?: Record<string, unknown>;
  }) {
    return api.put(`${getBase()}/saved-configurations/${id}`, data);
  },

  deleteSavedConfig(id: string) {
    return api.delete(`${getBase()}/saved-configurations/${id}`);
  },

  /** Set leverage multiplier (1–5) on a saved configuration for the active broker. */
  setSavedConfigLeverage(configuration_id: string, leverage_multiplier: number) {
    return api.patch<{
      success: boolean;
      message?: string;
      configuration?: SavedConfig;
    }>(`${getBase()}/saved-configurations/leverage`, {
      configuration_id,
      leverage_multiplier,
    });
  },
};
