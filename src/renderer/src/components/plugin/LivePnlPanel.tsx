import { useState, useEffect, useRef, useMemo } from 'react';
import { Activity, LineChart as LineIcon, CandlestickChart } from 'lucide-react';
import { pluginApi } from '../../lib/pluginApi';
import { isAfterMarketCloseIST } from '../../lib/brokerCash';
import TradeActionPill from './TradeActionPill';
import TickerScopeDropdown, { formatTickerScopeLabel } from './TickerScopeDropdown';
import SessionTradingChart from './SessionTradingChart';

interface PnlPoint {
  ts: number;
  total: number;
  realized: number;
  unrealized: number;
  symbols?: Record<string, SymbolRow>;
}

export interface SymbolRow {
  unrealized_pnl: number;
  realized_pnl?: number;
  qty?: number;
  side?: string;
}

export interface LogTickerHint {
  symbol: string;
  quantity: string | number;
  pnl: string | number;
  price?: string | number;
  signal: string;
  action: string;
  timeMs?: number | null;
  chartTimeMs?: number | null;
  capital?: string | number;
  simulation?: boolean | null;
}

interface Props {
  sessionId: string;
  logRows?: LogTickerHint[];
  /** Epoch ms when simulation handed off to live trading. */
  liveStartedAtMs?: number | null;
}

type ChartType = 'area' | 'candle';

const IST = 'Asia/Kolkata';
const IST_OFFSET_MS = 5.5 * 3600 * 1000;

function parseChartTimeMs(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw <= 0) return null;
    return raw < 1e12 ? Math.round(raw * 1000) : Math.round(raw);
  }
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    return parseChartTimeMs(o.$date ?? o.$numberLong ?? o.$numberInt);
  }
  const s = String(raw).trim();
  if (!s) return null;
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    const ms = Date.parse(s);
    return Number.isNaN(ms) ? null : ms;
  }
  const normalized = s.includes('T') ? s : s.replace(' ', 'T');
  const ist = Date.parse(`${normalized}+05:30`);
  if (!Number.isNaN(ist)) return ist;
  const fallback = Date.parse(normalized);
  return Number.isNaN(fallback) ? null : fallback;
}

function isPlausibleTs(ms: number): boolean {
  const min = Date.parse('2020-01-01T00:00:00+05:30');
  const max = Date.now() + 36 * 3600 * 1000;
  return ms >= min && ms <= max;
}

function roundTs(ms: number): number {
  return Math.round(ms / 1000) * 1000;
}

function mergeBySecond(existing: PnlPoint[], incoming: PnlPoint[]): PnlPoint[] {
  const byTs = new Map<number, PnlPoint>();
  for (const p of existing) {
    if (!isPlausibleTs(p.ts)) continue;
    byTs.set(roundTs(p.ts), { ...p, ts: roundTs(p.ts) });
  }
  for (const p of incoming) {
    if (!isPlausibleTs(p.ts)) continue;
    byTs.set(roundTs(p.ts), { ...p, ts: roundTs(p.ts) });
  }
  return Array.from(byTs.values()).sort((a, b) => a.ts - b.ts);
}

function downsamplePoints(points: PnlPoint[], maxPoints = 220, keepTs: number | null = null): PnlPoint[] {
  if (points.length <= maxPoints) return points;
  const start = points[0].ts;
  const end = points[points.length - 1].ts;
  const bucketMs = Math.max(Math.ceil((end - start) / (maxPoints - 2)), 1000);
  const picked = new Map<number, PnlPoint>();
  for (const p of points) {
    const key = Math.floor((p.ts - start) / bucketMs);
    picked.set(key, p);
  }
  const out = Array.from(picked.values()).sort((a, b) => a.ts - b.ts);
  const first = points[0];
  const last = points[points.length - 1];
  if (out[0]?.ts !== first.ts) out.unshift(first);
  if (out[out.length - 1]?.ts !== last.ts) out.push(last);
  if (keepTs != null) {
    const near = points.reduce((best, p) =>
      Math.abs(p.ts - keepTs) < Math.abs(best.ts - keepTs) ? p : best, points[0]);
    if (!out.some((p) => p.ts === near.ts)) {
      out.push(near);
      out.sort((a, b) => a.ts - b.ts);
    }
  }
  return out;
}

