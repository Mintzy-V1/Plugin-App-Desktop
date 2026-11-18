import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { IndianRupee, Wallet, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Tabs } from '../components/ui/Tabs';
import { Pagination } from '../components/ui/Pagination';
import { usePagination } from '../lib/usePagination';
import { LoadError } from '../components/ui/Feedback';
import { useToast } from '../components/ui/Toast';
import { pluginApi } from '../lib/pluginApi';
import type { TradingSession, PerformanceStats } from '../lib/pluginApi';
import { sessionStatusLabel, sessionStatusBadgeClass, isLiveSessionStatus, isConfigurableSessionStatus } from '../lib/sessionStatus';
import { downloadSessionCsv } from '../lib/downloadSessionCsv';
import { pickCash, readRememberedBrokerCash, rememberBrokerCash } from '../lib/brokerCash';
import PerformanceStatsGrid, { MonthReturnsGrid } from '../components/plugin/PerformanceStatsGrid';
import { brokerFromProfile, brokerLabel } from '../components/plugin/ConnectBrokerForm';
import { EquityHero } from '../components/dashboard/EquityHero';
import { KpiStrip } from '../components/dashboard/KpiStrip';

type Tab = 'overview' | 'sessions' | 'returns';

const currencyFormat = (v?: number | null) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(v ?? 0);

