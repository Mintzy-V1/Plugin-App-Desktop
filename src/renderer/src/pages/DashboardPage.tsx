import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { IndianRupee, TrendingUp, Wallet, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import UserAvatar from '../components/ui/UserAvatar';
import { useToast } from '../components/ui/Toast';
import { pluginApi } from '../lib/pluginApi';
import type { TradingSession } from '../lib/pluginApi';
import { sessionStatusLabel, sessionStatusBadgeClass, isLiveSessionStatus, isConfigurableSessionStatus } from '../lib/sessionStatus';
import { downloadSessionCsv } from '../lib/downloadSessionCsv';
import { pickCash, readRememberedBrokerCash, rememberBrokerCash } from '../lib/brokerCash';

type Tab = 'overview' | 'sessions';

const SESSION_PAGE_SIZE = 10;

function sessionPageItems(current: number, total: number): Array<number | 'gap'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const wanted = new Set([1, total, current - 1, current, current + 1]);
  const nums = [...wanted].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const items: Array<number | 'gap'> = [];
  for (let i = 0; i < nums.length; i++) {
    if (i > 0 && nums[i] - nums[i - 1] > 1) items.push('gap');
    items.push(nums[i]);
  }
  return items;
}

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
  const [monthlyPnl, setMonthlyPnl] = useState<number>(0);
  const [equity, setEquity] = useState<number>(0);
  const [cash, setCash] = useState<number>(() => readRememberedBrokerCash() ?? 0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [sessionPage, setSessionPage] = useState(1);

  const activeCount = sessions.filter(s => s.status === 'trading_active').length;
  const readyCount = sessions.filter(s => isConfigurableSessionStatus(s.status)).length;
  const sessionPageCount = Math.max(1, Math.ceil(sessions.length / SESSION_PAGE_SIZE));
  const safeSessionPage = Math.min(sessionPage, sessionPageCount);
  const sessionFrom = sessions.length === 0 ? 0 : (safeSessionPage - 1) * SESSION_PAGE_SIZE + 1;
  const sessionTo = Math.min(safeSessionPage * SESSION_PAGE_SIZE, sessions.length);
  const pageSessions = sessions.slice((safeSessionPage - 1) * SESSION_PAGE_SIZE, safeSessionPage * SESSION_PAGE_SIZE);

  useEffect(() => {
    setSessionPage((p) => Math.min(p, Math.max(1, Math.ceil(sessions.length / SESSION_PAGE_SIZE) || 1)));
  }, [sessions.length]);

  const fetchData = useCallback((silent = false) => {
    if (!silent) {
      setLoading(true);
      setLoadError(false);
    }
    Promise.all([
      pluginApi.getSessions(),
      pluginApi.getPnlAggregate(new Date().getFullYear(), new Date().getMonth() + 1),
    ]).then(async ([sRes, pnlRes]) => {
      const list = sRes.data.sessions || [];
      setSessions(list);
      const pnl = pnlRes.data as Record<string, unknown>;
      setMonthlyPnl(Number(pnl?.monthly_total ?? 0));
      const current = pnl?.current as Record<string, unknown> | undefined;
      setEquity(Number(current?.total_equity ?? 0));

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
        ? (fromSession ?? remembered ?? fromAggregate ?? 0)
        : ((fromAggregate != null && fromAggregate !== 0 ? fromAggregate : null) ?? fromSession ?? remembered ?? 0);
      setCash(resolved);
      const toRemember = fromSession ?? (fromAggregate != null && fromAggregate !== 0 ? fromAggregate : null);
      if (toRemember != null) rememberBrokerCash(toRemember);
      setRefreshedAt(new Date());
    }).catch(() => {
      if (!silent) setLoadError(true);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(() => fetchData(true), 20000);
    const onFocus = () => fetchData(true);
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchData]);

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
  ];

  const firstName = (user?.name || '').split(' ')[0] || 'there';

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
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-sm">
            <UserAvatar name={user?.name || 'U'} size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-slate-400">{greetingForNow()}</p>
              <h2 className="truncate text-[17px] font-semibold tracking-tight text-slate-900">{firstName}</h2>
              <p className="truncate text-[13px] text-slate-500">{user?.email}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              {user?.broker && (
                <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  {user.broker}
                </span>
              )}
              <button
                type="button"
                onClick={() => fetchData()}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
              >
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                {refreshedAt
                  ? `Updated ${refreshedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
                  : 'Refresh'}
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard
              label="Cash in broker"
              value={currencyFormat(cash)}
              loading={loading}
              icon={<Wallet className="h-4 w-4" aria-hidden="true" />}
              accent="emerald"
            />
            <MetricCard
              label="Equity"
              value={currencyFormat(equity)}
              loading={loading}
              icon={<IndianRupee className="h-4 w-4" aria-hidden="true" />}
            />
            <MetricCard
              label="This month"
              value={currencyFormat(monthlyPnl)}
              valueClass={monthlyPnl >= 0 ? 'text-emerald-600' : 'text-red-600'}
              loading={loading}
              icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
            />
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-5 py-3.5 shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className={`h-2 w-2 rounded-full ${activeCount > 0 ? 'bg-emerald-500' : 'bg-slate-300'}`} aria-hidden="true" />
              <p className="text-[13px] text-slate-600">
                {loading ? 'Checking sessions…' : activeCount > 0
                  ? <><span className="font-semibold text-slate-900">{activeCount} live</span> trading session{activeCount > 1 ? 's' : ''}</>
                  : readyCount > 0
                    ? <><span className="font-semibold text-slate-900">{readyCount} ready</span> — broker connected, not trading yet</>
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
            <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-8 text-center shadow-sm">
              <p className="text-sm font-semibold text-slate-900">Couldn't load trading data</p>
              <p className="mt-1 text-sm text-slate-500">Check your connection and try again.</p>
              <button type="button" onClick={() => fetchData()}
                className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30">
                Retry
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
                <div>
                  <h3 className="text-[13px] font-semibold text-slate-900">Sessions</h3>
                  <p className="mt-0.5 text-[11px] text-slate-400">
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
                        <th scope="col" className="px-5 py-2.5">Session</th>
                        <th scope="col" className="px-5 py-2.5">Date</th>
                        <th scope="col" className="px-5 py-2.5">Status</th>
                        <th scope="col" className="px-5 py-2.5 text-right">CSV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageSessions.map(s => (
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
                          className={`border-t border-slate-50 transition-colors hover:bg-slate-50/80 ${
                            onOpenSession ? 'cursor-pointer' : ''
                          }`}
                        >
                          <td className="px-5 py-3 font-mono text-xs text-slate-600" title={s.python_session_id}>
                            {s.python_session_id?.length > 18
                              ? `${s.python_session_id.slice(0, 8)}…${s.python_session_id.slice(-6)}`
                              : s.python_session_id}
                          </td>
                          <td className="px-5 py-3 text-[13px] text-slate-600">{fmtDate(s.created_at)}</td>
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
              {sessions.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
                  <p className="text-[12px] text-slate-500">
                    {sessionFrom}–{sessionTo} of {sessions.length}
                  </p>
                  {sessionPageCount > 1 && (
                    <nav aria-label="Session pages" className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setSessionPage((p) => Math.max(1, p - 1))}
                        disabled={safeSessionPage <= 1}
                        aria-label="Previous page"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 disabled:opacity-40"
                      >
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                      </button>
                      {sessionPageItems(safeSessionPage, sessionPageCount).map((item, idx) =>
                        item === 'gap' ? (
                          <span key={`gap-${idx}`} className="px-1 text-[12px] text-slate-400">…</span>
                        ) : (
                          <button
                            key={item}
                            type="button"
                            onClick={() => setSessionPage(item)}
                            aria-label={`Page ${item}`}
                            aria-current={item === safeSessionPage ? 'page' : undefined}
                            className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[12px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 ${
                              item === safeSessionPage
                                ? 'bg-slate-900 text-white'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                          >
                            {item}
                          </button>
                        ),
                      )}
                      <button
                        type="button"
                        onClick={() => setSessionPage((p) => Math.min(sessionPageCount, p + 1))}
                        disabled={safeSessionPage >= sessionPageCount}
                        aria-label="Next page"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 disabled:opacity-40"
                      >
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </nav>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
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
    <div className={`rounded-2xl border bg-white px-4 py-4 shadow-sm ${
      accent === 'emerald' ? 'border-emerald-100' : 'border-slate-200/80'
    }`}>
      <div className="flex items-center gap-2 text-slate-400">
        {icon}
        <p className="text-[11px] font-medium uppercase tracking-wider">{label}</p>
      </div>
      {loading ? (
        <div className="mt-2.5 h-7 w-28 animate-pulse rounded bg-slate-100" />
      ) : (
        <p className={`mt-1.5 text-xl font-semibold tracking-tight ${valueClass || 'text-slate-900'}`}>{value}</p>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white" aria-busy="true" aria-label="Loading">
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="h-3.5 w-28 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="space-y-2.5 p-4">
        {[0, 1, 2].map(i => <div key={i} className="h-8 animate-pulse rounded-lg bg-slate-50" />)}
      </div>
    </div>
  );
}
