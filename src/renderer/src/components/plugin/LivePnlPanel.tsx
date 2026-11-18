export type { SymbolRow } from '../../lib/livePnlModel';
export type { LogTickerHint } from '../../lib/livePnlModel';
export { livePnlPollMs } from '../../lib/livePnlModel';
import {
  type PnlPoint,
  type SymbolRow,
  type LogTickerHint,
  livePnlPollMs,
  type ChartType,
  IST,
  IST_OFFSET_MS,
  parseChartTimeMs,
  isPlausibleTs,
  roundTs,
  mergeBySecond,
  downsamplePoints,
  type CandlePoint,
  alignBucketStart,
  candlesFromSegment,
  bucketForCandles,
  formatAxisTick,
  formatMoney,
  POSITION_QTY_KEYS,
  pickPositionQty,
  normalizeSymbols,
  symbolNet,
  carrySymbolMaps,
  scopedPoint,
  ensureDrawable,
  pnlSeriesFromLogs,
  snapshotPoint,
  buildSyncedSeries,
  inferLiveStartedAt
} from '../../lib/livePnlModel';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Activity, LineChart as LineIcon, CandlestickChart } from 'lucide-react';
import { useSessionDataSource } from '../../lib/sessionDataSource';
import { isAfterMarketCloseIST } from '../../lib/brokerCash';
import { isWaitAction } from '../../lib/tradeSignals';
import TradeActionPill from './TradeActionPill';
import TickerScopeDropdown, { formatTickerScopeLabel } from './TickerScopeDropdown';
import SessionTradingChart from './SessionTradingChart';







interface Props {
  sessionId: string;
  logRows?: LogTickerHint[];
  /** Epoch ms when simulation handed off to live trading. */
  liveStartedAtMs?: number | null;
  /** 12:59 IST sim-close rows (same P&amp;L as the trade log overlay). */
  simCloseRows?: Array<{ symbol: string; pnl: string | number }>;
  /** Ended session: its P&L no longer changes, so poll rarely. */
  readOnly?: boolean;
}




















































function parseSessionLiveStart(raw: unknown): number | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const session = (o.session && typeof o.session === 'object' ? o.session : o) as Record<string, unknown>;
  const ms = parseChartTimeMs(session.simulation_live_started_at);
  return ms != null && isPlausibleTs(ms) ? ms : null;
}

function resolveLogSimulation(row: LogTickerHint, liveAt: number | null): boolean {
  if (row.simulation === true) return true;
  if (row.simulation === false) return false;
  return liveAt != null && row.timeMs != null && row.timeMs < liveAt;
}

/** Live if the ticker has any post-pyramid log; otherwise it stayed in simulation. */
function tickerPhaseMap(
  logs: LogTickerHint[] | undefined,
  liveAt: number | null,
): Record<string, 'live' | 'simulation'> {
  const out: Record<string, 'live' | 'simulation'> = {};
  if (!logs?.length) return out;
  for (const row of logs) {
    const sym = String(row.symbol || '').toUpperCase();
    if (!sym || sym === '-') continue;
    if (!resolveLogSimulation(row, liveAt)) out[sym] = 'live';
    else if (out[sym] !== 'live') out[sym] = 'simulation';
  }
  return out;
}

function tickerPhaseFor(
  symbol: string,
  phases: Record<string, 'live' | 'simulation'>,
  pyramidFlow: boolean,
): 'live' | 'simulation' {
  if (phases[symbol] === 'live') return 'live';
  if (phases[symbol] === 'simulation') return 'simulation';
  return pyramidFlow ? 'simulation' : 'live';
}

function TickerPhaseBadge({ phase }: { phase: 'live' | 'simulation' }) {
  if (phase === 'live') {
    return (
      <span
        title="This ticker switched from simulation to live"
        className="rounded bg-emerald-100 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-emerald-800"
      >
        Live
      </span>
    );
  }
  return (
    <span
      title="This ticker stayed in simulation and did not pyramid"
      className="rounded bg-slate-200/80 px-1 py-px text-[9px] font-semibold tracking-wide text-slate-500"
    >
      Simulation
    </span>
  );
}

