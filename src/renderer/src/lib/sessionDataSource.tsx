import { createContext, useContext } from 'react';
import { pluginApi, supportsExitedSymbols, supportsPyramidPnl } from './pluginApi';

type PluginApi = typeof pluginApi;

/**
 * Where the live session dashboard reads its data from. The default reads the
 * signed-in user's own session through the broker routes; the admin panel
 * provides one that reads any session through /api/v1/admin. Response shapes
 * are identical, so the dashboard components render either unchanged.
 */
export interface SessionDataSource {
  getDashboard: (sessionId: string) => ReturnType<PluginApi['getDashboard']>;
  getSessionStatus: PluginApi['getSessionStatus'];
  getSessionTrades: PluginApi['getSessionTrades'];
  getSessionById: PluginApi['getSessionById'];
  getPnlSummary: PluginApi['getPnlSummary'];
  getFullSessionState: (sessionId: string) => ReturnType<PluginApi['getFullSessionState']>;
  getLivePnl: PluginApi['getLivePnl'];
  getLivePnlHistory: PluginApi['getLivePnlHistory'];
  getPyramidPnl: PluginApi['getPyramidPnl'];
  getExitedSymbols: PluginApi['getExitedSymbols'];
  /** Error events: plain for the owner, raw for admins. `since` polls only what changed. */
  getSessionEvents: (sessionId: string, since?: string | null) => Promise<{ data: unknown }>;
  supportsPyramidPnl: () => boolean;
  supportsExitedSymbols: () => boolean;
  /** Viewer can't act on the session: hides stop, cancel-schedule, configure and CSV controls. */
  viewOnly: boolean;
}

export const ownerSessionDataSource: SessionDataSource = {
  getDashboard: (sessionId) => pluginApi.getDashboard(sessionId),
  getSessionStatus: (sessionId) => pluginApi.getSessionStatus(sessionId),
  getSessionTrades: (sessionId) => pluginApi.getSessionTrades(sessionId),
  getSessionById: (id) => pluginApi.getSessionById(id),
  getPnlSummary: (sessionId, year, month) => pluginApi.getPnlSummary(sessionId, year, month),
  // The owner route returns the user's latest session; the dashboard checks the id.
  getFullSessionState: () => pluginApi.getFullSessionState(),
  getLivePnl: (sessionId) => pluginApi.getLivePnl(sessionId),
  getLivePnlHistory: (sessionId, date, step) => pluginApi.getLivePnlHistory(sessionId, date, step),
  getPyramidPnl: (sessionId) => pluginApi.getPyramidPnl(sessionId),
  getExitedSymbols: (sessionId) => pluginApi.getExitedSymbols(sessionId),
  getSessionEvents: (sessionId, since) => pluginApi.getSessionEvents(sessionId, since),
  supportsPyramidPnl,
  supportsExitedSymbols,
  viewOnly: false,
};

const SessionDataSourceContext = createContext<SessionDataSource>(ownerSessionDataSource);

export const SessionDataSourceProvider = SessionDataSourceContext.Provider;

export function useSessionDataSource(): SessionDataSource {
  return useContext(SessionDataSourceContext);
}
