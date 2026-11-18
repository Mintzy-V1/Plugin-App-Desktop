export { livePnlPollMs } from '../../lib/livePnlModel';
export type { SymbolRow, LogTickerHint } from '../../lib/livePnlModel';
import {
  type PnlPoint,
  type SymbolRow,
  type LogTickerHint,
  livePnlPollMs,
  type ChartType,
  IST,
  parseChartTimeMs,
  isPlausibleTs,
  roundTs,
  mergeBySecond,
  bucketForCandles,
  formatAxisTick,
  formatMoney,
  normalizeSymbols,
  symbolNet,
  snapshotPoint,
  buildSyncedSeries,
  inferLiveStartedAt,
  parseSessionLiveStart,
  resolveLogSimulation,
  tickerPhaseMap,
  tickerPhaseFor,
  sumSimClosePnl,
  tickersFromLogs,
  mergeSymbolMaps,
  overlaySimClosePnl
} from '../../lib/livePnlModel';
import { createPortal } from 'react-dom';
import { SessionResult } from './SessionResult';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Activity, LineChart as LineIcon, CandlestickChart } from 'lucide-react';
import { useSessionDataSource } from '../../lib/sessionDataSource';
import { isAfterMarketCloseIST } from '../../lib/brokerCash';

import TradeActionPill from './TradeActionPill';
import TickerScopeDropdown, { formatTickerScopeLabel } from './TickerScopeDropdown';
import SessionTradingChart from './SessionTradingChart';

interface Props {
  summaryHost?: HTMLElement | null;
  positionsHost?: HTMLElement | null;
  sessionId: string;
  logRows?: LogTickerHint[];
  /** Epoch ms when simulation handed off to live trading. */
  liveStartedAtMs?: number | null;
  /** 12:59 IST sim-close rows (same P&amp;L as the trade log overlay). */
  simCloseRows?: Array<{ symbol: string; pnl: string | number }>;
  /** Ended session: its P&L no longer changes, so poll rarely. */
  readOnly?: boolean;
}

function TickerPhaseBadge({ phase }: { phase: 'live' | 'simulation' }) {
  if (phase === 'live') {
    return (
      <span
        title="This ticker switched from simulation to live"
        className="rounded bg-gain-soft px-1 py-px text-[11px] font-semibold uppercase tracking-wide text-gain"
      >
        Live
      </span>
    );
  }
  return (
    <span
      title="This ticker stayed in simulation and did not pyramid"
      className="rounded bg-line px-1 py-px text-[11px] font-semibold tracking-wide text-muted"
    >
      Simulation
    </span>
  );
}


