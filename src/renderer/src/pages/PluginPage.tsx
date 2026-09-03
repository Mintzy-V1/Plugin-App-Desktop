import { useState, useEffect } from 'react';
import { Code2, Plus } from 'lucide-react';
import ConnectBrokerForm, { brokerFromProfile } from '../components/plugin/ConnectBrokerForm';
import { useAuth } from '../context/AuthContext';
import TwoFactorAuth from '../components/plugin/TwoFactorAuth';
import SessionConfigForm from '../components/plugin/SessionConfigForm';
import LiveSessionDashboard from '../components/plugin/LiveSessionDashboard';
import PluginSidebar from '../components/plugin/PluginSidebar';
import SavedStrategiesView from '../components/plugin/SavedStrategiesView';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';
import { pluginApi } from '../lib/pluginApi';
import type { TradingSession } from '../lib/pluginApi';
import { isLiveSessionStatus, isConfigurableSessionStatus } from '../lib/sessionStatus';
import { pluginErrorMessage } from '../lib/pluginErrors';
import { buildStartPayloadFromConfiguration } from '../lib/pluginTradingConfig';
import { pickCash, rememberBrokerCash } from '../lib/brokerCash';
import {
  shouldDelaySimulationStart,
  saveScheduledStart,
  hasPendingScheduledStart,
  clearScheduledStart,
} from '../lib/scheduledStart';

type PluginView = 'empty' | 'broker' | '2fa' | 'config' | 'dashboard' | 'saved';

const PANEL_KEY = 'mintzy.plugin.sessionsOpen';