interface CandlePoint {
  ts: number;
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  total: number;
  isSwitch?: boolean;
}

function alignBucketStart(ts: number, bucketMs: number): number {
  return Math.floor((ts + IST_OFFSET_MS) / bucketMs) * bucketMs - IST_OFFSET_MS;
}

function candlesFromSegment(
  points: PnlPoint[],
  bucketMs: number,
  spanForLabel: number,
): CandlePoint[] {
  if (points.length === 0) return [];
  const buckets = new Map<number, PnlPoint[]>();
  for (const p of points) {
    const key = alignBucketStart(p.ts, bucketMs);
    const list = buckets.get(key);
    if (list) list.push(p);
    else buckets.set(key, [p]);
  }

  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([bucketStart, samples]) => {
      const ordered = [...samples].sort((a, b) => a.ts - b.ts);
      const totals = ordered.map((s) => s.total);
      const open = ordered[0].total;
      const close = ordered[ordered.length - 1].total;
      return {
        ts: bucketStart,
        label: formatAxisTick(bucketStart, spanForLabel),
        open,
        high: Math.max(...totals),
        low: Math.min(...totals),
        close,
        total: close,
        isSwitch: false,
      };
    });
}

/** Bucket P&L samples into fixed-width OHLC candles on a single IST-aligned clock. */
function bucketForCandles(points: PnlPoint[], liveAt: number | null = null): CandlePoint[] {
  if (points.length === 0) return [];
  const span = Math.max(points[points.length - 1].ts - points[0].ts, 1);
  const bucketMs = span > 4 * 3600 * 1000 ? 5 * 60 * 1000 : 60 * 1000;

  const sim = liveAt != null ? points.filter((p) => p.ts < liveAt) : points;
  const live = liveAt != null ? points.filter((p) => p.ts >= liveAt) : [];
  const simCandles = candlesFromSegment(sim, bucketMs, span);
  const liveCandles = candlesFromSegment(live, bucketMs, span);

  if (liveAt != null && simCandles.length > 0) {
    simCandles[simCandles.length - 1] = { ...simCandles[simCandles.length - 1], isSwitch: true };
  } else if (liveAt != null && liveCandles.length > 0) {
    liveCandles[0] = { ...liveCandles[0], isSwitch: true };
  }

  return [...simCandles, ...liveCandles];
}

