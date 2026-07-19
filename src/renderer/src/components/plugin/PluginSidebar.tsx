import { useState } from 'react';
import { Plus, History, Trash2, Loader2, Bookmark, Menu } from 'lucide-react';
import type { TradingSession } from '../../lib/pluginApi';
import { sessionStatusLabel } from '../../lib/sessionStatus';

interface Props {
  sessions: TradingSession[];
  activeSessionId: string | null;
  onNewSession: () => void;
  onSelectSession: (session: TradingSession) => void;
  onSavedStrategies: () => void;
  onDeleteSession: (id: string) => void;
  deletingId: string | null;
}

export default function PluginSidebar({
  sessions, activeSessionId, onNewSession, onSelectSession,
  onSavedStrategies, onDeleteSession, deletingId,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const liveSessions = sessions.filter(s => s.status === 'trading_active' || s.status === 'authenticated');
  const pastSessions = sessions.filter(s => s.status !== 'trading_active' && s.status !== 'authenticated');

  const formatDate = (ds: string) => {
    const d = new Date(ds);
    return `${d.getDate()}/${d.getMonth() + 1} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const activeCount = sessions.filter(s => s.status === 'trading_active').length;

  if (collapsed) {
    return (
      <button onClick={() => setCollapsed(false)} aria-label="Expand session panel" title="Expand session panel"
        className="sticky top-0 flex items-center gap-2 self-start rounded-r-2xl border border-l-0 border-slate-200 bg-white pl-3 pr-4 py-2.5 text-slate-600 shadow-sm transition-colors hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40">
        <div className="rounded-lg bg-slate-100 p-1.5"><Menu className="h-5 w-5" aria-hidden="true" /></div>
      </button>
    );
  }

  return (
    <aside className="w-[280px] shrink-0 rounded-2xl border border-slate-200/80 bg-white shadow-sm flex flex-col h-[calc(100vh-7rem)] sticky top-0">
      <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 shrink-0">
        <div>
          <p className="font-bold text-slate-900 tracking-tight">Mintzy Terminal</p>
          {activeCount > 0 ? (
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">
              {activeCount} live session{activeCount > 1 ? 's' : ''}
            </p>
          ) : (
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Idle</p>
          )}
        </div>
        <button onClick={() => setCollapsed(true)} aria-label="Collapse session panel" title="Collapse session panel"
          className="p-1.5 -mr-1.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40">
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="p-4 border-b border-slate-100 shrink-0">
        <button onClick={onNewSession}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30">
          <Plus className="h-4 w-4" strokeWidth={3} aria-hidden="true" /> New Session
        </button>
      </div>

      <div className="px-4 pb-4 border-b border-slate-100 shrink-0">
        <button onClick={onSavedStrategies}
          className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition-colors hover:border-slate-300 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40">
          <div className="rounded-lg bg-white p-2"><Bookmark className="h-4 w-4 text-slate-600" aria-hidden="true" /></div>
          <div>
            <p className="text-sm font-semibold text-slate-700">Pre-Saved Strategies</p>
            <p className="text-[11px] text-slate-500">Build and reuse market-ready setups</p>
          </div>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        <div>
          <div className="flex items-center gap-2 px-1 mb-3">
            <div className={`h-1.5 w-1.5 rounded-full ${liveSessions.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} aria-hidden="true" />
            <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Live Sessions</h3>
          </div>
          {liveSessions.length === 0 ? (
            <p className="px-1 text-[11px] italic text-slate-400">No active sessions</p>
          ) : (
            <div className="space-y-1">
              {liveSessions.map(s => (
                <button key={s._id} onClick={() => onSelectSession(s)}
                  className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
                    activeSessionId === s.python_session_id
                      ? 'bg-blue-50 font-bold text-blue-700 shadow-sm ring-1 ring-blue-100'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}>
                  <span className="font-mono text-xs">{formatDate(s.created_at)}</span>
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-tighter text-emerald-700">Live</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 px-1 mb-3">
            <History className="h-3.5 w-3.5 text-slate-400" />
            <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">History</h3>
          </div>
          {pastSessions.length === 0 ? (
            <p className="px-1 text-[11px] italic text-slate-400">No previous records</p>
          ) : (
            <div className="space-y-1">
              {pastSessions.map(s => (
                <div key={s._id} className={`flex items-center gap-1 rounded-xl px-3 py-2 text-sm transition-all ${
                  activeSessionId === s.python_session_id ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-500 hover:bg-slate-50'
                }`}>
                  <button onClick={() => onSelectSession(s)}
                    className="min-w-0 flex-1 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40">
                    <span className="font-mono text-xs">{formatDate(s.created_at)}</span>
                    <span className="ml-2 text-[9px] font-bold uppercase tracking-tight text-slate-400">{sessionStatusLabel(s.status)}</span>
                  </button>
                  <button onClick={() => onDeleteSession(s._id)} disabled={deletingId === s._id}
                    aria-label={`Delete session from ${formatDate(s.created_at)}`} title="Delete session"
                    className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 disabled:opacity-50">
                    {deletingId === s._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
