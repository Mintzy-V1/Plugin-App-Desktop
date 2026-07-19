import api from './api';

const BASE = '/api/v1/angle_one';

export interface CredentialsPayload {
  api_key: string;
  client_code: string;
  password: string;
}

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

export interface LivePnlData {
  total_pnl: number;
  realized_pnl: number;
  live_unrealized_pnl: number;
  symbols: Record<string, { unrealized_pnl: number; realized_pnl: number }>;
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
  data: {
    total_pnl: number;
    realized_pnl: number;
    live_unrealized_pnl: number;
    symbols: Record<string, unknown>;
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
  created_at: string;
}

export interface TradingSession {
  _id: string;
  python_session_id: string;
  status: string;
  created_at: string;
  ended_at?: string;
}

export const pluginApi = {
  submitCredentials(payload: CredentialsPayload) {
    return api.post<CredentialsResponse>(`${BASE}/credentials`, payload);
  },

  submitTotp(session_id: string, totp: string) {
    return api.post(`${BASE}/totp`, { session_id, totp });
  },

  startTrading(payload: StartPayload) {
    return api.post(`${BASE}/start`, payload);
  },

  stopTrading(sessionId: string) {
    return api.post(`${BASE}/stop/${sessionId}`);
  },

  stopSession(sessionId: string) {
    return api.post(`${BASE}/sessions/${sessionId}/stop`);
  },

  adminStopSession(sessionId: string) {
    return api.post(`${BASE}/admin/sessions/${sessionId}/stop`);
  },

  exitSymbol(sessionId: string, symbol: string) {
    return api.post(`${BASE}/${sessionId}/exit-symbol/${symbol}`);
  },

  getActiveSession() {
    return api.get<{ success: boolean; session: TradingSession | null }>(`${BASE}/trading/active-session`);
  },

  getSessions() {
    return api.get<{ success: boolean; sessions: TradingSession[] }>(`${BASE}/trading/sessions`);
  },

  getSessionById(id: string) {
    return api.get(`${BASE}/trading/sessions/${id}`);
  },

  deleteSession(id: string) {
    return api.delete(`${BASE}/tradingsession/${id}`);
  },

  getDashboard(sessionId?: string) {
    return api.get<DashboardData>(`${BASE}/dashboard`, { params: { session_id: sessionId } });
  },

  getLivePnl(sessionId: string) {
    return api.get<LivePnlResponse>(`${BASE}/trading/live-pnl/${sessionId}`);
  },

  getLivePnlHistory(sessionId: string, date?: string) {
    return api.get<{ success: boolean; snapshots: PnlSnapshot[] }>(
      `${BASE}/trading/live-pnl/${sessionId}/history`,
      { params: { date } }
    );
  },

  downloadTradebook(sessionId: string) {
    return api.get<Blob>(`${BASE}/trading/${sessionId}/final-tradebook`, { responseType: 'blob' });
  },

  getSavedConfigs() {
    return api.get<{ success: boolean; configurations: SavedConfig[] }>(`${BASE}/saved-configurations`);
  },

  createSavedConfig(name: string, configuration: Record<string, unknown>, description?: string) {
    return api.post(`${BASE}/saved-configurations`, { name, description, configuration });
  },

  updateSavedConfig(id: string, data: Partial<SavedConfig>) {
    return api.put(`${BASE}/saved-configurations/${id}`, data);
  },

  deleteSavedConfig(id: string) {
    return api.delete(`${BASE}/saved-configurations/${id}`);
  },
};
