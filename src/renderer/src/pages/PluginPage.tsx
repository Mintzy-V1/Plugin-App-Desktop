import { useState, useEffect } from 'react';
import { Code2, Plus } from 'lucide-react';
import ConnectBrokerForm, { type BrokerType } from '../components/plugin/ConnectBrokerForm';
import TwoFactorAuth from '../components/plugin/TwoFactorAuth';
import SessionConfigForm from '../components/plugin/SessionConfigForm';
import LiveSessionDashboard from '../components/plugin/LiveSessionDashboard';
import PluginSidebar from '../components/plugin/PluginSidebar';
import SavedStrategiesView from '../components/plugin/SavedStrategiesView';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';
import { pluginApi } from '../lib/pluginApi';
import type { TradingSession } from '../lib/pluginApi';

type PluginView = 'empty' | 'broker' | '2fa' | 'config' | 'dashboard' | 'saved';

export default function PluginPage() {
  const toast = useToast();
  const [view, setView] = useState<PluginView>('empty');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<TradingSession[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TradingSession | null>(null);
  const [quickStarting, setQuickStarting] = useState(false);

  const fetchSessions = () => {
    pluginApi.getSessions().then(res => setSessions(res.data.sessions || [])).catch(() => {
      toast.error('Could not load your sessions');
    });
  };

  useEffect(() => { fetchSessions(); }, []);

  const handleBrokerSuccess = (sid: string, reqTotp: boolean, _bt: BrokerType) => {
    setSessionId(sid); setView(reqTotp ? '2fa' : 'config');
  };

  const handleSelectSession = (s: TradingSession) => {
    if (s.status === 'trading_active') {
      setSessionId(s.python_session_id);
      setView('dashboard');
    } else if (s.status === 'authenticated') {
      setSessionId(s.python_session_id);
      setView('config');
    } else {
      toast.info('This session has ended. Download its tradebook from the Dashboard.');
    }
  };

  const confirmDeleteSession = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setDeletingId(target._id);
    try {
      await pluginApi.deleteSession(target._id);
      toast.success('Session deleted');
      fetchSessions();
    } catch {
      toast.error('Could not delete the session. Please try again.');
    }
    setDeletingId(null);
    setPendingDelete(null);
  };

  const handleUseSavedConfig = (configId: string, _config: Record<string, unknown>) => {
    if (!sessionId || quickStarting) return;
    setQuickStarting(true);
    pluginApi.startTrading({ session_id: sessionId, saved_configuration_id: configId })
      .then(() => {
        toast.success('Trading started from saved strategy');
        setView('dashboard');
        fetchSessions();
      })
      .catch((err: any) => {
        toast.error(err?.response?.data?.message || 'Could not start trading from this strategy');
      })
      .finally(() => setQuickStarting(false));
  };

  const sidebar = (
    <PluginSidebar sessions={sessions} activeSessionId={sessionId}
      onNewSession={() => { setSessionId(null); setView('broker'); }}
      onSelectSession={handleSelectSession}
      onSavedStrategies={() => setView('saved')}
      onDeleteSession={id => {
        const s = sessions.find(x => x._id === id);
        if (s) setPendingDelete(s);
      }}
      deletingId={deletingId} />
  );

  return (
    <div className="flex gap-6">
      {sidebar}
      <div className="min-w-0 flex-1">
        <div key={view} className="animate-fade-in">
          {view === 'dashboard' && sessionId && (
            <LiveSessionDashboard sessionId={sessionId}
              onStop={() => { setView('empty'); fetchSessions(); }}
              onConfigure={() => setView('config')} />
          )}
          {view === 'broker' && (
            <div className="flex min-h-[600px] items-center justify-center">
              <ConnectBrokerForm onSuccess={handleBrokerSuccess} onBack={() => setView('empty')} />
            </div>
          )}
          {view === '2fa' && sessionId && (
            <div className="flex min-h-[600px] items-center justify-center">
              <TwoFactorAuth sessionId={sessionId} onSuccess={() => setView('config')} onBack={() => setView('broker')} />
            </div>
          )}
          {view === 'config' && sessionId && (
            <div className="flex min-h-[600px] items-center justify-center">
              <SessionConfigForm sessionId={sessionId} onSuccess={() => { setView('dashboard'); fetchSessions(); }} onBack={() => setView('2fa')} />
            </div>
          )}
          {view === 'saved' && (
            <SavedStrategiesView sessionId={sessionId} onUseConfig={handleUseSavedConfig}
              quickStarting={quickStarting}
              onBack={() => setView(sessionId ? 'dashboard' : 'empty')} />
          )}
          {view === 'empty' && (
            <div className="flex min-h-[600px] flex-col items-center justify-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20">
                <Code2 className="h-8 w-8 text-white" aria-hidden="true" />
              </div>
              <h2 className="mt-6 text-xl font-bold text-slate-900">Plugin Terminal</h2>
              <p className="mt-2 text-sm text-slate-500">Connect broker credentials to start automated trading</p>
              <button onClick={() => setView('broker')}
                className="mt-8 flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition-all hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30">
                <Plus className="h-4 w-4" aria-hidden="true" /> New Session
              </button>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog open={!!pendingDelete} title="Delete session?"
        description={<>This will permanently remove this session and its history from the list. The tradebook CSV will no longer be downloadable from here.</>}
        confirmLabel="Delete" tone="danger" busy={!!deletingId}
        onConfirm={confirmDeleteSession} onCancel={() => { if (!deletingId) setPendingDelete(null); }} />
    </div>
  );
}
