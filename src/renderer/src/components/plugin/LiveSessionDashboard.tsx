import {
  type TradeLogRow,
  parseInstantMs,
  pickStatus,
  isPlaceholderValue,
  pickLivePnlSymbols,
  pricesFromLivePnl,
  buildQtyTimeline,
  buildPnlTimeline,
  mergeIncomingLogs,
  normalizeLogs,
  formatMoney,
  formatLogDate,
  formatLogTime,
  withRmsLogRows,
  formatCell,
  formatQuantity,
  resolveSimulation,
  withPyramidSimCloseRows,
  textIsClientManualExit,
  remapBrokenSymbolExitRows,
  remapSquareOffLogRow,
  remapSimCloseExitRows,
  remapManualStopExitRows,
  presentExitRows,
  extractTradingSession
} from '../../lib/liveSessionModel';
import { Tabs } from '../ui/Tabs';
import { Pagination } from '../ui/Pagination';
import { usePagination } from '../../lib/usePagination';
import { useState, useEffect, useRef, useMemo, Fragment } from 'react';
import { StopCircle, Download, RefreshCw, Loader2, WifiOff, IndianRupee, Settings2, Clock, XCircle, Lock } from 'lucide-react';
import { pluginApi } from '../../lib/pluginApi';
import { useSessionDataSource } from '../../lib/sessionDataSource';
import {
  parsePyramidPnlBySymbol,
  parsePyramidPriceBySymbol,
  extractSimClosePricesFromHistory,
  mergePyramidMaps,
  isSimClosePriceWindow,
  isSimCloseIstLog
} from '../../lib/pyramidPnl';
import { shouldFetchPyramidPnl } from '../../lib/istClock';
import { useToast } from '../ui/Toast';
import ConfirmDialog from '../ui/ConfirmDialog';
import AlertDialog from '../ui/AlertDialog';
import SessionNotifications from './SessionNotifications';
import { useSessionEvents } from '../../lib/useSessionEvents';
import {
  sessionStatusLabel,
  resolveSessionStatus,
  isLiveSessionStatus,
  isTerminalSessionStatus,
  isConfigurableSessionStatus,
  isSimulationRunningStatus,
  simulationStatusLabel,
  simulationStatusBadgeClass
} from '../../lib/sessionStatus';
import { downloadSessionCsv } from '../../lib/downloadSessionCsv';
import { pickCash, rememberBrokerCash } from '../../lib/brokerCash';

import { lockReasonText, parseLockedOutSymbols, resolveLockedOut, type LockedOutSymbol } from '../../lib/lockedOut';
import LivePnlPanel from './LivePnlPanel';
import TradeActionPill from './TradeActionPill';
import { pluginErrorMessage } from '../../lib/pluginErrors';
import type { TradingSession } from '../../lib/pluginApi';
import { formatCountdown, simulationStartMs } from '../../lib/istClock';
import { parseExitedSymbols, type ExitedSymbol } from '../../lib/exitedSymbols';

interface Props {
  sessionId: string;
  /** Known status from the sessions list (e.g. trading_active) — used until dashboard hydrates. */
  initialStatus?: string;
  /** Free cash captured from the TOTP / broker-connect response. */
  initialFreeCash?: number | null;
  /** Past / ended sessions open read-only (no stop controls, slower refresh). */
  readOnly?: boolean;
  onStop: () => void;
  onConfigure: () => void;
}

type Tab = 'logs' | 'pnl' | 'alerts';

