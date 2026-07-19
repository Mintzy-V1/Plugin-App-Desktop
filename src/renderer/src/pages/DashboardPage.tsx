import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import UserAvatar from '../components/ui/UserAvatar';
import { useToast } from '../components/ui/Toast';
import { pluginApi } from '../lib/pluginApi';
import type { TradingSession } from '../lib/pluginApi';
import { sessionStatusLabel, sessionStatusBadgeClass } from '../lib/sessionStatus';

type Tab = 'profile' | 'plugin';

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
  const [tab, setTab] = useState<Tab>('profile');
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

  const handleDownload = async (sessionId?: string) => {
    if (!sessionId) return;
    setDownloadingId(sessionId);
    try {
      const res = await pluginApi.downloadTradebook(sessionId);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href = url; a.download = `tradebook-${sessionId}.csv`; a.click();
      URL.revokeObjectURL(url);
      toast.success('Tradebook CSV downloaded');
    } catch {
      toast.error('Could not download the tradebook. Please try again.');
    } finally { setDownloadingId(null); }
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: 'profile', label: 'User Profile' },
    { id: 'plugin', label: 'Plugin Framework' },
  ];

  const statusColor = activeCount > 0 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-slate-300';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Welcome back, {user?.name}</p>
      </div>

      <div role="tablist" aria-label="Dashboard sections" className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {TABS.map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
              tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>{t.label}</button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="animate-fade-in space-y-6">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <UserAvatar name={user?.name || 'U'} size="lg" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{user?.name}</h2>
                <p className="text-sm text-slate-500">{user?.email}</p>
                {user?.broker && (
                  <span className="mt-1 inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{user.broker}</span>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Account ID</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{user?.id || user?.email}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Broker</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{user?.broker || 'Not set'}</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'plugin' && (
        <div className="animate-fade-in space-y-6">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full ${statusColor}`} aria-hidden="true" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    {loading ? 'Checking…' : activeCount > 0 ? `Active · ${activeCount} session${activeCount > 1 ? 's' : ''}` : 'Idle'}
                  </p>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">Trading Terminal</p>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <DashboardSkeleton />
          ) : loadError ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-sm">
              <p className="text-sm font-semibold text-slate-900">Couldn't load your trading data</p>
              <p className="mt-1 text-sm text-slate-500">Check your connection and try again.</p>
              <button onClick={fetchData}
                className="mt-4 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30">
                Retry
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <MetricCard label="Monthly P&L" value={currencyFormat(monthlyPnl)}
                  valueClass={monthlyPnl >= 0 ? 'text-emerald-600' : 'text-red-600'} />
                <MetricCard label="Current Equity" value={currencyFormat(equity)} />
                <MetricCard label="Cash Balance" value={currencyFormat(cash)} helper={`${sessions.length} session${sessions.length === 1 ? '' : 's'} tracked`} />
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                  <h3 className="font-bold text-slate-900">Recent Trading Sessions</h3>
                  <button onClick={() => handleDownload(sessions[0]?.python_session_id)}
                    disabled={!sessions[0]?.python_session_id || !!downloadingId}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-50">
                    {downloadingId === sessions[0]?.python_session_id ? (
                      <Spinner className="h-3.5 w-3.5" />
                    ) : (
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )}
                    Download latest CSV
                  </button>
                </div>
                {sessions.length === 0 ? (
                  <div className="p-10 text-center">
                    <p className="text-sm font-medium text-slate-500">No trading sessions yet</p>
                    <p className="mt-1 text-xs text-slate-400">Start one from the Plugin Framework to see it here.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          <th scope="col" className="px-6 py-3.5">Session ID</th>
                          <th scope="col" className="px-6 py-3.5">Date</th>
                          <th scope="col" className="px-6 py-3.5">Status</th>
                          <th scope="col" className="px-6 py-3.5 text-right">CSV</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.slice(0, 5).map((s, i) => (
                          <tr key={s._id} className={`border-t border-slate-100 transition-colors hover:bg-blue-50/40 ${i % 2 ? 'bg-slate-50/60' : 'bg-white'}`}>
                            <td className="px-6 py-3.5 font-mono text-xs text-slate-600" title={s.python_session_id}>
                              {s.python_session_id?.length > 18 ? `${s.python_session_id.slice(0, 8)}...${s.python_session_id.slice(-8)}` : s.python_session_id}
                            </td>
                            <td className="px-6 py-3.5 text-slate-600">{fmtDate(s.created_at)}</td>
                            <td className="px-6 py-3.5">
                              <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${sessionStatusBadgeClass(s.status)}`}>
                                {sessionStatusLabel(s.status)}
                              </span>
                            </td>
                            <td className="px-6 py-3.5 text-right">
                              <button onClick={() => handleDownload(s.python_session_id)}
                                disabled={!s.python_session_id || downloadingId === s.python_session_id}
                                aria-label={`Download tradebook CSV for session from ${fmtDate(s.created_at)}`}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-blue-600 transition-colors hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-40">
                                {downloadingId === s.python_session_id ? (
                                  <Spinner className="h-4 w-4" />
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
            </>
          )}
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading trading data">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
            <div className="mt-3 h-7 w-28 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <div className="h-4 w-44 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="space-y-3 p-6">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-9 animate-pulse rounded-lg bg-slate-50" />
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, valueClass, helper }: { label: string; value: string; valueClass?: string; helper?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <p className="mb-2 text-xs font-medium text-slate-500">{label}</p>
      <p className={`text-2xl font-bold tracking-tight ${valueClass || 'text-slate-900'}`}>{value}</p>
      {helper && <p className="mt-1 text-xs text-slate-400">{helper}</p>}
    </div>
  );
}
