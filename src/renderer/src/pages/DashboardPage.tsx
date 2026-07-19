import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import UserAvatar from '../components/ui/UserAvatar';
import { pluginApi } from '../lib/pluginApi';
import type { TradingSession } from '../lib/pluginApi';

type Tab = 'profile' | 'plugin';

const currencyFormat = (v?: number | null) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(v ?? 0);

const fmtDate = (ds: string) => {
  const d = new Date(ds);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('profile');
  const [sessions, setSessions] = useState<TradingSession[]>([]);
  const [monthlyPnl, setMonthlyPnl] = useState<number>(0);
  const [equity, setEquity] = useState<number>(0);
  const [cash, setCash] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const activeCount = sessions.filter(s => s.status === 'trading_active').length;

  useEffect(() => {
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
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleDownload = async (sessionId?: string) => {
    if (!sessionId) return;
    setDownloadingId(sessionId);
    try {
      const res = await pluginApi.downloadTradebook(sessionId);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href = url; a.download = `tradebook-${sessionId}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch {} finally { setDownloadingId(null); }
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

      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>{t.label}</button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="space-y-6">
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
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full ${statusColor}`} />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{activeCount > 0 ? 'Active' : 'Idle'}</p>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">Trading Terminal</p>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <svg className="h-6 w-6 animate-spin text-slate-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <MetricCard label="Monthly P&L" value={currencyFormat(monthlyPnl)}
                  valueClass={monthlyPnl >= 0 ? 'text-emerald-600' : 'text-red-600'} />
                <MetricCard label="Current Equity" value={currencyFormat(equity)} />
                <MetricCard label="Cash Balance" value={currencyFormat(cash)} helper={`${sessions.length} sessions tracked`} />
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                  <h3 className="font-bold text-slate-900">Recent Trading Sessions</h3>
                  <button onClick={() => handleDownload(sessions[0]?.python_session_id)}
                    disabled={!sessions[0]?.python_session_id || !!downloadingId}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50">
                    {downloadingId === sessions[0]?.python_session_id ? (
                      <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )}
                    Download latest CSV
                  </button>
                </div>
                {sessions.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-400">No sessions created yet</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          <th className="px-6 py-3.5">Session ID</th>
                          <th className="px-6 py-3.5">Date</th>
                          <th className="px-6 py-3.5">Status</th>
                          <th className="px-6 py-3.5 text-right">CSV</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.slice(0, 5).map((s, i) => (
                          <tr key={s._id} className={`border-t border-slate-100 ${i % 2 ? 'bg-slate-50/60' : 'bg-white'}`}>
                            <td className="px-6 py-3.5 font-mono text-xs text-slate-600">
                              {s.python_session_id?.length > 18 ? `${s.python_session_id.slice(0, 8)}...${s.python_session_id.slice(-8)}` : s.python_session_id}
                            </td>
                            <td className="px-6 py-3.5 text-slate-600">{fmtDate(s.created_at)}</td>
                            <td className="px-6 py-3.5">
                              <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                                s.status === 'trading_active' ? 'bg-emerald-50 text-emerald-700' :
                                s.status === 'authenticated' ? 'bg-blue-50 text-blue-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>{s.status.split('_').join(' ')}</span>
                            </td>
                            <td className="px-6 py-3.5 text-right">
                              <button onClick={() => handleDownload(s.python_session_id)}
                                disabled={!s.python_session_id || downloadingId === s.python_session_id}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-40">
                                {downloadingId === s.python_session_id ? (
                                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                  </svg>
                                ) : (
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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

function MetricCard({ label, value, valueClass, helper }: { label: string; value: string; valueClass?: string; helper?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <p className="mb-2 text-xs font-medium text-slate-500">{label}</p>
      <p className={`text-2xl font-bold tracking-tight text-slate-900 ${valueClass || ''}`}>{value}</p>
      {helper && <p className="mt-1 text-xs text-slate-400">{helper}</p>}
    </div>
  );
}