export default function LiveSessionDashboard({ sessionId, initialStatus, initialFreeCash, readOnly = false, onStop, onConfigure }: Props) {
  const toast = useToast();
  const source = useSessionDataSource();
  const canControl = !source.viewOnly;
  const [tab, setTab] = useState<Tab>('logs');
  const [summaryHost, setSummaryHost] = useState<HTMLDivElement | null>(null);
  const [positionsHost, setPositionsHost] = useState<HTMLDivElement | null>(null);
  const [logSearch, setLogSearch] = useState('');
  // Engine errors for this session: popup (owner, running session), toast for warnings,
  // and the Notifications tab (raw details for admins)
  const sessionEvents = useSessionEvents(sessionId, {
    readOnly,
    onWarning: (e) => toast.info(`${e.title}${e.symbol ? ` (${e.symbol})` : ''}`),
  });
  const unreadCount = sessionEvents.unread.size;
  useEffect(() => {
    if (tab === 'alerts' && unreadCount > 0) sessionEvents.markAllSeen();
  }, [tab, unreadCount]);
  const [logs, setLogs] = useState<TradeLogRow[]>([]);
  const [sessionStatus, setSessionStatus] = useState<string>(initialStatus || '');
  const [simulationStatus, setSimulationStatus] = useState<string | null>(null);
  const [liveStartedAtMs, setLiveStartedAtMs] = useState<number | null>(null);
  const [availableCash, setAvailableCash] = useState<number | null>(
    initialFreeCash != null && Number.isFinite(initialFreeCash) ? initialFreeCash : null
  );
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [confirming, setConfirming] = useState<'stop' | 'cancel' | null>(null);
  const [stopping, setStopping] = useState(false);
  const [cancellingSchedule, setCancellingSchedule] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [pyramidPnlBySymbol, setPyramidPnlBySymbol] = useState<Record<string, number>>({});
  const [pyramidPriceBySymbol, setPyramidPriceBySymbol] = useState<Record<string, number>>({});
  const [exitedSymbols, setExitedSymbols] = useState<ExitedSymbol[]>([]);
  const [gatewayLockedOut, setGatewayLockedOut] = useState<LockedOutSymbol[]>([]);
  const [scheduledStartAtMs, setScheduledStartAtMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const seenLiveRef = useRef(!readOnly && isLiveSessionStatus(initialStatus));
  const logsRef = useRef<TradeLogRow[]>([]);
  const simCloseLtpRef = useRef<Record<string, number>>({});
  const fetchForSessionRef = useRef(sessionId);

  useEffect(() => {
    if (isLiveSessionStatus(sessionStatus || initialStatus)) seenLiveRef.current = true;
    if (isTerminalSessionStatus(sessionStatus || initialStatus)) seenLiveRef.current = false;
  }, [sessionStatus, initialStatus]);

  const effectiveStatus = sessionStatus || initialStatus || '';
  // Scheduled start time: prefer the backend's scheduled_start, else today 10:30 IST.
  const scheduledAtMs = scheduledStartAtMs ?? simulationStartMs(nowMs);
  const isScheduled = isConfigurableSessionStatus(effectiveStatus) && !readOnly;
  const scheduledRemainingMs = isScheduled ? scheduledAtMs - nowMs : 0;
  // Keep Stop visible for live sessions even if a poll briefly returns a
  // non-active status (e.g. authenticated / unknown). Only hide on terminal.
  const showStopControls =
    !isConfigurableSessionStatus(effectiveStatus) &&
    !isTerminalSessionStatus(effectiveStatus) &&
    (seenLiveRef.current || isLiveSessionStatus(effectiveStatus) || !readOnly);

  const isLive = showStopControls;
  const hasLiveCutoff = liveStartedAtMs != null;
  const simLabel = simulationStatusLabel(simulationStatus);
  const simRunning = isSimulationRunningStatus(simulationStatus);
  const displayLogs = useMemo(() => {
    const flagged = logs.map((row) => (
      row.manualExit || textIsClientManualExit(row) ? { ...row, manualExit: true } : row
    ));
    const withRms = withRmsLogRows(flagged, exitedSymbols, liveStartedAtMs);
    const withManualExits = remapBrokenSymbolExitRows(withRms, exitedSymbols);
    const withPyramid = withPyramidSimCloseRows(
      withManualExits,
      pyramidPnlBySymbol,
      liveStartedAtMs,
      exitedSymbols,
      pyramidPriceBySymbol,
    );
    const withSimExit = remapSimCloseExitRows(withPyramid, liveStartedAtMs);
    const withSquareOff = withSimExit.map(remapSquareOffLogRow);
    return presentExitRows(remapManualStopExitRows(withSquareOff, effectiveStatus, liveStartedAtMs));
  }, [logs, pyramidPnlBySymbol, pyramidPriceBySymbol, liveStartedAtMs, exitedSymbols, effectiveStatus]);

  // EXP104: stocks locked at 13:00 for the rest of the day
  const lockedOut = useMemo(() => resolveLockedOut(gatewayLockedOut, logs), [gatewayLockedOut, logs]);
  const lockedOutReasons = useMemo(() => {
    const reasons = Array.from(new Set(lockedOut.map((x) => lockReasonText(x.reason))));
    return reasons.length === 1 ? reasons[0] : null;
  }, [lockedOut]);

  const fetchDashboard = async () => {
    const forSession = sessionId;
    // Critical calls render logs/status fast. Past (read-only) sessions skip the
    // live-VM calls — the VM is usually gone and they hang on timeout. Live
    // sessions still fetch everything on the same cadence.
    const calls: Array<Promise<unknown>> = [];
    if (!readOnly) calls.push(source.getDashboard(sessionId));
    calls.push(source.getSessionStatus(sessionId));
    calls.push(source.getSessionTrades(sessionId));
    calls.push(source.getSessionById(sessionId));
    calls.push(source.getPnlSummary(sessionId));
    if (!readOnly) {
      calls.push(source.getFullSessionState(sessionId));
      calls.push(source.getLivePnl(sessionId));
    }
    const results = await Promise.allSettled(calls);
    if (fetchForSessionRef.current !== forSession) return;
    const [dashRes, statusRes, tradesRes, tsRes, pnlRes, fullRes, livePnlRes] = (readOnly
      ? [undefined, ...results, undefined, undefined]
      : results) as Array<PromiseSettledResult<unknown> | undefined>;

    const got = (r?: PromiseSettledResult<unknown>) => (r?.status === 'fulfilled' ? (r.value as { data?: unknown })?.data ?? null : null);

    const dash = got(dashRes) as Record<string, any> | null;
    const pluginStatus = got(statusRes);
    const tradesRaw = got(tradesRes);
    const tradingSession = (got(tsRes) as { session?: unknown } | Record<string, unknown> | null)
      ? extractTradingSession(got(tsRes))
      : null;
    const pnlSummary = got(pnlRes) as Record<string, any> | null;
    const fullState = got(fullRes) as {
      python_session_id?: string; status?: unknown; snapshot?: unknown; logs?: unknown; locked_out_symbols?: unknown;
    } | null;
    // /session always returns the user's latest session — only trust it for this id
    const fullMatches = fullState?.python_session_id === sessionId ? fullState : null;
    if (fullMatches) setGatewayLockedOut(parseLockedOutSymbols(fullMatches.locked_out_symbols));

    const livePnl = got(livePnlRes) as { data?: unknown } | null;
    const anyOk = [dashRes, statusRes, tradesRes, tsRes, pnlRes, fullRes, livePnlRes].some(r => r?.status === 'fulfilled');
    setConnected(anyOk);

    const snapshot = (fullMatches?.snapshot as any)?.data
      || fullMatches?.snapshot
      || (dash?.snapshot as any)?.data
      || dash?.snapshot
      || null;

    let liveStartMs = liveStartedAtMs;
    if (tradingSession) {
      if (typeof tradingSession.simulation_status === 'string' && tradingSession.simulation_status.trim()) {
        setSimulationStatus(tradingSession.simulation_status.trim().toLowerCase());
      }
      const liveStart = parseInstantMs(tradingSession.simulation_live_started_at);
      if (liveStart != null) {
        liveStartMs = liveStart;
        setLiveStartedAtMs(liveStart);
      }
      const schedStart = parseInstantMs((tradingSession as { scheduled_start?: { start_at?: unknown } }).scheduled_start?.start_at);
      if (schedStart != null) setScheduledStartAtMs(schedStart);
    }

    const resolved = resolveSessionStatus(
      pickStatus(pluginStatus),
      pickStatus(fullMatches?.status),
      pickStatus(dash?.status),
      pickStatus(snapshot),
      pickStatus(tradingSession),
      initialStatus,
    );
    if (resolved) {
      setSessionStatus((prev) => {
        // Don't let a flaky poll demote a live session to a non-terminal status.
        if (
          isLiveSessionStatus(prev) &&
          !isLiveSessionStatus(resolved) &&
          !isTerminalSessionStatus(resolved)
        ) {
          return prev;
        }
        return resolved;
      });
    }

    const cash = pickCash(snapshot, pluginStatus, fullMatches?.status, dash?.status, tradingSession, pnlSummary?.current);
    if (cash != null) {
      setAvailableCash(cash);
      // Only cache the signed-in user's own cash; an admin viewing another account must not overwrite it.
      if (canControl) rememberBrokerCash(cash);
    }

    // Prefer the richest log source. After market close the live VM often
    // returns empty qty/price — keep last known values instead of flashing —.
    const merged = mergeIncomingLogs(
      normalizeLogs(fullMatches?.logs),
      normalizeLogs(tradesRaw),
      normalizeLogs(dash?.logs),
      logsRef.current,
      [],
      pickLivePnlSymbols(snapshot),
      pickLivePnlSymbols(livePnl),
      [],
      liveStartMs,
    );
    if (merged.length > 0) {
      logsRef.current = merged;
      setLogs(merged);
    }

    if (anyOk) setLastUpdated(new Date());
    // Logs/status are in — never keep the UI waiting on the slow chart history.
    setLoading(false);

    // Enrichment (background): chart history + pyramid / RMS-exit overlays.
    const historyRaw = await source.getLivePnlHistory(sessionId, undefined, 10)
      .then(r => r.data).catch(() => null);
    const fetchPyramid = source.supportsPyramidPnl() && shouldFetchPyramidPnl(readOnly);
    const pyramidRaw = fetchPyramid
      ? await source.getPyramidPnl(sessionId).then(r => r.data).catch(() => null)
      : null;
    const exitedRaw = source.supportsExitedSymbols()
      ? await source.getExitedSymbols(sessionId).then(r => r.data).catch(() => null)
      : null;
    if (fetchForSessionRef.current !== forSession) return;

    if (fetchPyramid) {
      const fromApi = pyramidRaw ? parsePyramidPnlBySymbol(pyramidRaw) : {};
      if (Object.keys(fromApi).length > 0) setPyramidPnlBySymbol(fromApi);

      const stillInSim = liveStartMs == null && !readOnly;
      const priceFromPyramid = pyramidRaw ? parsePyramidPriceBySymbol(pyramidRaw) : {};
      const priceFromHistory = extractSimClosePricesFromHistory(historyRaw);
      const priceFromLive = mergePyramidMaps(pricesFromLivePnl(snapshot), pricesFromLivePnl(livePnl));
      if (stillInSim && isSimClosePriceWindow(Date.now())) {
        simCloseLtpRef.current = mergePyramidMaps(simCloseLtpRef.current, priceFromLive);
      }
      simCloseLtpRef.current = mergePyramidMaps(simCloseLtpRef.current, priceFromHistory);
      const mergedPrices = mergePyramidMaps(
        priceFromHistory,
        simCloseLtpRef.current,
        priceFromPyramid,
      );
      if (Object.keys(mergedPrices).length > 0) setPyramidPriceBySymbol(mergedPrices);
    }
    if (source.supportsExitedSymbols() && exitedRaw != null) {
      setExitedSymbols(parseExitedSymbols(exitedRaw));
    }
    // Re-merge logs now that the qty timeline from history is available.
    const reMerged = mergeIncomingLogs(
      normalizeLogs(fullMatches?.logs),
      normalizeLogs(tradesRaw),
      normalizeLogs(dash?.logs),
      logsRef.current,
      buildQtyTimeline(historyRaw),
      pickLivePnlSymbols(snapshot),
      pickLivePnlSymbols(livePnl),
      buildPnlTimeline(historyRaw),
      liveStartMs,
    );
    if (reMerged.length > 0) {
      logsRef.current = reMerged;
      setLogs(reMerged);
    }
  };

  useEffect(() => {
    fetchForSessionRef.current = sessionId;
    setLoading(true);
    setLogs([]);
    logsRef.current = [];
    simCloseLtpRef.current = {};
    setLastUpdated(null);
    setConnected(true);
    setSimulationStatus(null);
    setLiveStartedAtMs(null);
    setPyramidPnlBySymbol({});
    setPyramidPriceBySymbol({});
    setExitedSymbols([]);
    setScheduledStartAtMs(null);
    seenLiveRef.current = !readOnly && isLiveSessionStatus(initialStatus);
    if (initialStatus) setSessionStatus(initialStatus);
    else setSessionStatus('');
    if (initialFreeCash != null && Number.isFinite(initialFreeCash)) setAvailableCash(initialFreeCash);
    else setAvailableCash(null);
    setTab('logs');
    fetchDashboard();

    // Live sessions poll; past sessions only need a one-shot load (plus a slow refresh).
    const ms = readOnly ? 60000 : 10000;
    intervalRef.current = setInterval(fetchDashboard, ms);
    return () => clearInterval(intervalRef.current);
  }, [sessionId, readOnly]);

  // Reverse countdown tick while the session is scheduled (authenticated, not started).
  useEffect(() => {
    if (!isConfigurableSessionStatus(effectiveStatus)) return;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [effectiveStatus, sessionId]);

  // Force stop was removed (12 Nov): it marked the session stopped without closing the
  // broker book, leaving live positions open. Stop is the only way to end a session.
  // The owner's actions call the user API (pluginApi) as the signed-in user.
  // A view-only source (admin mode) must never reach them, even if a control
  // is rendered by mistake: admins stop sessions through AdminSessionControls.
  const handleStop = async () => {
    if (!canControl) return;
    setStopping(true);
    try {
      await pluginApi.stopTrading(sessionId);
      toast.success('Session stopped');
      setSessionStatus('stopped');
      seenLiveRef.current = false;
      setConfirming(null);
      if (availableCash != null) rememberBrokerCash(availableCash);
      onStop();
    } catch (err: any) {
      toast.error(pluginErrorMessage(err, 'Could not stop the session. It may still be running.'));
      setConfirming(null);
    } finally {
      setStopping(false);
    }
  };

  const handleCancelSchedule = async () => {
    if (!canControl) return;
    setCancellingSchedule(true);
    try {
      await pluginApi.abandonSession(sessionId);
      toast.success('Scheduled start cancelled');
      setConfirming(null);
      onStop();
    } catch (err: any) {
      toast.error(pluginErrorMessage(err, 'Could not cancel the scheduled start. Please try again.'));
    } finally {
      setCancellingSchedule(false);
    }
  };

  const handleDownload = async () => {
    if (!canControl) return;
    setDownloading(true);
    try {
      // Past sessions: Mongo logs first (VM final-tradebook is usually gone).
      const kind = await downloadSessionCsv(sessionId, { preferLogs: readOnly || !isLive });
      toast.success(kind === 'logs' ? 'Session logs CSV downloaded' : 'Tradebook CSV downloaded');
    } catch (err: any) {
      const status = err?.response?.status;
      toast.error(status === 404
        ? 'No tradebook or logs are available for this session yet.'
        : 'Could not download the tradebook. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const statusColor = (() => {
    if (simRunning && !hasLiveCutoff) return 'text-attention';
    const s = (sessionStatus || '').toLowerCase();
    if (['trading_active', 'active', 'running', 'started'].includes(s)) return 'text-gain';
    if (['stopped', 'completed', 'abandoned'].includes(s)) return 'text-muted';
    if (['error', 'failed'].includes(s)) return 'text-loss';
    return 'text-ink';
  })();

  const filteredLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    return displayLogs.map((log, index) => ({ log, index })).filter(({ log }) => !q || [log.symbol, log.action, log.signal].some(v => String(v).toLowerCase().includes(q)));
  }, [displayLogs, logSearch]);
  const logPages = usePagination(filteredLogs, 50, logSearch);

  return (
    <div className="page-stack @container">
      <div ref={setSummaryHost} />
      {isScheduled && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-attention/25 bg-attention-soft px-5 py-3.5 shadow-sm">
          <Clock className="h-4 w-4 shrink-0 text-attention" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[13px] font-medium text-attention">
            Session will start at 10:30 AM IST
            {scheduledRemainingMs > 0 ? (
              <> — <span className="font-semibold tabular-nums">{formatCountdown(scheduledRemainingMs)}</span> remaining</>
            ) : (
              ' — starting now…'
            )}
          </p>
          {canControl && (
            <button
              type="button"
              onClick={() => setConfirming('cancel')}
              disabled={cancellingSchedule}
              className="flex items-center gap-1.5 rounded-lg bg-attention-action px-2.5 py-1.5 text-[12px] font-semibold text-on-primary transition-colors hover:bg-attention-action focus:outline-none focus-visible:ring-2 focus-visible:ring-attention/40 disabled:opacity-50"
            >
              {cancellingSchedule ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <XCircle className="h-3.5 w-3.5" aria-hidden="true" />}
              Cancel schedule
            </button>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-line/80 bg-surface px-5 py-4 shadow-sm">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted">Free cash</p>
          <p className="mt-0.5 flex items-center gap-1 text-[15px] font-semibold text-ink">
            <IndianRupee className="h-3.5 w-3.5 text-gain" aria-hidden="true" />
            {availableCash != null ? formatMoney(availableCash).replace(/^₹\s?/, '') : <span className="font-medium text-muted">—</span>}
          </p>
        </div>

        <div className="hidden h-8 w-px bg-subtle sm:block" aria-hidden="true" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted">Status</p>
            {simLabel && (
              <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${simulationStatusBadgeClass(simulationStatus)}`}>
                Simulation · {simLabel}
              </span>
            )}
            {!connected && (
              <span className="flex items-center gap-1 rounded-md bg-attention-soft px-1.5 py-0.5 text-[11px] font-semibold text-attention">
                <WifiOff className="h-3 w-3" aria-hidden="true" /> Reconnecting…
              </span>
            )}
          </div>
          <p className={`mt-0.5 text-[15px] font-semibold capitalize ${statusColor}`}>
            {simRunning && !hasLiveCutoff
              ? 'Simulating'
              : (sessionStatusLabel(sessionStatus) || 'Loading…')}
          </p>
          {lastUpdated && (
            <p className="text-[11px] text-muted">
              Updated {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {canControl && isConfigurableSessionStatus(effectiveStatus) && !readOnly && (
            <button type="button" onClick={onConfigure}
              className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] font-semibold text-secondary transition-colors hover:bg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-gain/30">
              <Settings2 className="h-3.5 w-3.5" aria-hidden="true" /> Configure
            </button>
          )}
          {canControl && (
            <button type="button" onClick={handleDownload} disabled={downloading}
              className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] font-semibold text-secondary transition-colors hover:bg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-gain/30 disabled:opacity-50">
              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Download className="h-3.5 w-3.5" aria-hidden="true" />}
              CSV
            </button>
          )}
          {canControl && showStopControls && (
            <>
              <button type="button" onClick={() => setConfirming('stop')}
                className="flex items-center gap-1.5 rounded-lg bg-attention-action px-2.5 py-1.5 text-[12px] font-semibold text-on-primary transition-colors hover:bg-attention-action focus:outline-none focus-visible:ring-2 focus-visible:ring-attention/40">
                <StopCircle className="h-3.5 w-3.5" aria-hidden="true" /> Stop
              </button>
            </>
          )}
        </div>
      </div>

      {lockedOut.length > 0 && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-attention/25 bg-attention-soft px-5 py-3.5 shadow-sm"
        >
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-attention" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-attention">
              Locked for today
              {lockedOutReasons ? <span className="font-medium"> ({lockedOutReasons})</span> : null}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {lockedOut.map((x) => (
                <span
                  key={x.symbol}
                  title={x.message}
                  className="rounded-md bg-attention-soft px-1.5 py-0.5 text-[11px] font-semibold text-attention"
                >
                  {x.symbol}
                  {lockedOutReasons ? null : <span className="font-medium"> · {lockReasonText(x.reason)}</span>}
                </span>
              ))}
            </div>
            <p className="mt-1.5 text-[12px] text-attention/80">
              These stocks will not trade again in this session. The engine has stopped running cycles for them.
            </p>
          </div>
        </div>
      )}

      <div ref={setPositionsHost} />
      <Tabs label="Session data" value={tab} onChange={setTab} items={[{ id: 'logs', label: 'Trade logs' }, { id: 'pnl', label: 'Live P&L' }, { id: 'alerts', label: 'Notifications', count: unreadCount }]} />

      <div role="tabpanel" id="session-data-panel-alerts" aria-labelledby="session-data-tab-alerts" hidden={tab !== 'alerts'}>
        <SessionNotifications
          events={sessionEvents.events}
          raw={!canControl}
          expired={sessionEvents.expired}
          expiresAt={sessionEvents.expiresAt}
          loaded={sessionEvents.loaded}
          unread={sessionEvents.unread}
        />
      </div>

      {sessionEvents.popup && (
        <AlertDialog
          open
          tone={sessionEvents.popup.severity === 'critical' ? 'critical' : 'error'}
          title={sessionEvents.popup.title}
          message={sessionEvents.popup.message}
          action={sessionEvents.popup.action}
          reference={sessionEvents.popup.event_id}
          meta={[
            sessionEvents.popup.symbol,
            sessionEvents.popup.count > 1 ? `${sessionEvents.popup.count} times` : null,
          ].filter(Boolean).join(' · ') || undefined}
          onClose={() => sessionEvents.dismiss(sessionEvents.popup!)}
          secondaryLabel="All notifications"
          onSecondary={() => { sessionEvents.markAllSeen(); setTab('alerts'); }}
        />
      )}

      {/* Keep both panes mounted so Live P&L history/polling survives tab switches. */}
      <div role="tabpanel" id="session-data-panel-pnl" aria-labelledby="session-data-tab-pnl" hidden={tab !== 'pnl'}>
        <LivePnlPanel
          key={sessionId}
          summaryHost={summaryHost}
          positionsHost={positionsHost}
          sessionId={sessionId}
          logRows={logs}
          liveStartedAtMs={liveStartedAtMs}
          readOnly={readOnly}
          simCloseRows={displayLogs
            .filter((row) => isSimCloseIstLog(row.timeMs))
            .map((row) => ({ symbol: row.symbol, pnl: row.pnl }))}
        />
      </div>

      <div role="tabpanel" id="session-data-panel-logs" aria-labelledby="session-data-tab-logs" hidden={tab !== 'logs'}>
        <div className="mb-3 flex flex-wrap items-center gap-3"><input type="search" value={logSearch} onChange={e => setLogSearch(e.target.value)} placeholder="Filter symbol, signal or action…" aria-label="Search trade logs" className="min-w-48 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink" /><span className="text-xs text-muted">{filteredLogs.length} matching rows</span>{logSearch && <button type="button" onClick={() => setLogSearch('')} className="text-xs text-gain">Clear filter</button>}</div>
        <div className="rounded-xl border border-line/80 bg-surface shadow-sm">
          {loading && logs.length === 0 && displayLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-muted">
              <RefreshCw className="h-5 w-5 animate-spin" aria-hidden="true" />
              <p className="text-sm">Loading trades…</p>
            </div>
          ) : displayLogs.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-medium text-muted">No trades yet</p>
              <p className="mt-1 text-xs text-muted">
                Executed trades will appear here as the engine runs.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {displayLogs.some(l => resolveSimulation(l, { hasLiveCutoff, liveStartedAtMs })) && (
                <p className="border-b border-line bg-subtle px-3.5 py-2 text-[11px] text-muted">
                  Rows tagged Sim are simulation trades. Untagged rows are live.
                </p>
              )}
              {displayLogs.some(l => l.rmsHit) && (
                <p className="border-b border-loss/25 bg-loss-soft px-3.5 py-2 text-[11px] text-loss">
                  Rows tagged RMS were exited by risk management and may not appear in the engine log.
                </p>
              )}
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-[11px] font-semibold uppercase tracking-wider text-muted">
                    <th scope="col" className="px-3.5 py-2.5">Time</th>
                    <th scope="col" className="px-3.5 py-2.5">Symbol</th>
                    <th scope="col" className="px-3.5 py-2.5">Signal</th>
                    <th scope="col" className="px-3.5 py-2.5">Action</th>
                    <th scope="col" className="px-3.5 py-2.5 text-right">Qty</th>
                    <th scope="col" className="px-3.5 py-2.5 text-right">Price</th>
                    <th scope="col" className="px-3.5 py-2.5 text-right">Change</th>
                    <th scope="col" className="px-3.5 py-2.5 text-right">P&L</th>
                    <th scope="col" className="px-3.5 py-2.5 text-right">Capital</th>
                  </tr>
                </thead>
                <tbody>
                  {logPages.rows.map(({ log, index: i }) => {
                    const pnlNum = Number(log.pnl);
                    const changeNum = Number(log.change);
                    const pnlColor = Number.isFinite(pnlNum) ? (pnlNum >= 0 ? 'text-gain' : 'text-loss') : 'text-secondary';
                    const changeColor = Number.isFinite(changeNum) ? (changeNum >= 0 ? 'text-gain' : 'text-loss') : 'text-secondary';
                    const cutoff = { hasLiveCutoff, liveStartedAtMs };
                    const isSimTrade = resolveSimulation(log, cutoff);
                    const prev = i > 0 ? displayLogs[i - 1] : null;
                    const prevWasSim = prev != null && resolveSimulation(prev, cutoff);
                    const showLiveDivider = !log.rmsHit && !isSimTrade && (i === 0 || prevWasSim);

                    return (
                      <Fragment key={`${log.time}-${log.symbol}-${log.rmsHit ? 'rms' : 'row'}-${i}`}>
                        {showLiveDivider && (
                          <tr className="bg-gain-soft">
                            <td colSpan={9} className="px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gain">
                              Live trading
                            </td>
                          </tr>
                        )}
                        <tr
                          className={`border-b border-line text-secondary last:border-0 ${
                            log.rmsHit
                              ? 'bg-loss-soft hover:bg-loss-soft'
                              : log.lockedOut
                                ? 'bg-attention-soft shadow-[inset_3px_0_0_0_var(--ui-attention)] hover:bg-attention-soft'
                                : isSimTrade
                                ? 'bg-subtle hover:bg-subtle'
                                : 'hover:bg-subtle'
                          }`}
                          title={log.rmsHit
                            ? (log.rmsReason ? `Hit RMS · ${log.rmsReason}` : 'Hit RMS')
                            : log.lockedOut
                              ? log.lockMessage
                              : isSimTrade ? 'Simulation trade' : undefined}
                        >
                          <td className="px-3.5 py-2 text-xs font-mono">
                            <div className="flex flex-col gap-0.5">
                              {log.timeMs != null && (
                                <span className="whitespace-nowrap">{formatLogDate(log.timeMs)}</span>
                              )}
                              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                                {log.rmsHit && (
                                  <span className="rounded bg-loss-soft px-1 py-px text-[11px] font-semibold uppercase tracking-wide text-loss">
                                    RMS
                                  </span>
                                )}
                                {log.lockedOut && !log.rmsHit && (
                                  <span className="rounded bg-attention-soft px-1 py-px text-[11px] font-semibold uppercase tracking-wide text-attention">
                                    Locked
                                  </span>
                                )}
                                {isSimTrade && !log.rmsHit && (
                                  <span className="rounded bg-line px-1 py-px text-[11px] font-semibold uppercase tracking-wide text-muted">
                                    Sim
                                  </span>
                                )}
                                <span>
                                  {log.timeMs != null ? formatLogTime(log.timeMs) : log.time}
                                </span>
                              </span>
                            </div>
                          </td>
                          <td className="px-3.5 py-2 font-semibold">
                            {log.symbol}
                            {log.lockedOut && log.lockMessage && (
                              <p className="mt-0.5 max-w-[18rem] whitespace-normal text-[11px] font-medium leading-snug text-attention">
                                {log.lockMessage}
                              </p>
                            )}
                          </td>
                          <td className="px-3.5 py-2">
                            <TradeActionPill value={log.signal} />
                          </td>
                          <td className="px-3.5 py-2">
                            <TradeActionPill value={log.action} />
                          </td>
                          <td className="px-3.5 py-2 text-right font-mono">{formatQuantity(log.quantity, log.action, log.signal)}</td>
                          <td className="px-3.5 py-2 text-right font-mono">{formatCell(log.price, true)}</td>
                          <td className={`px-3.5 py-2 text-right font-mono ${changeColor}`}>
                            {isPlaceholderValue(log.change) ? '—' : `${Number.isFinite(changeNum) && changeNum > 0 ? '+' : ''}${formatCell(log.change)}${Number.isFinite(changeNum) ? '%' : ''}`}
                          </td>
                          <td className={`px-3.5 py-2 text-right font-mono ${pnlColor}`}>{formatCell(log.pnl, true)}</td>
                          <td className="px-3.5 py-2 text-right font-mono">{formatCell(log.capital, true)}</td>
                        </tr>
                      </Fragment>
                    );
                  })}
                  {filteredLogs.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-sm text-muted">No trades match this filter.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <Pagination {...logPages} label="Trade rows" />
      </div>

      <ConfirmDialog open={!!confirming}
        title={confirming === 'cancel' ? 'Cancel scheduled start?' : 'Stop session?'}
        description={confirming === 'cancel'
          ? 'This abandons the session. It will NOT auto-start at 10:30 AM. You can start a new session anytime.'
          : 'The engine will finish gracefully: it stops taking new positions and winds down the session.'}
        confirmLabel={confirming === 'cancel' ? 'Cancel schedule' : 'Stop session'}
        tone={confirming === 'cancel' ? 'danger' : 'warning'}
        busy={stopping || cancellingSchedule}
        onConfirm={() => (confirming === 'cancel' ? handleCancelSchedule() : handleStop())}
        onCancel={() => { if (!stopping && !cancellingSchedule) setConfirming(null); }} />
    </div>
  );
}