function sumSimClosePnl(
  rows: Array<{ symbol: string; pnl: string | number }> | undefined,
  selected: Set<string> | null,
): number | null {
  if (!rows?.length) return null;
  const last = new Map<string, number>();
  for (const row of rows) {
    const sym = String(row.symbol || '').toUpperCase();
    if (!sym || sym === '-') continue;
    if (selected && !selected.has(sym)) continue;
    const pnl = Number(row.pnl);
    if (!Number.isFinite(pnl)) continue;
    last.set(sym, pnl);
  }
  if (last.size === 0) return null;
  let total = 0;
  for (const v of last.values()) total += v;
  return total;
}

function tickersFromLogs(
  logs: LogTickerHint[] | undefined,
  accept: (row: LogTickerHint) => boolean = () => true,
): Record<string, SymbolRow> {
  if (!logs?.length) return {};
  const lastBySym = new Map<string, LogTickerHint>();
  const lastQtyBySym = new Map<string, number>();
  for (const row of logs) {
    if (!accept(row)) continue;
    const sym = String(row.symbol || '').toUpperCase();
    if (!sym || sym === '-') continue;
    lastBySym.set(sym, row);
    if (isWaitAction(row.action) || isWaitAction(row.signal)) continue;
    const qty = Number(row.quantity);
    lastQtyBySym.set(sym, Number.isFinite(qty) ? qty : Number.NaN);
  }
  const mapped: Record<string, SymbolRow> = {};
  for (const [sym, row] of lastBySym) {
    const qty = lastQtyBySym.get(sym);
    const pnl = Number(row.pnl);
    mapped[sym] = {
      unrealized_pnl: Number.isFinite(pnl) ? pnl : 0,
      realized_pnl: 0,
      qty: qty != null && Number.isFinite(qty) ? qty : undefined,
      side: row.signal && row.signal !== '-' ? String(row.signal) : undefined,
    };
  }
  return mapped;
}

function mergeSymbolRow(prev: SymbolRow | undefined, row: SymbolRow): SymbolRow {
  if (!prev) return { ...row };
  const prevNet = symbolNet(prev).total;
  const nextNet = symbolNet(row).total;
  const incomingFlatZero =
    (row.qty == null || row.qty === 0)
    && nextNet === 0
    && prevNet !== 0;
  return {
    unrealized_pnl: incomingFlatZero
      ? prev.unrealized_pnl
      : (Number.isFinite(row.unrealized_pnl) ? row.unrealized_pnl : prev.unrealized_pnl),
    realized_pnl: incomingFlatZero
      ? prev.realized_pnl
      : (Number.isFinite(row.realized_pnl as number) ? row.realized_pnl : prev.realized_pnl),
    qty: Number.isFinite(row.qty as number) ? row.qty : (prev.qty ?? row.qty),
    side: row.side || prev.side,
  };
}

function mergeSymbolMaps(...maps: Array<Record<string, SymbolRow> | undefined>): Record<string, SymbolRow> {
  const out: Record<string, SymbolRow> = {};
  for (const map of maps) {
    if (!map) continue;
    for (const [sym, row] of Object.entries(map)) {
      out[sym] = mergeSymbolRow(out[sym], row);
    }
  }
  return out;
}

