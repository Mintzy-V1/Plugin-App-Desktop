import { Plus, History, Trash2, Loader2, Bookmark, PanelLeftClose, PanelLeft } from 'lucide-react';
import type { TradingSession } from '../../lib/pluginApi';
import { sessionStatusLabel, isSimulationRunningStatus, simulationStatusLabel } from '../../lib/sessionStatus';

interface Props {
  sessions: TradingSession[];
  activeSessionId: string | null;
  onNewSession: () => void;
  onSelectSession: (session: TradingSession) => void;
  onSavedStrategies: () => void;
  onDeleteSession: (id: string) => void;
  deletingId: string | null;
  collapsed: boolean;
  onToggle: () => void;
}

function isSidebarLiveSession(s: TradingSession) {
  return (
    s.status === 'trading_active' ||
    s.status === 'authenticated' ||
    isSimulationRunningStatus(s.simulation_status)
  );
}

export default function PluginSidebar({
  sessions, activeSessionId, onNewSession, onSelectSession,
  onSavedStrategies, onDeleteSession, deletingId,
  collapsed, onToggle,
}: Props) {
  const liveSessions = sessions.filter(isSidebarLiveSession);
  const pastSessions = sessions.filter(s => !isSidebarLiveSession(s));
  const activeCount = sessions.filter(s => s.status === 'trading_active' || isSimulationRunningStatus(s.simulation_status)).length;

  const formatDate = (ds: string) => {
    const d = new Date(ds);
    return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  if (collapsed) {
    return (
      <aside className="flex w-12 shrink-0 flex-col items-center gap-1.5 border-r border-slate-200/70 bg-white py-2.5">
        <button
          type="button"
          onClick={onToggle}
          aria-label="Open sessions panel"
          title="Sessions"
          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
        >
          <PanelLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onNewSession}
          aria-label="New session"
          title="New session"
          className="rounded-lg bg-slate-900 p-2 text-white transition-colors hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onSavedStrategies}
          aria-label="Saved strategies"
          title="Saved strategies"
          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
        >
          <Bookmark className="h-4 w-4" aria-hidden="true" />
        </button>
        {activeCount > 0 && (
          <span className="mt-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white" title={`${activeCount} live`}>
            {activeCount}
          </span>
        )}
      </aside>
    );
  }

  return (
    <aside className="flex w-[240px] shrink-0 flex-col border-r border-slate-200/70 bg-white">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-100 px-2.5">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-slate-900">Sessions</p>
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
            {activeCount > 0 ? `${activeCount} live` : 'Idle'}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-label="Collapse sessions panel"
          title="Collapse"
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
        >
          <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-1.5 border-b border-slate-100 p-2.5">
        <button
          type="button"
          onClick={onNewSession}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
          New session
        </button>
        <button
          type="button"
          onClick={onSavedStrategies}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
        >
          <Bookmark className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          Saved strategies
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-2.5 py-2.5">
        <section>
          <div className="mb-2 flex items-center gap-1.5 px-1">
            <span className={`h-1.5 w-1.5 rounded-full ${liveSessions.length > 0 ? 'bg-emerald-500' : 'bg-slate-300'}`} aria-hidden="true" />
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Live</h3>
          </div>
          {liveSessions.length === 0 ? (
            <p className="px-1 text-[12px] text-slate-400">No active sessions</p>
          ) : (
            <div className="space-y-0.5">
              {liveSessions.map(s => {
                const isActive = activeSessionId === s.python_session_id;
                const simulating = isSimulationRunningStatus(s.simulation_status);
                return (
                  <button
                    key={s._id}
                    type="button"
                    onClick={() => onSelectSession(s)}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate text-[12px] font-medium">{formatDate(s.created_at)}</span>
                    <span className={`ml-2 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                      simulating
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {simulating ? (simulationStatusLabel(s.simulation_status) || 'Sim') : 'Live'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center gap-1.5 px-1">
            <History className="h-3 w-3 text-slate-400" aria-hidden="true" />
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">History</h3>
          </div>
          {pastSessions.length === 0 ? (
            <p className="px-1 text-[12px] text-slate-400">No previous sessions</p>
          ) : (
            <div className="space-y-0.5">
              {pastSessions.map(s => (
                <div
                  key={s._id}
                  className={`group flex items-center gap-1 rounded-lg px-1.5 py-1 ${
                    activeSessionId === s.python_session_id ? 'bg-emerald-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectSession(s)}
                    className="min-w-0 flex-1 rounded-md px-1 py-1.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
                  >
                    <span className="block truncate text-[12px] font-medium text-slate-600">{formatDate(s.created_at)}</span>
                    <span className="text-[10px] text-slate-400">{sessionStatusLabel(s.status)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteSession(s._id)}
                    disabled={deletingId === s._id}
                    aria-label={`Delete session from ${formatDate(s.created_at)}`}
                    title="Delete"
                    className="shrink-0 rounded-md p-1.5 text-slate-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-600 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 group-hover:opacity-100 disabled:opacity-50"
                  >
                    {deletingId === s._id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      : <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}
