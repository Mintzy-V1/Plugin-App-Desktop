import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Tabs } from '../components/ui/Tabs';
import { LoadError } from '../components/ui/Feedback';
import { useToast } from '../components/ui/Toast';
import { pluginApi } from '../lib/pluginApi';
import type { TradingSession, PerformanceStats } from '../lib/pluginApi';
import { isLiveSessionStatus, isConfigurableSessionStatus } from '../lib/sessionStatus';
import { downloadSessionCsv } from '../lib/downloadSessionCsv';
import { pickCash, readRememberedBrokerCash, rememberBrokerCash } from '../lib/brokerCash';
import { MonthComparison } from '../components/dashboard/MonthComparison';
import { brokerFromProfile, brokerLabel } from '../components/plugin/ConnectBrokerForm';
import { EquityHero } from '../components/dashboard/EquityHero';
import { KpiStrip } from '../components/dashboard/KpiStrip';
import { DailyPnlChart, MonthlyBars } from '../components/dashboard/PnlBars';
import { PnlCalendar, SymbolLeaderboard, WeekdayBreakdown } from '../components/dashboard/Breakdowns';
import { Records } from '../components/dashboard/Records';
import { SessionsTable } from '../components/dashboard/SessionsTable';

type Tab = 'overview' | 'sessions' | 'returns';

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
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const activeCount = sessions.filter(s => isLiveSessionStatus(s.status)).length;
  const readyCount = sessions.filter(s => isConfigurableSessionStatus(s.status)).length;

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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-secondary">{greetingForNow()}, {firstName}</p>
          <h2 className="mt-1 font-serif text-[2rem] leading-tight tracking-tight text-ink">Your account at a glance</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('sessions')}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${activeCount > 0 ? 'border-gain/30 bg-gain-soft text-gain hover:border-gain/60' : 'border-line bg-surface text-secondary hover:text-ink'}`}
          >
            <span className="relative flex h-2 w-2" aria-hidden="true">
              {activeCount > 0 && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gain opacity-60" />}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${activeCount > 0 ? 'bg-gain' : readyCount > 0 ? 'bg-attention' : 'bg-muted/50'}`} />
            </span>
            {loading ? 'Checking sessions…' : activeCount > 0 ? `${activeCount} live session${activeCount > 1 ? 's' : ''}` : readyCount > 0 ? `${readyCount} ready to trade` : 'No live session'}
          </button>
          {user?.broker && <span className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-secondary">{brokerLabel(brokerFromProfile(user.broker))}</span>}
          <button type="button" onClick={() => { fetchData(); setStatsGen(n => n + 1); }} title="Refresh" className="inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 text-xs text-muted hover:bg-subtle hover:text-ink">
            <RefreshCw className={`h-3.5 w-3.5 ${loading || statsLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
            {refreshedAt ? `Updated ${refreshedAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}` : 'Refresh'}
          </button>
        </div>
      </header>
      <Tabs label="Dashboard sections" items={TABS} value={tab} onChange={setTab} />
      {loadError && <LoadError message="Session history could not be refreshed. Previously loaded sessions may be out of date." onRetry={() => fetchData()} />}
      {statsError && <LoadError message="Performance could not be refreshed. Any figures shown are from the previous update." onRetry={() => setStatsGen(n => n + 1)} />}
      {figuresError && <LoadError message="Balances and monthly result could not be refreshed. Any figures shown are from the previous update." onRetry={() => fetchData()} />}

      <div role="tabpanel" id="dashboard-sections-panel-overview" aria-labelledby="dashboard-sections-tab-overview" hidden={tab !== 'overview'} className="animate-fade-in flex flex-col gap-4">
          {tab === 'overview' && <>
          <EquityHero stats={perfStats} loading={statsLoading} monthlyPnl={monthlyPnl} cash={cash} equity={equity} figuresLoading={figuresLoading} />
          <KpiStrip stats={perfStats} loading={statsLoading} />
          <div className="grid gap-4 @min-[1000px]:grid-cols-2">
            <DailyPnlChart stats={perfStats} loading={statsLoading} />
            <MonthlyBars stats={perfStats} loading={statsLoading} onOpenMonths={() => setTab('returns')} />
          </div>
          <div className="grid items-start gap-4 @min-[1000px]:grid-cols-[1.2fr_1fr]">
            <SymbolLeaderboard stats={perfStats} loading={statsLoading} />
            <div className="flex flex-col gap-4">
              <PnlCalendar stats={perfStats} />
              <WeekdayBreakdown stats={perfStats} />
            </div>
          </div>
          <Records stats={perfStats} />
          <p className="text-center text-[11px] text-muted">
            Performance uses live trades only and refreshes every few minutes{perfStats?.asOfDate ? ` · as of ${perfStats.asOfDate}` : ''}.
          </p>
          </>}
      </div>

      <div role="tabpanel" id="dashboard-sections-panel-sessions" aria-labelledby="dashboard-sections-tab-sessions" hidden={tab !== 'sessions'} className="animate-fade-in">
        <SessionsTable sessions={sessions} loading={loading} loadError={loadError} onRetry={() => fetchData()} onOpenSession={onOpenSession} downloadingId={downloadingId} onDownload={handleDownload} />
      </div>

      <div role="tabpanel" id="dashboard-sections-panel-returns" aria-labelledby="dashboard-sections-tab-returns" hidden={tab !== 'returns'} className="animate-fade-in">
          {tab === 'returns' && <MonthComparison stats={perfStats} loading={statsLoading} />}
      </div>
    </div>
  );
}
