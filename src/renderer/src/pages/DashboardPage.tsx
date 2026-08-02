import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import UserAvatar from '../components/ui/UserAvatar';
import { useToast } from '../components/ui/Toast';
import { pluginApi } from '../lib/pluginApi';
import type { TradingSession } from '../lib/pluginApi';
import { sessionStatusLabel, sessionStatusBadgeClass } from '../lib/sessionStatus';
import { downloadSessionCsv } from '../lib/downloadSessionCsv';

type Tab = 'overview' | 'sessions';

const currencyFormat = (v?: number | null) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(v ?? 0);

const fmtDate = (ds: string) => {
  const d = new Date(ds);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('overview');
  const [sessions, setSessions] = useState<TradingSession[]>([]);
  const [monthlyPnl, setMonthlyPnl] = useState<number>(0);
  const [equity, setEquity] = useState<number>(0);
  const [cash, setCash] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const activeCount = sessions.filter(s => s.status === 'trading_active').length;

  const fetchData = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    Promise.all([
      pluginApi.getSessions(),
      pluginApi.getPnlAggregate(new Date().getFullYear(), new Date().getMonth() + 1),
    ]).then(([sRes, pnlRes]) => {
      setSessions(sRes.data.sessions || []);
      const pnl = pnlRes.data as Record<string, unknown>;
      setMonthlyPnl(Number(pnl?.monthly_total ?? 0));
      const current = pnl?.current as Record<string, unknown> | undefined;
      setEquity(Number(current?.total_equity ?? 0));
      setCash(Number(current?.cash_balance ?? 0));
    }).catch(() => {
      setLoadError(true);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDownload = async (sessionId?: string, status?: string) => {
    if (!sessionId) return;
    setDownloadingId(sessionId);
    try {
      // Past sessions: Mongo logs CSV. Live: final tradebook first, then logs.
      const preferLogs = !['trading_active', 'active', 'running', 'started'].includes(
        String(status || '').toLowerCase()
      );
      const kind = await downloadSessionCsv(sessionId, { preferLogs });
      toast.success(kind === 'logs' ? 'Session logs CSV downloaded' : 'Tradebook CSV downloaded');
    } catch (err: any) {
      const statusCode = err?.response?.status;
      toast.error(statusCode === 404
        ? 'No tradebook or logs are available for this session yet.'
        : 'Could not download the CSV. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'sessions', label: 'Sessions' },
  ];

  return (
    <div className="page-stack">
      <div role="tablist" aria-label="Dashboard sections" className="inline-flex gap-0.5 rounded-lg bg-slate-200/60 p-0.5">
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 ${
              tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="animate-fade-in page-stack">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3.5">
            <UserAvatar name={user?.name || 'U'} size="md" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[15px] font-semibold text-slate-900">{user?.name}</h2>
              <p className="truncate text-[13px] text-slate-500">{user?.email}</p>
            </div>
            {user?.broker && (
              <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                {user.broker}
              </span>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white">
            <div className="grid divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <MetricCell label="Monthly P&L" value={currencyFormat(monthlyPnl)}
                valueClass={monthlyPnl >= 0 ? 'text-emerald-600' : 'text-red-600'} loading={loading} />
              <MetricCell label="Equity" value={currencyFormat(equity)} loading={loading} />
              <MetricCell label="Cash" value={currencyFormat(cash)} loading={loading}
                helper={loading ? undefined : `${sessions.length} session${sessions.length === 1 ? '' : 's'}`} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className={`h-2 w-2 rounded-full ${activeCount > 0 ? 'bg-emerald-500' : 'bg-slate-300'}`} aria-hidden="true" />
              <p className="text-[13px] text-slate-600">
                {loading ? 'Checking sessions…' : activeCount > 0
                  ? <><span className="font-semibold text-slate-900">{activeCount} live</span> trading session{activeCount > 1 ? 's' : ''}</>
                  : 'No live sessions'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTab('sessions')}
              className="text-[12px] font-semibold text-emerald-700 hover:text-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
            >
              View all
            </button>
          </div>
        </div>
      )}

      {tab === 'sessions' && (
        <div className="animate-fade-in">
          {loading ? (
            <DashboardSkeleton />
          ) : loadError ? (
            <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-8 text-center">
              <p className="text-sm font-semibold text-slate-900">Couldn't load trading data</p>
              <p className="mt-1 text-sm text-slate-500">Check your connection and try again.</p>
              <button type="button" onClick={fetchData}
                className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30">
                Retry
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <h3 className="text-[13px] font-semibold text-slate-900">Recent sessions</h3>
                <button
                  type="button"
                  onClick={() => handleDownload(sessions[0]?.python_session_id, sessions[0]?.status)}
                  disabled={!sessions[0]?.python_session_id || !!downloadingId}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 disabled:opacity-50"
                >
                  {downloadingId === sessions[0]?.python_session_id ? <Spinner className="h-3 w-3" /> : null}
                  Download latest
                </button>
              </div>
              {sessions.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm font-medium text-slate-500">No trading sessions yet</p>
                  <p className="mt-1 text-xs text-slate-400">Start one from Launch Terminal to see it here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        <th scope="col" className="px-4 py-2.5">Session</th>
                        <th scope="col" className="px-4 py-2.5">Date</th>
                        <th scope="col" className="px-4 py-2.5">Status</th>
                        <th scope="col" className="px-4 py-2.5 text-right">CSV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.slice(0, 8).map(s => (
                        <tr key={s._id} className="border-t border-slate-50 transition-colors hover:bg-slate-50/80">
                          <td className="px-4 py-2.5 font-mono text-xs text-slate-600" title={s.python_session_id}>
                            {s.python_session_id?.length > 18
                              ? `${s.python_session_id.slice(0, 8)}…${s.python_session_id.slice(-6)}`
                              : s.python_session_id}
                          </td>
                          <td className="px-4 py-2.5 text-[13px] text-slate-600">{fmtDate(s.created_at)}</td>
                          <td className="px-4 py-2.5">
                            <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${sessionStatusBadgeClass(s.status)}`}>
                              {sessionStatusLabel(s.status)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleDownload(s.python_session_id, s.status)}
                              disabled={!s.python_session_id || downloadingId === s.python_session_id}
                              aria-label={`Download tradebook for ${fmtDate(s.created_at)}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-emerald-50 hover:text-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 disabled:opacity-40"
                            >
                              {downloadingId === s.python_session_id ? (
                                <Spinner className="h-3.5 w-3.5" />
                              ) : (
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCell({ label, value, valueClass, helper, loading }: {
  label: string; value: string; valueClass?: string; helper?: string; loading?: boolean;
}) {
  return (
    <div className="px-4 py-3.5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
      {loading ? (
        <div className="mt-2 h-7 w-24 animate-pulse rounded bg-slate-100" />
      ) : (
        <p className={`mt-1 text-xl font-semibold tracking-tight ${valueClass || 'text-slate-900'}`}>{value}</p>
      )}
      {helper && <p className="mt-0.5 text-[11px] text-slate-400">{helper}</p>}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white" aria-busy="true" aria-label="Loading">
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="h-3.5 w-28 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="space-y-2.5 p-4">
        {[0, 1, 2].map(i => <div key={i} className="h-8 animate-pulse rounded-lg bg-slate-50" />)}
      </div>
    </div>
  );
}
