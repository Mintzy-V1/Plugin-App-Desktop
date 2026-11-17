import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Eye } from 'lucide-react';
import { adminApi, createAdminSessionSource, type AdminAccount, type AdminBroker, type AdminSession } from '../../lib/adminApi';
import { SessionDataSourceProvider } from '../../lib/sessionDataSource';
import { isTerminalSessionStatus } from '../../lib/sessionStatus';
import LiveSessionDashboard from '../../components/plugin/LiveSessionDashboard';
import AdminSessionControls from './AdminSessionControls';
import { EmptyState, PhaseBadge, Spinner, brokerLabel, formatDateTime, secondaryButtonClass } from './adminFormat';

interface Loaded {
  broker: AdminBroker;
  session: AdminSession;
  user: AdminAccount | null;
}

const noop = () => {};

export default function AdminSessionPage({ sessionId, backLabel, onBack, onOpenUser }: {
  sessionId: string;
  backLabel: string;
  onBack: () => void;
  onOpenUser: (userId: string) => void;
}) {
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  // A reload of an already-shown session failed: its status may be out of date
  const [refreshFailed, setRefreshFailed] = useState(false);

  const [reloadTick, setReloadTick] = useState(0);
  const loadedIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // A new session shows the spinner; a reload of the same one swaps data in place.
    if (loadedIdRef.current !== sessionId) {
      setData(null);
      setFailed(false);
    }
    adminApi.getSession(sessionId)
      .then((res) => {
        if (cancelled) return;
        loadedIdRef.current = sessionId;
        setRefreshFailed(false);
        setData({ broker: res.data.broker, session: res.data.session, user: res.data.user });
      })
      .catch(() => {
        if (cancelled) return;
        if (loadedIdRef.current !== sessionId) setFailed(true);
        else setRefreshFailed(true);
      });
    return () => { cancelled = true; };
  }, [sessionId, reloadTick]);

  const source = useMemo(() => createAdminSessionSource(data?.broker), [data?.broker]);

  // Stop and Exit only for a session that is running (live or simulating).
  const running = data != null
    && data.session.phase !== 'scheduled'
    && !isTerminalSessionStatus(data.session.status);
  // Never offer Stop / Exit on a status that could not be refreshed
  const controllable = running && !refreshFailed;

  // Re-read the session while it is running, so the controls go away once it ends.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setReloadTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, [running]);

  return (
    <div className="page-stack">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onBack} className={secondaryButtonClass}>
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> {backLabel}
        </button>
        {controllable && data ? (
          <AdminSessionControls
            sessionId={sessionId}
            user={data.user}
            source={source}
            onStopped={() => setReloadTick((n) => n + 1)}
          />
        ) : (
          <span className="ml-auto flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
            <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Read-only admin view
          </span>
        )}
      </div>

      {refreshFailed && (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-[12px] text-amber-900">
          Could not refresh this session. Its status may be out of date, so Stop and Exit are hidden until it loads again.
          <button type="button" onClick={() => setReloadTick((n) => n + 1)} className="ml-2 font-semibold underline">Retry</button>
        </p>
      )}
      {!data && !failed && <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400"><Spinner /> Loading session…</div>}
      {failed && <EmptyState title="Could not load this session" body="It may have been deleted, or the broker could not be determined." />}

      {data && (
        <>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-sm">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Account</p>
              {data.user ? (
                <button type="button" onClick={() => onOpenUser(data.user!._id)} className="text-left">
                  <p className="text-[15px] font-semibold text-slate-900 hover:underline">{data.user.name}</p>
                  <p className="text-[12px] text-slate-500">{data.user.email}</p>
                </button>
              ) : (
                <p className="text-[15px] font-semibold text-slate-500">Unknown user</p>
              )}
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Broker</p>
              <p className="text-[13px] font-medium text-slate-800">{brokerLabel(data.broker)}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Strategy</p>
              <p className="text-[13px] font-medium text-slate-800">{data.session.configuration_name || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Started</p>
              <p className="text-[13px] font-medium text-slate-800">{formatDateTime(data.session.created_at)}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <PhaseBadge phase={data.session.phase} />
              <span className="font-mono text-[11px] text-slate-400">{sessionId}</span>
            </div>
          </div>

          <SessionDataSourceProvider value={source}>
            <LiveSessionDashboard
              key={sessionId}
              sessionId={sessionId}
              initialStatus={data.session.status}
              readOnly={isTerminalSessionStatus(data.session.status)}
              onStop={noop}
              onConfigure={noop}
            />
          </SessionDataSourceProvider>
        </>
      )}
    </div>
  );
}