const fmtDate = (ds: string) => {
  const d = new Date(ds);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
};

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function greetingForNow() {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date())
      .find((p) => p.type === 'hour')?.value ?? 12,
  );
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage({ onOpenSession }: { onOpenSession?: (session: TradingSession) => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('overview');
  const [sessions, setSessions] = useState<TradingSession[]>([]);
  const [monthlyPnl, setMonthlyPnl] = useState<number | null>(null);
  const [equity, setEquity] = useState<number | null>(null);
  const [cash, setCash] = useState<number | null>(() => readRememberedBrokerCash());
  const [loading, setLoading] = useState(true);
  const [figuresLoading, setFiguresLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [figuresError, setFiguresError] = useState(false);
  const [sessionSearch, setSessionSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const activeCount = sessions.filter(s => s.status === 'trading_active').length;
  const readyCount = sessions.filter(s => isConfigurableSessionStatus(s.status)).length;
  const filteredSessions = sessions.filter(s => (!statusFilter || s.status === statusFilter) && [s.python_session_id, s.configuration_name, sessionStatusLabel(s.status)].some(value => value?.toLowerCase().includes(sessionSearch.trim().toLowerCase())));
  const history = usePagination(filteredSessions, 10, `${sessionSearch}:${statusFilter}`);

  const fetchData = useCallback((silent = false) => {
    if (!silent) {
      setLoading(true);
      setFiguresLoading(true);
      setLoadError(false);
      setFiguresError(false);
    }
    pluginApi.getSessions()
      .then((sRes) => {
        setLoadError(false);
        const list = sRes.data.sessions || [];
        setSessions(list);
        setRefreshedAt(new Date());
        // Render the session list / overview now; figures and cash resolve in
        // the background so a slow pnl-aggregate / live-VM call never blocks it.
        setLoading(false);

        pluginApi.getPnlAggregate(new Date().getFullYear(), new Date().getMonth() + 1)
          .then(async (pnlRes) => {
            const pnl = pnlRes.data as Record<string, unknown>;
            setMonthlyPnl(pnl?.monthly_total != null ? Number(pnl.monthly_total) : null);
            setFiguresError(false);
            const current = pnl?.current as Record<string, unknown> | undefined;
            setEquity(current?.total_equity != null ? Number(current.total_equity) : null);

            const remembered = readRememberedBrokerCash();
            const fromAggregate = pickCash(current, pnl);

            const liveOrAuth = list.find(s =>
              isLiveSessionStatus(s.status) || isConfigurableSessionStatus(s.status),
            ) || list[0];
            const sessionIsOpen = !!(liveOrAuth && (
              isLiveSessionStatus(liveOrAuth.status) || isConfigurableSessionStatus(liveOrAuth.status)
            ));

            let fromSession: number | null = null;
            if (liveOrAuth?.python_session_id) {
              const [statusRes, summaryRes, fullRes] = await Promise.allSettled([
                pluginApi.getSessionStatus(liveOrAuth.python_session_id),
                pluginApi.getPnlSummary(liveOrAuth.python_session_id),
                pluginApi.getFullSessionState(),
              ]);
              const status = statusRes.status === 'fulfilled' ? statusRes.value.data : null;
              const summary = summaryRes.status === 'fulfilled' ? summaryRes.value.data : null;
              const full = fullRes.status === 'fulfilled' ? fullRes.value.data : null;
              const fullMatches = full?.python_session_id === liveOrAuth.python_session_id ? full : null;
              fromSession = pickCash(status, summary, fullMatches, fullMatches?.status, fullMatches?.snapshot);
            }

            // Connected/live: broker cash from the session. After stop: latest log snapshot.
            const resolved = sessionIsOpen
              ? (fromSession ?? remembered ?? fromAggregate ?? null)
              : ((fromAggregate != null && fromAggregate !== 0 ? fromAggregate : null) ?? fromSession ?? remembered ?? null);
            setCash(resolved);
            const toRemember = fromSession ?? (fromAggregate != null && fromAggregate !== 0 ? fromAggregate : null);
            if (toRemember != null) rememberBrokerCash(toRemember);
            setFiguresLoading(false);
          })
          .catch(() => {
            setFiguresError(true);
            setFiguresLoading(false);
          });
      })
      .catch(() => {
        setLoadError(true);
        setFiguresLoading(false);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(() => fetchData(true), 20000);
    const onFocus = () => {
      fetchData(true);
      setStatsGen((n) => n + 1);
    };
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchData]);

  const [perfStats, setPerfStats] = useState<PerformanceStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(false);
  const [statsGen, setStatsGen] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setStatsLoading(true);
    pluginApi.getPerformanceStats()
      .then((res) => {
        if (!cancelled) { setPerfStats(res.data.stats ?? null); setStatsError(false); }
      })
      .catch(() => { if (!cancelled) setStatsError(true); })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });
    return () => { cancelled = true; };
    // statsGen forces a refetch when the window is opened / focused.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, statsGen]);

  const handleDownload = async (sessionId?: string, status?: string) => {
    if (!sessionId) return;
    setDownloadingId(sessionId);
    try {
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
    { id: 'returns', label: 'Month over month' },
  ];

  const firstName = (user?.name || '').split(' ')[0] || 'there';

  return (
    <div className="page-stack @container">
      <Tabs label="Dashboard sections" items={TABS} value={tab} onChange={setTab} />
      {loadError && <LoadError message="Session history could not be refreshed. Previously loaded sessions may be out of date." onRetry={() => fetchData()} />}
      {statsError && <LoadError message="Performance could not be refreshed. Any figures shown are from the previous update." onRetry={() => setStatsGen(n => n + 1)} />}
      {figuresError && <LoadError message="Balances and monthly result could not be refreshed. Any figures shown are from the previous update." onRetry={() => fetchData()} />}

      <div role="tabpanel" id="dashboard-sections-panel-overview" aria-labelledby="dashboard-sections-tab-overview" hidden={tab !== 'overview'} className="animate-fade-in page-stack">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-1">
            <div><p className="text-sm text-secondary">{greetingForNow()}, {firstName}</p><h2 className="mt-1 font-serif text-3xl text-ink">Your account at a glance</h2></div>
            <div className="flex items-center gap-4">
              {user?.broker && <span className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-secondary">{brokerLabel(brokerFromProfile(user.broker))}</span>}
              <button type="button" onClick={() => fetchData()} className="flex items-center gap-2 rounded-md py-2 text-xs text-muted"><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />{refreshedAt ? `Updated ${refreshedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Refresh'}</button>
            </div>
          </div>
          <EquityHero stats={perfStats} loading={statsLoading} monthlyPnl={monthlyPnl} cash={cash} equity={equity} figuresLoading={figuresLoading} />
          <KpiStrip stats={perfStats} loading={statsLoading} />

          <div className="flex items-center justify-between rounded-xl border border-line/80 bg-surface px-5 py-3.5 shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className={`h-2 w-2 rounded-full ${activeCount > 0 ? 'bg-gain-action' : 'bg-line'}`} aria-hidden="true" />
              <p className="text-[13px] text-secondary">
                {loading ? 'Checking sessions…' : activeCount > 0
                  ? <><span className="font-semibold text-ink">{activeCount} live</span> trading session{activeCount > 1 ? 's' : ''}</>
                  : readyCount > 0
                    ? <><span className="font-semibold text-ink">{readyCount} ready</span> — broker connected, not trading yet</>
                    : 'No live sessions'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTab('sessions')}
              className="text-[12px] font-semibold text-gain hover:text-gain focus:outline-none focus-visible:ring-2 focus-visible:ring-gain/30"
            >
              View all
            </button>
          </div>

          <PerformanceStatsGrid
            stats={perfStats}
            loading={statsLoading}
            onOpenMonths={() => setTab('returns')}
          />
      </div>

      <div role="tabpanel" id="dashboard-sections-panel-sessions" aria-labelledby="dashboard-sections-tab-sessions" hidden={tab !== 'sessions'} className="animate-fade-in">
          {loading ? (
            <DashboardSkeleton />
          ) : loadError ? (
            <div className="rounded-xl border border-line/80 bg-surface px-4 py-8 text-center shadow-sm">
              <p className="text-sm font-semibold text-ink">Couldn't load trading data</p>
              <p className="mt-1 text-sm text-muted">Check your connection and try again.</p>
              <button type="button" onClick={() => fetchData()}
                className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors hover:bg-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30">
                Retry
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-line/80 bg-surface shadow-sm">
              <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
                <div>
                  <h3 className="text-[13px] font-semibold text-ink">Sessions</h3>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {sessions.length === 0
                      ? 'No sessions on this account yet'
                      : onOpenSession
                        ? `${sessions.length} on this account · tap a row to open it`
                        : `${sessions.length} on this account`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownload(sessions[0]?.python_session_id, sessions[0]?.status)}
                  disabled={!sessions[0]?.python_session_id || !!downloadingId}
                  className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-semibold text-secondary transition-colors hover:bg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-gain/30 disabled:opacity-50"
                >
                  {downloadingId === sessions[0]?.python_session_id ? <Spinner className="h-3 w-3" /> : null}
                  Download latest
                </button>
              </div>
              {sessions.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm font-medium text-muted">No trading sessions yet</p>
                  <p className="mt-1 text-xs text-muted">Start one from Launch Terminal to see it here.</p>
                </div>
              ) : (
                <><div className="flex flex-wrap gap-3 border-b border-line p-4">
                  <input type="search" aria-label="Search session history" placeholder="Search strategy or session…" value={sessionSearch} onChange={e => setSessionSearch(e.target.value)} className="min-w-48 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink" />
                  <select aria-label="Filter session status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"><option value="">All statuses</option>{[...new Set(sessions.map(s => s.status))].map(status => <option key={status} value={status}>{sessionStatusLabel(status)}</option>)}</select>
                  {(sessionSearch || statusFilter) && <button type="button" onClick={() => {setSessionSearch('');setStatusFilter('');}} className="text-xs font-medium text-gain">Clear filters</button>}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-line text-[11px] font-semibold uppercase tracking-wider text-muted">
                        <th scope="col" className="px-5 py-2.5">Session</th>
                        <th scope="col" className="px-5 py-2.5">Date</th>
                        <th scope="col" className="px-5 py-2.5">Status</th>
                        <th scope="col" className="px-5 py-2.5 text-right">CSV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.rows.map(s => (
                        <tr
                          key={s._id}
                          onClick={() => onOpenSession?.(s)}
                          onKeyDown={(e) => {
                            if (!onOpenSession) return;
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onOpenSession(s);
                            }
                          }}
                          tabIndex={onOpenSession ? 0 : undefined}
                          aria-label={onOpenSession ? `Open session ${fmtDate(s.created_at)}` : undefined}
                          className={`border-t border-line transition-colors hover:bg-subtle ${
                            onOpenSession ? 'cursor-pointer' : ''
                          }`}
                        >
                          <td className="px-5 py-3 font-mono text-xs text-secondary" title={s.python_session_id}>
                            {s.configuration_name && <p className="mb-1 font-sans text-sm font-medium text-ink">{s.configuration_name}</p>}
                            {s.python_session_id?.length > 18
                              ? `${s.python_session_id.slice(0, 8)}…${s.python_session_id.slice(-6)}`
                              : s.python_session_id}
                          </td>
                          <td className="px-5 py-3 text-[13px] text-secondary">{fmtDate(s.created_at)}</td>
                          <td className="px-5 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${sessionStatusBadgeClass(s.status)}`}>
                              {sessionStatusLabel(s.status)}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(s.python_session_id, s.status);
                              }}
                              disabled={!s.python_session_id || downloadingId === s.python_session_id}
                              aria-label={`Download tradebook for ${fmtDate(s.created_at)}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-gain-soft hover:text-gain focus:outline-none focus-visible:ring-2 focus-visible:ring-gain/30 disabled:opacity-40"
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
                </div></>
              )}
              {sessions.length > 0 && <Pagination page={history.page} pageSize={history.pageSize} total={history.total} onPage={history.onPage} onPageSize={history.onPageSize} label="Sessions" />}
              {sessions.length > 0 && filteredSessions.length === 0 && <p className="p-8 text-center text-sm text-muted">No sessions match these filters.</p>}
            </div>
          )}
      </div>

      <div role="tabpanel" id="dashboard-sections-panel-returns" aria-labelledby="dashboard-sections-tab-returns" hidden={tab !== 'returns'} className="animate-fade-in">
          <MonthReturnsGrid stats={perfStats} loading={statsLoading} />
      </div>
    </div>
  );
}

function MetricCard({ label, value, valueClass, loading, icon, accent }: {
  label: string;
  value: string;
  valueClass?: string;
  loading?: boolean;
  icon?: ReactNode;
  accent?: 'emerald';
}) {
  return (
    <div className={`rounded-xl border bg-surface px-6 py-7 ${
      accent === 'emerald' ? 'border-gain/25' : 'border-line/80'
    }`}>
      <div className="flex items-center gap-2 text-muted">
        {icon}
        <p className="text-[11px] font-medium uppercase tracking-wider">{label}</p>
      </div>
      {loading ? (
        <div className="mt-2.5 h-7 w-28 animate-pulse rounded bg-subtle" />
      ) : (
        <p className={`mt-4 font-serif text-3xl tracking-tight tabular-nums ${valueClass || 'text-ink'}`}>{value}</p>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-line/80 bg-surface" aria-busy="true" aria-label="Loading">
      <div className="border-b border-line px-4 py-3">
        <div className="h-3.5 w-28 animate-pulse rounded bg-subtle" />
      </div>
      <div className="space-y-2.5 p-4">
        {[0, 1, 2].map(i => <div key={i} className="h-8 animate-pulse rounded-lg bg-subtle" />)}
      </div>
    </div>
  );
}