export default function PluginPage({ initialSession = null }: { initialSession?: TradingSession | null }) {
  const toast = useToast();
  const { user } = useAuth();
  const skipTotp = brokerFromProfile(user?.broker) !== 'angel';
  const [view, setView] = useState<PluginView>(() => {
    if (!initialSession?.python_session_id) return 'empty';
    if (
      isConfigurableSessionStatus(initialSession.status)
      && !hasPendingScheduledStart(initialSession.python_session_id)
    ) return 'config';
    return 'dashboard';
  });
  const [sessionId, setSessionId] = useState<string | null>(initialSession?.python_session_id ?? null);
  const [sessionStatus, setSessionStatus] = useState<string | undefined>(initialSession?.status);
  const [freeCash, setFreeCash] = useState<number | null>(null);
  const [sessions, setSessions] = useState<TradingSession[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TradingSession | null>(null);
  const [quickStarting, setQuickStarting] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(() => {
    try { return localStorage.getItem(PANEL_KEY) === '1'; } catch { return false; }
  });

  const toggleSessions = () => {
    setSessionsOpen(prev => {
      const next = !prev;
      try { localStorage.setItem(PANEL_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  const fetchSessions = () => {
    pluginApi.getSessions().then(res => setSessions(res.data.sessions || [])).catch(() => {
      toast.error('Could not load your sessions');
    });
  };

  useEffect(() => { fetchSessions(); }, [user?.id]);

  // Auto-collapse session panel when entering live dashboard to free space for charts
  useEffect(() => {
    if (view === 'dashboard') setSessionsOpen(false);
  }, [view]);

  const handleBrokerSuccess = (sid: string, reqTotp: boolean) => {
    setSessionId(sid);
    setFreeCash(null);
    setView(reqTotp ? '2fa' : 'config');
  };

  const handleSelectSession = (s: TradingSession) => {
    if (!s.python_session_id) {
      toast.error('This session has no ID and cannot be opened.');
      return;
    }

    setSessionId(s.python_session_id);
    setSessionStatus(s.status);
    setFreeCash(null);

    pluginApi.getSessionStatus(s.python_session_id).then(res => {
      const cash = pickCash(res.data);
      if (cash != null) {
        setFreeCash(cash);
        rememberBrokerCash(cash);
      }
    }).catch(() => {});

    if (isConfigurableSessionStatus(s.status) && !hasPendingScheduledStart(s.python_session_id)) {
      setView('config');
      return;
    }

    // Live and past sessions both open the session detail view.
    // Past sessions render read-only (logs, P&L history, tradebook download).
    setView('dashboard');
  };

  useEffect(() => {
    if (!initialSession?.python_session_id) return;
    handleSelectSession(initialSession);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once when arriving from Dashboard
  }, [initialSession?._id]);

  const confirmDeleteSession = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setDeletingId(target._id);
    try {
      await pluginApi.deleteSession(target._id);
      clearScheduledStart(target.python_session_id);
      toast.success('Session deleted');
      fetchSessions();
    } catch {
      toast.error('Could not delete the session. Please try again.');
    }
    setDeletingId(null);
    setPendingDelete(null);
  };

  const handleUseSavedConfig = (configId: string, configuration: Record<string, unknown>) => {
    if (!sessionId || quickStarting) return;
    const payload = buildStartPayloadFromConfiguration(configuration);
    if (payload.symbols.length === 0) {
      toast.error('This strategy has no symbols to start with.');
      return;
    }
    setQuickStarting(true);
    const startPayload = {
      session_id: sessionId,
      saved_configuration_id: configId,
      ...payload,
    };
    const finish = (scheduled: boolean) => {
      toast.success(scheduled ? 'Trading will auto-start at 10:30 AM' : 'Trading started from saved strategy');
      setSessionStatus(scheduled ? 'authenticated' : 'trading_active');
      setView('dashboard');
      fetchSessions();
    };
    if (shouldDelaySimulationStart()) {
      saveScheduledStart(sessionId, startPayload);
      finish(true);
      setQuickStarting(false);
      return;
    }
    pluginApi.startTrading(startPayload)
      .then(() => finish(false))
      .catch((err: any) => {
        toast.error(pluginErrorMessage(err, 'Could not start trading from this strategy. Please try again.'));
      })
      .finally(() => setQuickStarting(false));
  };

  return (
    <div className="flex h-full min-h-0">
      <PluginSidebar
        sessions={sessions}
        activeSessionId={sessionId}
        onNewSession={() => { setSessionId(null); setFreeCash(null); setSessionStatus(undefined); setView('broker'); setSessionsOpen(true); }}
        onSelectSession={handleSelectSession}
        onSavedStrategies={() => setView('saved')}
        onDeleteSession={id => {
          const s = sessions.find(x => x._id === id);
          if (s) setPendingDelete(s);
        }}
        deletingId={deletingId}
        collapsed={!sessionsOpen}
        onToggle={toggleSessions}
      />

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div key={view} className="page-pad animate-fade-in min-h-full">
          {view === 'dashboard' && sessionId && (
            <LiveSessionDashboard
              key={sessionId}
              sessionId={sessionId}
              initialStatus={sessionStatus}
              initialFreeCash={freeCash}
              readOnly={!isLiveSessionStatus(sessionStatus)}
              onStop={() => { setView('empty'); setSessionStatus(undefined); fetchSessions(); }}
              onConfigure={() => setView('config')}
              onTradingStarted={() => { setSessionStatus('trading_active'); fetchSessions(); }}
            />
          )}
          {view === 'broker' && (
            <div className="flex min-h-[480px] items-center justify-center py-2">
              <ConnectBrokerForm onSuccess={handleBrokerSuccess} onBack={() => setView('empty')} />
            </div>
          )}
          {view === '2fa' && sessionId && (
            <div className="flex min-h-[480px] items-center justify-center py-2">
              <TwoFactorAuth
                sessionId={sessionId}
                onSuccess={(info) => {
                  if (info?.freeCash != null) {
                    setFreeCash(info.freeCash);
                    rememberBrokerCash(info.freeCash);
                  }
                  setSessionStatus('authenticated');
                  setView('config');
                }}
                onBack={() => setView('broker')}
              />
            </div>
          )}
          {view === 'config' && sessionId && (
            <div className="flex min-h-[480px] items-center justify-center py-2">
              <SessionConfigForm
                sessionId={sessionId}
                freeCash={freeCash}
                onSuccess={(result) => {
                  setSessionStatus(result?.scheduled ? 'authenticated' : 'trading_active');
                  setView('dashboard');
                  fetchSessions();
                }}
                onAbandon={() => {
                  toast.success('Session abandoned');
                  clearScheduledStart(sessionId);
                  setSessionId(null);
                  setSessionStatus(undefined);
                  setFreeCash(null);
                  setView('empty');
                  fetchSessions();
                }}
                onBack={() => setView(skipTotp ? 'broker' : '2fa')}
              />
            </div>
          )}
          {view === 'saved' && (
            <SavedStrategiesView
              sessionId={sessionId}
              onUseConfig={handleUseSavedConfig}
              quickStarting={quickStarting}
              onBack={() => setView(sessionId ? 'dashboard' : 'empty')}
            />
          )}
          {view === 'empty' && (
            <div className="flex min-h-[480px] flex-col items-center justify-center py-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 ring-1 ring-emerald-100">
                <Code2 className="h-6 w-6 text-emerald-700" aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-lg font-semibold tracking-tight text-slate-900">Ready to trade</h2>
              <p className="mt-1.5 max-w-sm text-center text-sm leading-relaxed text-slate-500">
                Connect your broker and start a session. Live charts and trade logs will appear here.
              </p>
              <button
                type="button"
                onClick={() => setView('broker')}
                className="mt-6 flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                New session
              </button>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete session?"
        description={<>This will permanently remove this session and its history from the list. The tradebook CSV will no longer be downloadable from here.</>}
        confirmLabel="Delete"
        tone="danger"
        busy={!!deletingId}
        onConfirm={confirmDeleteSession}
        onCancel={() => { if (!deletingId) setPendingDelete(null); }}
      />
    </div>
  );
}
