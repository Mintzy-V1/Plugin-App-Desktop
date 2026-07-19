import { useState } from 'react';
import { Plus, History, Trash2, Loader2, Bookmark, Menu } from 'lucide-react';
import { pluginApi } from '../../lib/pluginApi';
import type { TradingSession } from '../../lib/pluginApi';

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

  if (collapsed) {
    return (
      <button onClick={() => setCollapsed(false)}
        className="sticky top-24 flex items-center gap-2 rounded-r-2xl border border-l-0 border-slate-200 bg-white pl-3 pr-4 py-2.5 text-slate-600 shadow-sm transition-colors hover:text-slate-900">
        <div className="rounded-lg bg-slate-100 p-1.5"><Menu className="h-5 w-5" /></div>
      </button>
    );
  }

  return (
    <aside className="w-[280px] shrink-0 rounded-2xl border border-slate-200/80 bg-white shadow-sm flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 shrink-0">
        <div>
          <p className="font-bold text-slate-900 tracking-tight">Mintzy Terminal</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">Active Engine</p>
        </div>
        <button onClick={() => setCollapsed(true)} className="p-1.5 -mr-1.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-900">
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <div className="p-4 border-b border-slate-100 shrink-0">
        <button onClick={onNewSession}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800">
          <Plus className="h-4 w-4" strokeWidth={3} /> New Session
        </button>
      </div>

      <div className="px-4 pb-4 border-b border-slate-100 shrink-0">
        <button onClick={onSavedStrategies}
          className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition-colors hover:border-slate-300 hover:bg-white">
          <div className="rounded-lg bg-white p-2"><Bookmark className="h-4 w-4 text-slate-600" /></div>
          <div>
            <p className="text-sm font-semibold text-slate-700">Pre-Saved Strategies</p>
            <p className="text-[11px] text-slate-500">Build and reuse market-ready setups</p>
          </div>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        <div>
          <div className="flex items-center gap-2 px-1 mb-3">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Live Sessions</h3>
          </div>
          {liveSessions.length === 0 ? (
            <p className="px-1 text-[11px] italic text-slate-400">No active sessions</p>
          ) : (
            <div className="space-y-1">
              {liveSessions.map(s => (
                <button key={s._id} onClick={() => onSelectSession(s)}
                  className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-all ${
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
                  <button onClick={() => onSelectSession(s)} className="min-w-0 flex-1 text-left">
                    <span className="font-mono text-xs">{formatDate(s.created_at)}</span>
                    <span className="ml-2 text-[9px] font-bold uppercase tracking-tight text-slate-400">{s.status.split('_')[0]}</span>
                  </button>
                  <button onClick={() => onDeleteSession(s._id)} disabled={deletingId === s._id}
                    className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
                    {deletingId === s._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
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
