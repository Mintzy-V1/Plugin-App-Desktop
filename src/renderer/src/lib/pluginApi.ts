import api from './api';

const getBase = () => {
  try {
    const token = localStorage.getItem('mintzy_token');
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.broker === 'tradex') return '/api/v1/tradex';
    }
  } catch {}
  return '/api/v1/angle_one';
};

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
    return api.post<CredentialsResponse>(`${getBase()}/credentials`, payload);
  },

  submitTotp(session_id: string, totp: string) {
    return api.post(`${getBase()}/totp`, { session_id, totp });
  },

  startTrading(payload: StartPayload) {
    return api.post(`${getBase()}/start`, payload);
  },

  stopTrading(sessionId: string) {
    return api.post(`${getBase()}/stop/${sessionId}`);
  },

  stopSession(sessionId: string) {
    return api.post(`${getBase()}/sessions/${sessionId}/stop`);
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

  getLivePnl(sessionId: string) {
    return api.get<LivePnlResponse>(`${getBase()}/trading/live-pnl/${sessionId}`);
  },

  getLivePnlHistory(sessionId: string, date?: string) {
    return api.get<{ success: boolean; snapshots: PnlSnapshot[] }>(
      `${getBase()}/trading/live-pnl/${sessionId}/history`,
      { params: { date } }
    );
  },

  downloadTradebook(sessionId: string) {
    return api.get<Blob>(`${getBase()}/trading/${sessionId}/final-tradebook`, { responseType: 'blob' });
  },

  getSavedConfigs() {
    return api.get<{ success: boolean; configurations: SavedConfig[] }>(`${getBase()}/saved-configurations`);
  },

  createSavedConfig(name: string, configuration: Record<string, unknown>, description?: string) {
    return api.post(`${getBase()}/saved-configurations`, { name, description, configuration });
  },

  updateSavedConfig(id: string, data: Partial<SavedConfig>) {
    return api.put(`${getBase()}/saved-configurations/${id}`, data);
  },

  deleteSavedConfig(id: string) {
    return api.delete(`${getBase()}/saved-configurations/${id}`);
  },
};