function formatAxisTick(ts: number, spanMs: number) {
  const d = new Date(ts);
  if (spanMs > 14 * 3600 * 1000) {
    return d.toLocaleString('en-IN', {
      timeZone: IST,
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
  return d.toLocaleTimeString('en-IN', {
    timeZone: IST,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatMoney(n: number) {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function normalizeSymbols(raw: unknown): Record<string, SymbolRow> {
  if (!raw || typeof raw !== 'object') return {};
  const mapped: Record<string, SymbolRow> = {};
  const entries = Array.isArray(raw)
    ? (raw as unknown[]).map((item) => {
        const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
        return [String(row.symbol ?? row.Symbol ?? ''), row] as const;
      })
    : Object.entries(raw as Record<string, unknown>);

  for (const [sym, data] of entries) {
    const key = String(sym || '').toUpperCase();
    if (!key) continue;
    const row = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
    const unrealized = Number(row.unrealized_pnl ?? row.live_unrealized_pnl ?? row.pnl ?? 0);
    const realized = Number(row.realized_pnl ?? 0);
    const qty = Number(row.qty ?? row.quantity ?? row.Quantity ?? row.net_qty);
    const side = row.side != null ? String(row.side) : undefined;
    mapped[key] = {
      unrealized_pnl: Number.isFinite(unrealized) ? unrealized : 0,
      realized_pnl: Number.isFinite(realized) ? realized : 0,
      qty: Number.isFinite(qty) ? qty : undefined,
      side,
    };
  }
  return mapped;
}

function symbolNet(row: SymbolRow | undefined): { realized: number; unrealized: number; total: number } {
  if (!row) return { realized: 0, unrealized: 0, total: 0 };
  const realized = Number(row.realized_pnl) || 0;
  const unrealized = Number(row.unrealized_pnl) || 0;
  return { realized, unrealized, total: realized + unrealized };
}

function carrySymbolMaps(points: PnlPoint[]): PnlPoint[] {
  const last: Record<string, SymbolRow> = {};
  return points.map((p) => {
    if (p.symbols) {
      for (const [k, v] of Object.entries(p.symbols)) last[k] = v;
    }
    return { ...p, symbols: { ...last, ...(p.symbols ?? {}) } };
  });
}

function scopedPoint(p: PnlPoint, selected: Set<string>): PnlPoint {
  let realized = 0;
  let unrealized = 0;
  for (const sym of selected) {
    const part = symbolNet(p.symbols?.[sym]);
    realized += part.realized;
    unrealized += part.unrealized;
  }
  return { ...p, total: realized + unrealized, realized, unrealized };
}

function ensureDrawable(points: PnlPoint[]): PnlPoint[] {
  if (points.length !== 1) return points;
  const p = points[0];
  return [{ ...p, ts: p.ts - 5 * 60 * 1000 }, p];
}

function pnlSeriesFromLogs(logs: LogTickerHint[] | undefined, selected: Set<string> | null = null): PnlPoint[] {
  if (!logs?.length) return [];
  const events: Array<{ ts: number; symbol: string; pnl: number }> = [];
  for (const row of logs) {
    const ts = parseChartTimeMs(row.chartTimeMs ?? row.timeMs);
    if (ts == null || !isPlausibleTs(ts)) continue;
    const pnl = Number(row.pnl);
    if (!Number.isFinite(pnl)) continue;
    const sym = String(row.symbol || '').toUpperCase();
    if (!sym || sym === '-') continue;
    if (selected && !selected.has(sym)) continue;
    events.push({ ts: roundTs(ts), symbol: sym, pnl });
  }
  events.sort((a, b) => a.ts - b.ts);
  const lastBySym = new Map<string, number>();
  const byTs = new Map<number, number>();
  for (const ev of events) {
    lastBySym.set(ev.symbol, ev.pnl);
    let total = 0;
    for (const v of lastBySym.values()) total += v;
    byTs.set(ev.ts, total);
  }
  return Array.from(byTs.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([ts, total]) => ({ ts, total, realized: 0, unrealized: total }));
}

function snapshotPoint(s: {
  sampled_at?: string;
  source_ts?: number;
  data: { total_pnl: number; realized_pnl: number; live_unrealized_pnl: number; symbols?: Record<string, unknown>; ts?: number };
}): PnlPoint | null {
  const ts = parseChartTimeMs(s.data?.ts)
    ?? parseChartTimeMs(s.source_ts)
    ?? parseChartTimeMs(s.sampled_at);
  if (ts == null || !isPlausibleTs(ts)) return null;
  const total = Number(s.data.total_pnl);
  if (!Number.isFinite(total)) return null;
  return {
    ts: roundTs(ts),
    total,
    realized: Number(s.data.realized_pnl) || 0,
    unrealized: Number(s.data.live_unrealized_pnl) || 0,
    symbols: normalizeSymbols(s.data.symbols),
  };
}

function buildSyncedSeries(
  logs: LogTickerHint[] | undefined,
  snapshots: PnlPoint[],
  livePoint: PnlPoint | null,
  liveAt: number | null,
  selected: Set<string> | null = null,
): PnlPoint[] {
  const logSeries = pnlSeriesFromLogs(logs, selected);
  const goodSnaps = carrySymbolMaps(snapshots.filter((p) => isPlausibleTs(p.ts)));
  const lastSnapSymbols = goodSnaps[goodSnaps.length - 1]?.symbols;
  const live = livePoint && isPlausibleTs(livePoint.ts)
    ? { ...livePoint, symbols: { ...(lastSnapSymbols ?? {}), ...(livePoint.symbols ?? {}) } }
    : null;

  const remap = (pts: PnlPoint[]) => (selected ? pts.map((p) => scopedPoint(p, selected)) : pts);

  if (liveAt != null) {
    const simLogs = logSeries.filter((p) => p.ts < liveAt);
    let livePts = remap(goodSnaps.filter((p) => p.ts >= liveAt - 60_000));
    if (live && live.ts >= liveAt - 60_000) {
      livePts = mergeBySecond(livePts, remap([live]));
    }
    if (livePts.length === 0) {
      livePts = logSeries.filter((p) => p.ts >= liveAt);
    }
    return ensureDrawable(downsamplePoints(mergeBySecond(simLogs, livePts), 220, liveAt));
  }

  let pts = remap(goodSnaps);
  if (live) pts = mergeBySecond(pts, remap([live]));
  if (pts.length === 0) pts = logSeries;
  return ensureDrawable(downsamplePoints(pts, 220, null));
}

function inferLiveStartedAt(explicit: number | null | undefined, logs?: LogTickerHint[]): number | null {
  if (explicit != null && Number.isFinite(explicit) && isPlausibleTs(explicit)) return explicit;
  if (!logs?.length) return null;
  const liveTimes = logs
    .filter((r) => r.simulation === false)
    .map((r) => parseChartTimeMs(r.chartTimeMs ?? r.timeMs))
    .filter((n): n is number => n != null && isPlausibleTs(n));
  if (liveTimes.length === 0) return null;
  return Math.min(...liveTimes);
}

function parseSessionLiveStart(raw: unknown): number | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const session = (o.session && typeof o.session === 'object' ? o.session : o) as Record<string, unknown>;
  const ms = parseChartTimeMs(session.simulation_live_started_at);
  return ms != null && isPlausibleTs(ms) ? ms : null;
}

function tickersFromLogs(logs: LogTickerHint[] | undefined): Record<string, SymbolRow> {
  if (!logs?.length) return {};
  const lastBySym = new Map<string, LogTickerHint>();
  for (const row of logs) {
    const sym = String(row.symbol || '').toUpperCase();
    if (!sym || sym === '-') continue;
    lastBySym.set(sym, row);
  }
  const mapped: Record<string, SymbolRow> = {};
  for (const [sym, row] of lastBySym) {
    const pnl = Number(row.pnl);
    const qty = Number(row.quantity);
    mapped[sym] = {
      unrealized_pnl: Number.isFinite(pnl) ? pnl : 0,
      realized_pnl: 0,
      qty: Number.isFinite(qty) ? qty : undefined,
      side: row.signal && row.signal !== '-' ? String(row.signal) : undefined,
    };
  }
  return mapped;
}

function mergeSymbolMaps(...maps: Array<Record<string, SymbolRow> | undefined>): Record<string, SymbolRow> {
  const out: Record<string, SymbolRow> = {};
  for (const map of maps) {
    if (!map) continue;
    for (const [sym, row] of Object.entries(map)) {
      const prev = out[sym];
      if (!prev) {
        out[sym] = { ...row };
        continue;
      }
        out[sym] = {
          unrealized_pnl: Number.isFinite(row.unrealized_pnl) ? row.unrealized_pnl : prev.unrealized_pnl,
          realized_pnl: Number.isFinite(row.realized_pnl as number)
            ? row.realized_pnl
            : prev.realized_pnl,
          qty: row.qty && row.qty !== 0 ? row.qty : (prev.qty ?? row.qty),
          side: row.side || prev.side,
        };
    }
  }
  return out;
}

export default function LivePnlPanel({ sessionId, logRows, liveStartedAtMs }: Props) {
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
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const lastSampledRef = useRef(0);
  const seededRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    lastSampledRef.current = 0;
    seededRef.current = false;
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
      pluginApi.getLivePnlHistory(sessionId).then(res => {
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
        if (last && !seededRef.current) {
          seededRef.current = true;
          applySnapshot(last);
        } else if (last) {
          setSymbols((prev) => {
            if (Object.keys(prev).length > 0) return mergeSymbolMaps(prev, last.symbols);
            return last.symbols && Object.keys(last.symbols).length > 0 ? last.symbols : prev;
          });
        }
      }).catch(() => {});
    };

    loadHistory();
    const historyRefresh = setInterval(loadHistory, 30000);

    pluginApi.getSessionById(sessionId).then((res) => {
      if (cancelled) return;
      const ms = parseSessionLiveStart(res.data);
      if (ms != null) setSessionLiveAt(ms);
    }).catch(() => {});

    intervalRef.current = setInterval(async () => {
      try {
        const res = await pluginApi.getLivePnl(sessionId);
        if (cancelled) return;
        setConnected(true);
        if (res.data.ready && res.data.data) {
          seededRef.current = true;
          setReady(true);
          setTotalPnl(res.data.data.total_pnl);
          setRealizedPnl(res.data.data.realized_pnl);
          setUnrealizedPnl(res.data.data.live_unrealized_pnl);
          const liveSymbols = normalizeSymbols(res.data.data.symbols);
          if (Object.keys(liveSymbols).length > 0) {
            setSymbols((prev) => mergeSymbolMaps(prev, liveSymbols));
          }

          const engineTs = parseChartTimeMs(res.data.data.ts);
          const ts = engineTs != null && isPlausibleTs(engineTs) ? engineTs : null;
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
        if (res.data.stopped) setStopped(true);
      } catch {
        if (!cancelled) setConnected(false);
      }
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(intervalRef.current);
      clearInterval(historyRefresh);
    };
  }, [sessionId]);

  const liveAt = inferLiveStartedAt(liveStartedAtMs ?? sessionLiveAt, logRows);
  const logTickers = useMemo(() => tickersFromLogs(logRows), [logRows]);
  const tickerMap = useMemo(
    () => mergeSymbolMaps(logTickers, livePoint?.symbols, snapshots[snapshots.length - 1]?.symbols, symbols),
    [logTickers, livePoint, snapshots, symbols],
  );
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

  const chartHistory = useMemo(
    () => buildSyncedSeries(logRows, snapshots, livePoint, liveAt, selectedSet),
    [logRows, snapshots, livePoint, liveAt, selectedSet],
  );
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
  const liveEndPoint = useMemo(() => {
    if (chartHistory.length === 0) return null;
    if (liveAt == null) return chartHistory[chartHistory.length - 1];
    const livePts = chartHistory.filter((p) => p.ts >= liveAt);
    return livePts.length ? livePts[livePts.length - 1] : null;
  }, [chartHistory, liveAt]);

  const scopedCards = useMemo(() => {
    if (!selectedSet) {
      return { total: totalPnl, realized: realizedPnl, unrealized: unrealizedPnl };
    }
    let realized = 0;
    let unrealized = 0;
    for (const sym of selectedSet) {
      const part = symbolNet(tickerMap[sym]);
      realized += part.realized;
      unrealized += part.unrealized;
    }
    return { total: realized + unrealized, realized, unrealized };
  }, [selectedSet, totalPnl, realizedPnl, unrealizedPnl, tickerMap]);

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
                tickers={tickerList.map(([symbol, row]) => ({ symbol, pnl: symbolNet(row).total }))}
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
              {simEndPoint && (
                <span className={simEndPoint.total >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                  Sim P&amp;L {formatMoney(simEndPoint.total)}
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
                    <p className="truncate text-[13px] font-semibold text-slate-900">{sym}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {data.side && <TradeActionPill value={data.side} />}
                      {data.qty != null && Number.isFinite(Number(data.qty)) && Number(data.qty) !== 0 && (
                        <span className="text-[11px] text-slate-500">Qty {Number.isInteger(Number(data.qty)) ? data.qty : Number(data.qty).toLocaleString('en-IN')}</span>
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
