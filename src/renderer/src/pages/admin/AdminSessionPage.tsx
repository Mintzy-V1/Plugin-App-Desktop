import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Eye } from 'lucide-react';
import { adminApi, createAdminSessionSource, type AdminAccount, type AdminBroker, type AdminSession } from '../../lib/adminApi';
import { SessionDataSourceProvider } from '../../lib/sessionDataSource';
import { isTerminalSessionStatus } from '../../lib/sessionStatus';
import LiveSessionDashboard from '../../components/plugin/LiveSessionDashboard';
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

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setFailed(false);
    adminApi.getSession(sessionId)
      .then((res) => { if (!cancelled) setData({ broker: res.data.broker, session: res.data.session, user: res.data.user }); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [sessionId]);

  const source = useMemo(() => createAdminSessionSource(data?.broker), [data?.broker]);

  return (
    <div className="page-stack">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onBack} className={secondaryButtonClass}>
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> {backLabel}
        </button>
        <span className="ml-auto flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
          <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Read-only admin view
        </span>
      </div>

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