export default function LivePnlPanel({ sessionId, logRows, liveStartedAtMs, simCloseRows, readOnly = false, summaryHost, positionsHost }: Props) {
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
  const trendColor = isPositive ? 'text-gain' : 'text-loss';
  const bgColor = isPositive ? 'bg-gain-soft' : 'bg-loss-soft';
  const hasFigures = ready || chartHistory.length > 0 || tickerList.length > 0;
  const placeholder = !hasFigures;
  const marketClosed = isAfterMarketCloseIST();

  return (
    <div className="page-stack">
      {stopped && (
        <div className="rounded-xl border border-line bg-subtle px-4 py-2.5 text-sm text-secondary">
          Session ended. Figures below are the last recorded results.
        </div>
      )}
      {!stopped && marketClosed && hasFigures && (
        <div className="rounded-xl border border-line bg-subtle px-4 py-2.5 text-sm text-secondary">
          Market is closed. Showing the last P&amp;L from this session — it stays on screen.
        </div>
      )}
      {!stopped && !connected && (
        <div className="rounded-xl border border-attention/25 bg-attention-soft px-4 py-2.5 text-sm font-medium text-attention">
          Connection lost — retrying… {lastUpdated && `Last update ${lastUpdated.toLocaleTimeString('en-IN')}`}
        </div>
      )}
      {!stopped && connected && placeholder && (
        <div className="flex items-center gap-2 rounded-xl border border-brand/25 bg-info-soft px-4 py-2.5 text-sm font-medium text-info">
          <Activity className="h-4 w-4 animate-pulse" aria-hidden="true" />
          Waiting for the first P&amp;L update…
        </div>
      )}

      {summaryHost ? createPortal(<SessionResult total={placeholder ? '—' : formatMoney(scopedCards.total)} booked={placeholder ? '—' : formatMoney(scopedCards.realized)} open={placeholder ? '—' : formatMoney(scopedCards.unrealized)} positive={isPositive} bookedPositive={scopedCards.realized >= 0} openPositive={scopedCards.unrealized >= 0} scope={scopeLabel} unavailable={placeholder} />, summaryHost) : <SessionResult total={placeholder ? '—' : formatMoney(scopedCards.total)} booked={placeholder ? '—' : formatMoney(scopedCards.realized)} open={placeholder ? '—' : formatMoney(scopedCards.unrealized)} positive={isPositive} bookedPositive={scopedCards.realized >= 0} openPositive={scopedCards.unrealized >= 0} scope={scopeLabel} unavailable={placeholder} />}

      <div className="rounded-xl border border-line/80 bg-surface p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-ink">P&L over the day</p>
              <p className="mt-0.5 text-[11px] text-muted">
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
              <div role="group" aria-label="Chart type" className="flex gap-1 rounded-lg bg-subtle p-0.5">
                <button type="button" onClick={() => setChartType('area')}
                  aria-pressed={chartType === 'area'}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${
                    chartType === 'area' ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-secondary'
                  }`}>
                  <LineIcon className="h-3.5 w-3.5" aria-hidden="true" /> Line
                </button>
                <button type="button" onClick={() => setChartType('candle')}
                  aria-pressed={chartType === 'candle'}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${
                    chartType === 'candle' ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-secondary'
                  }`}>
                  <CandlestickChart className="h-3.5 w-3.5" aria-hidden="true" /> Candle
                </button>
              </div>
            </div>
          </div>

          {liveAt != null && (
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-attention-soft px-3 py-2 text-[12px]">
              <span className="font-semibold text-attention">Simulation stays on this chart</span>
              {simPnl != null && (
                <span className={simPnl >= 0 ? 'text-gain' : 'text-loss'}>
                  Sim P&amp;L {formatMoney(simPnl)}
                </span>
              )}
              {liveEndPoint && (
                <span className={liveEndPoint.total >= 0 ? 'text-gain' : 'text-loss'}>
                  Live P&amp;L {formatMoney(liveEndPoint.total)}
                </span>
              )}
              <span className="text-attention/80">
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
            <p className="rounded-xl bg-subtle px-4 py-10 text-center text-sm text-muted">
              {tickerList.length === 0
                ? 'The chart appears here as soon as a ticker reports P&L.'
                : `Not enough samples yet for ${scopeLabel}.`}
            </p>
          )}
        </div>

      <div className="rounded-xl border border-line/80 bg-surface p-4 shadow-sm">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-ink">Ticker P&amp;L</p>
            <p className="mt-0.5 text-[11px] text-muted">
              {tickerList.length > 0
                ? `${tickerList.length} symbol${tickerList.length === 1 ? '' : 's'} · tap a tile to plot it, or combine from the dropdown`
                : 'Per-stock results appear here as soon as the engine reports them'}
            </p>
          </div>
          {selectedSet && (
            <button
              type="button"
              onClick={() => setSelectedTickers(null)}
              className="text-[12px] font-semibold text-info hover:text-info focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 rounded-md px-1"
            >
              Select all
            </button>
          )}
        </div>
        {tickerList.length === 0 ? (
          <p className="rounded-xl bg-subtle px-4 py-6 text-center text-sm text-muted">
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
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${
                    solo
                      ? 'border-brand/25 bg-info-soft'
                      : inScope
                        ? 'border-line bg-subtle hover:border-line'
                        : 'border-line bg-surface opacity-50 hover:opacity-80'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <p className="truncate text-[13px] font-semibold text-ink">{sym}</p>
                      <TickerPhaseBadge phase={phase} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {data.side && <TradeActionPill value={data.side} />}
                      {data.qty != null && Number.isFinite(Number(data.qty)) && Number(data.qty) !== 0 && (
                        <span className="text-[11px] text-muted">
                          Qty {(() => {
                            const q = Math.abs(Number(data.qty));
                            return Number.isInteger(q) ? q : q.toLocaleString('en-IN');
                          })()}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className={`shrink-0 text-right text-[15px] font-semibold tabular-nums ${positive ? 'text-gain' : 'text-loss'}`}>
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