function overlaySimClosePnl(
  map: Record<string, SymbolRow>,
  simCloseRows: Array<{ symbol: string; pnl: string | number }> | undefined,
  phases: Record<string, 'live' | 'simulation'>,
  pyramidFlow: boolean,
): Record<string, SymbolRow> {
  if (!simCloseRows?.length) return map;
  const simPnl = new Map<string, number>();
  for (const row of simCloseRows) {
    const sym = String(row.symbol || '').toUpperCase();
    if (!sym || sym === '-') continue;
    const pnl = Number(row.pnl);
    if (!Number.isFinite(pnl)) continue;
    simPnl.set(sym, pnl);
  }
  if (simPnl.size === 0) return map;

  const out: Record<string, SymbolRow> = { ...map };
  for (const [sym, pnl] of simPnl) {
    const phase = tickerPhaseFor(sym, phases, pyramidFlow);
    if (phase !== 'simulation') continue;
    const cur = out[sym];
    out[sym] = {
      unrealized_pnl: pnl,
      realized_pnl: 0,
      qty: cur?.qty,
      side: cur?.side,
    };
  }
  return out;
}

export default function LivePnlPanel({ sessionId, logRows, liveStartedAtMs, simCloseRows, readOnly = false }: Props) {
  const source = useSessionDataSource();
  const pyramidFlow = source.supportsPyramidPnl();
  const [totalPnl, setTotalPnl] = useState(0);
  const [realizedPnl, setRealizedPnl] = useState(0);
  const [unrealizedPnl, setUnrealizedPnl] = useState(0);
  const [symbols, setSymbols] = useState<Record<string, SymbolRow>>({});
  const [snapshots, setSnapshots] = useState<PnlPoint[]>([]);
  const [livePoint, setLivePoint] = useState<PnlPoint | null>(null);
  const [stopped, setStopped] = useState(false);
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [chartType, setChartType] = useState<ChartType>('area');
  const [sessionLiveAt, setSessionLiveAt] = useState<number | null>(null);
  const [selectedTickers, setSelectedTickers] = useState<string[] | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const readOnlyRef = useRef(readOnly);
  readOnlyRef.current = readOnly;
  const lastSampledRef = useRef(0);
  const seededRef = useRef(false);
  const liveBookResetRef = useRef(false);
  const liveAtRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    lastSampledRef.current = 0;
    seededRef.current = false;
    liveBookResetRef.current = false;
    setSnapshots([]);
    setLivePoint(null);
    setSessionLiveAt(null);
    setSelectedTickers(null);
    setSymbols({});
    setTotalPnl(0);
    setRealizedPnl(0);
    setUnrealizedPnl(0);
    setStopped(false);
    setReady(false);
    setLastUpdated(null);
    setConnected(true);
    setHistoryLoaded(false);

    const applySnapshot = (point: PnlPoint, markReady = true) => {
      setTotalPnl(point.total);
      setRealizedPnl(point.realized);
      setUnrealizedPnl(point.unrealized);
      if (point.symbols && Object.keys(point.symbols).length > 0) {
        setSymbols((prev) => mergeSymbolMaps(prev, point.symbols));
      }
      if (markReady) {
        setReady(true);
        setLastUpdated(new Date(point.ts));
      }
    };

    const loadHistory = () => {
      source.getLivePnlHistory(sessionId, undefined, 10).then(res => {
        if (cancelled || !res.data?.snapshots?.length) return;
        const points = res.data.snapshots
          .map(snapshotPoint)
          .filter((p): p is PnlPoint => p != null);
        if (points.length === 0) {
          setSnapshots([]);
          return;
        }
        setSnapshots(mergeBySecond([], points));
        const last = points[points.length - 1];
        const liveAtNow = liveAtRef.current;
        const lastIsPreLive = liveAtNow != null && last != null && last.ts < liveAtNow;
        if (last && !lastIsPreLive && !seededRef.current) {
          seededRef.current = true;
          applySnapshot(last);
        } else if (last && !lastIsPreLive) {
          setSymbols((prev) => {
            if (Object.keys(prev).length > 0) return mergeSymbolMaps(prev, last.symbols);
            return last.symbols && Object.keys(last.symbols).length > 0 ? last.symbols : prev;
          });
        }
      }).catch(() => {}).finally(() => {
        if (!cancelled) setHistoryLoaded(true);
      });
    };

    loadHistory();
    const historyRefresh = setInterval(loadHistory, 30000);

    source.getSessionById(sessionId).then((res) => {
      if (cancelled) return;
      const ms = parseSessionLiveStart(res.data);
      if (ms != null) setSessionLiveAt(ms);
    }).catch(() => {});

    let stoppedSeen = false;
    const pollLivePnl = async () => {
      try {
        const res = await source.getLivePnl(sessionId);
        if (cancelled) return;
        setConnected(true);
        if (res.data.ready && res.data.data) {
          seededRef.current = true;
          setReady(true);
          setTotalPnl(res.data.data.total_pnl);
          setRealizedPnl(res.data.data.realized_pnl);
          setUnrealizedPnl(res.data.data.live_unrealized_pnl);
          const liveSymbols = normalizeSymbols(res.data.data.symbols);
          const engineTs = parseChartTimeMs(res.data.data.ts);
          const ts = engineTs != null && isPlausibleTs(engineTs) ? engineTs : null;
          const liveAtNow = liveAtRef.current;
          const sampleIsLive = liveAtNow != null && (ts == null || ts >= liveAtNow);
          if (Object.keys(liveSymbols).length > 0) {
            if (sampleIsLive && !liveBookResetRef.current) {
              liveBookResetRef.current = true;
              setSymbols(liveSymbols);
            } else {
              setSymbols((prev) => mergeSymbolMaps(prev, liveSymbols));
            }
          }
          setLastUpdated(ts != null ? new Date(ts) : new Date());
          if (ts != null && ts - lastSampledRef.current >= 2000) {
            lastSampledRef.current = ts;
            setLivePoint({
              ts: roundTs(ts),
              total: res.data.data.total_pnl,
              realized: res.data.data.realized_pnl,
              unrealized: res.data.data.live_unrealized_pnl,
              symbols: liveSymbols,
            });
          }
        }
        if (res.data.stopped) {
          stoppedSeen = true;
          setStopped(true);
        }
      } catch {
        if (!cancelled) setConnected(false);
      } finally {
        if (!cancelled) {
          const delay = livePnlPollMs({ viewOnly: source.viewOnly, readOnly: readOnlyRef.current, stopped: stoppedSeen });
          intervalRef.current = setTimeout(pollLivePnl, delay);
        }
      }
    };
    pollLivePnl();

    return () => {
      cancelled = true;
      clearTimeout(intervalRef.current);
      clearInterval(historyRefresh);
    };
  }, [sessionId]);

  const liveAt = inferLiveStartedAt(liveStartedAtMs ?? sessionLiveAt, logRows);
  liveAtRef.current = liveAt;
  const tickerPhases = useMemo(() => tickerPhaseMap(logRows, liveAt), [logRows, liveAt]);
  const logTickers = useMemo(
    () => tickersFromLogs(logRows, (row) => liveAt == null || resolveLogSimulation(row, liveAt)),
    [logRows, liveAt],
  );
  const liveLogTickers = useMemo(
    () => tickersFromLogs(logRows, (row) => liveAt != null && !resolveLogSimulation(row, liveAt)),
    [logRows, liveAt],
  );
  const tickerMap = useMemo(() => {
    if (liveAt == null) {
      return overlaySimClosePnl(
        mergeSymbolMaps(
          logTickers,
          snapshots[snapshots.length - 1]?.symbols,
          livePoint?.symbols,
          symbols,
        ),
        simCloseRows,
        tickerPhases,
        pyramidFlow,
      );
    }
    const preLive = snapshots.filter((p) => p.ts < liveAt);
    const postLive = snapshots.filter((p) => p.ts >= liveAt);
    const simBook = overlaySimClosePnl(
      mergeSymbolMaps(logTickers, preLive[preLive.length - 1]?.symbols),
      simCloseRows,
      tickerPhases,
      pyramidFlow,
    );
    const liveBook = mergeSymbolMaps(
      postLive[postLive.length - 1]?.symbols,
      livePoint && livePoint.ts >= liveAt ? livePoint.symbols : undefined,
      liveBookResetRef.current ? symbols : undefined,
    );
    const names = new Set([
      ...Object.keys(simBook),
      ...Object.keys(liveBook),
      ...Object.keys(tickerPhases),
    ]);
    const out: Record<string, SymbolRow> = {};
    for (const sym of names) {
      if (tickerPhaseFor(sym, tickerPhases, pyramidFlow) === 'live') {
        const logged = liveLogTickers[sym];
        const base = liveBook[sym] ?? {
          unrealized_pnl: 0,
          realized_pnl: 0,
          side: logged?.side ?? simBook[sym]?.side,
        };
        out[sym] = {
          ...base,
          qty: logged && Number.isFinite(logged.qty as number) ? logged.qty : base.qty,
          side: logged?.side || base.side,
        };
      } else if (simBook[sym] || logTickers[sym]) {
        const logged = logTickers[sym];
        const base = simBook[sym] ?? logged;
        out[sym] = {
          ...base!,
          qty: logged && Number.isFinite(logged.qty as number) ? logged.qty : base?.qty,
          side: logged?.side || base?.side,
        };
      }
    }
    return out;
  }, [logTickers, liveLogTickers, livePoint, snapshots, symbols, simCloseRows, tickerPhases, liveAt, pyramidFlow]);
  const tickerList = useMemo(
    () => Object.entries(tickerMap).sort((a, b) => a[0].localeCompare(b[0])),
    [tickerMap],
  );
  const tickerNames = useMemo(() => tickerList.map(([s]) => s), [tickerList]);
  const selectedSet = useMemo(() => {
    if (selectedTickers == null || selectedTickers.length === 0) return null;
    const available = new Set(tickerNames);
    const picked = selectedTickers.filter((s) => available.has(s)).sort((a, b) => a.localeCompare(b));
    if (picked.length === 0 || picked.length === tickerNames.length) return null;
    return new Set(picked);
  }, [selectedTickers, tickerNames]);
  const scopeLabel = formatTickerScopeLabel(selectedSet ? [...selectedSet] : null, tickerNames.length);

  const chartHistory = useMemo(() => {
    // While chart history is still loading and no live point exists yet, hold
    // the graph instead of falling back to trade logs (sparse rows would draw
    // a wrong curve). The log fallback still works once history has genuinely
    // returned empty (pre-snapshot sessions).
    if (!historyLoaded && !livePoint && snapshots.length === 0) return [];
    return buildSyncedSeries(logRows, snapshots, livePoint, liveAt, selectedSet);
  }, [historyLoaded, logRows, snapshots, livePoint, liveAt, selectedSet]);
  const spanMs = chartHistory.length > 1
    ? chartHistory[chartHistory.length - 1].ts - chartHistory[0].ts
    : 0;
  const candleData = useMemo(
    () => bucketForCandles(chartHistory, liveAt).map((c) => ({
      ts: c.ts,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    })),
    [chartHistory, liveAt],
  );
  const linePoints = useMemo(
    () => chartHistory.map((p) => ({ ts: p.ts, value: p.total })),
    [chartHistory],
  );
  const simEndPoint = useMemo(() => {
    if (liveAt == null) return null;
    let last: PnlPoint | null = null;
    for (const p of chartHistory) {
      if (p.ts <= liveAt) last = p;
    }
    return last;
  }, [chartHistory, liveAt]);
  const simCloseTotal = useMemo(
    () => sumSimClosePnl(simCloseRows, selectedSet),
    [simCloseRows, selectedSet],
  );
  const simPnl = simCloseTotal ?? simEndPoint?.total ?? null;
  const liveEndPoint = useMemo(() => {
    if (chartHistory.length === 0) return null;
    if (liveAt == null) return chartHistory[chartHistory.length - 1];
    const livePts = chartHistory.filter((p) => p.ts >= liveAt);
    return livePts.length ? livePts[livePts.length - 1] : null;
  }, [chartHistory, liveAt]);

  const scopedCards = useMemo(() => {
    const fromTickers = (syms: Iterable<string>) => {
      let realized = 0;
      let unrealized = 0;
      for (const sym of syms) {
        const part = symbolNet(tickerMap[sym]);
        realized += part.realized;
        unrealized += part.unrealized;
      }
      return { total: realized + unrealized, realized, unrealized };
    };
    if (selectedSet) return fromTickers(selectedSet);
    if (liveAt != null) {
      return { total: totalPnl, realized: realizedPnl, unrealized: unrealizedPnl };
    }
    const held = fromTickers(Object.keys(tickerMap));
    if (totalPnl === 0 && held.total !== 0) return held;
    return { total: totalPnl, realized: realizedPnl, unrealized: unrealizedPnl };
  }, [selectedSet, totalPnl, realizedPnl, unrealizedPnl, tickerMap, liveAt]);

  const isPositive = scopedCards.total >= 0;
  const trendColor = isPositive ? 'text-emerald-600' : 'text-red-600';
  const bgColor = isPositive ? 'bg-emerald-50' : 'bg-red-50';
  const hasFigures = ready || chartHistory.length > 0 || tickerList.length > 0;
  const placeholder = !hasFigures;
  const marketClosed = isAfterMarketCloseIST();

  return (
    <div className="page-stack">
      {stopped && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
          Session ended. Figures below are the last recorded results.
        </div>
      )}
      {!stopped && marketClosed && hasFigures && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
          Market is closed. Showing the last P&amp;L from this session — it stays on screen.
        </div>
      )}
      {!stopped && !connected && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700">
          Connection lost — retrying… {lastUpdated && `Last update ${lastUpdated.toLocaleTimeString('en-IN')}`}
        </div>
      )}
      {!stopped && connected && placeholder && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700">
          <Activity className="h-4 w-4 animate-pulse" aria-hidden="true" />
          Waiting for the first P&amp;L update…
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm" aria-live="off">
        <div className="grid grid-cols-3 divide-x divide-slate-100">
          <div className={`px-5 py-4 ${placeholder ? '' : bgColor}`}>
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Total P&amp;L</p>
            <p className={`mt-1 text-xl font-semibold tracking-tight ${placeholder ? 'text-slate-300' : trendColor}`}>
              {placeholder ? '—' : formatMoney(scopedCards.total)}
            </p>
            {selectedSet && (
              <p className="mt-0.5 truncate text-[11px] text-slate-400">{scopeLabel}</p>
            )}
          </div>
          <div className="px-5 py-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Booked</p>
            <p className={`mt-1 text-xl font-semibold tracking-tight ${placeholder ? 'text-slate-300' : scopedCards.realized >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {placeholder ? '—' : formatMoney(scopedCards.realized)}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">Already closed trades</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Open</p>
            <p className={`mt-1 text-xl font-semibold tracking-tight ${placeholder ? 'text-slate-300' : scopedCards.unrealized >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {placeholder ? '—' : formatMoney(scopedCards.unrealized)}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">Still in the market</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-slate-900">P&L over the day</p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {scopeLabel}
                {chartType === 'candle'
                  ? ` · 1m P&L candles · ${candleData.length} bars`
                  : chartHistory.length > 1
                    ? ` · ${chartHistory.length} samples · from ${formatAxisTick(chartHistory[0].ts, spanMs)}`
                    : ' · pick tickers to plot'}
                {liveAt != null ? ' · includes simulation' : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <TickerScopeDropdown
                tickers={tickerList.map(([symbol, row]) => ({
                  symbol,
                  pnl: symbolNet(row).total,
                  phase: tickerPhaseFor(symbol, tickerPhases, pyramidFlow),
                }))}
                selected={selectedSet ? [...selectedSet] : null}
                onChange={setSelectedTickers}
              />
              <div role="group" aria-label="Chart type" className="flex gap-1 rounded-lg bg-slate-100 p-0.5">
                <button type="button" onClick={() => setChartType('area')}
                  aria-pressed={chartType === 'area'}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
                    chartType === 'area' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}>
                  <LineIcon className="h-3.5 w-3.5" aria-hidden="true" /> Line
                </button>
                <button type="button" onClick={() => setChartType('candle')}
                  aria-pressed={chartType === 'candle'}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
                    chartType === 'candle' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}>
                  <CandlestickChart className="h-3.5 w-3.5" aria-hidden="true" /> Candle
                </button>
              </div>
            </div>
          </div>

          {liveAt != null && (
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-amber-50/80 px-3 py-2 text-[12px]">
              <span className="font-semibold text-amber-800">Simulation stays on this chart</span>
              {simPnl != null && (
                <span className={simPnl >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                  Sim P&amp;L {formatMoney(simPnl)}
                </span>
              )}
              {liveEndPoint && (
                <span className={liveEndPoint.total >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                  Live P&amp;L {formatMoney(liveEndPoint.total)}
                </span>
              )}
              <span className="text-amber-800/80">
                Switched to live at {formatAxisTick(liveAt, spanMs)}
              </span>
            </div>
          )}

          {(chartType === 'candle' ? candleData.length > 1 : linePoints.length > 1) ? (
            <SessionTradingChart
              mode={chartType}
              line={linePoints}
              candles={candleData}
              liveAt={liveAt}
            />
          ) : (
            <p className="rounded-xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-400">
              {tickerList.length === 0
                ? 'The chart appears here as soon as a ticker reports P&L.'
                : `Not enough samples yet for ${scopeLabel}.`}
            </p>
          )}
        </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-slate-900">Ticker P&amp;L</p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {tickerList.length > 0
                ? `${tickerList.length} symbol${tickerList.length === 1 ? '' : 's'} · tap a tile to plot it, or combine from the dropdown`
                : 'Per-stock results appear here as soon as the engine reports them'}
            </p>
          </div>
          {selectedSet && (
            <button
              type="button"
              onClick={() => setSelectedTickers(null)}
              className="text-[12px] font-semibold text-blue-600 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 rounded-md px-1"
            >
              Select all
            </button>
          )}
        </div>
        {tickerList.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
            No ticker results yet.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {tickerList.map(([sym, data]) => {
              const total = Number(data.realized_pnl ?? 0) + Number(data.unrealized_pnl ?? 0);
              const positive = total >= 0;
              const inScope = selectedSet == null || selectedSet.has(sym);
              const solo = selectedSet?.size === 1 && selectedSet.has(sym);
              const phase = tickerPhaseFor(sym, tickerPhases, pyramidFlow);
              return (
                <button
                  key={sym}
                  type="button"
                  onClick={() => {
                    if (solo) setSelectedTickers(null);
                    else setSelectedTickers([sym]);
                  }}
                  aria-pressed={solo}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
                    solo
                      ? 'border-blue-300 bg-blue-50/70'
                      : inScope
                        ? 'border-slate-100 bg-slate-50/80 hover:border-slate-200'
                        : 'border-slate-100 bg-white opacity-50 hover:opacity-80'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <p className="truncate text-[13px] font-semibold text-slate-900">{sym}</p>
                      <TickerPhaseBadge phase={phase} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {data.side && <TradeActionPill value={data.side} />}
                      {data.qty != null && Number.isFinite(Number(data.qty)) && Number(data.qty) !== 0 && (
                        <span className="text-[11px] text-slate-500">
                          Qty {(() => {
                            const q = Math.abs(Number(data.qty));
                            return Number.isInteger(q) ? q : q.toLocaleString('en-IN');
                          })()}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className={`shrink-0 text-right text-[15px] font-semibold tabular-nums ${positive ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatMoney(total)}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
