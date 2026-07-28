import { useState, useEffect, useRef, useId, useMemo } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Wallet, Activity, LineChart as LineIcon, BarChart3 } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid,
} from 'recharts';
import { pluginApi } from '../../lib/pluginApi';

interface PnlPoint {
  ts: number;
  total: number;
  realized: number;
  unrealized: number;
}

interface Props {
  sessionId: string;
}

type ChartType = 'area' | 'bar';

const GREEN = '#10b981';
const RED = '#ef4444';
const AXIS = '#94a3b8';
const GRID = '#f1f5f9';

function mergeHistory(existing: PnlPoint[], incoming: PnlPoint[]): PnlPoint[] {
  const byTs = new Map<number, PnlPoint>();
  for (const p of existing) byTs.set(p.ts, p);
  for (const p of incoming) byTs.set(p.ts, p);
  return Array.from(byTs.values()).sort((a, b) => a.ts - b.ts);
}

/** Downsample to a readable bar count — last sample wins per bucket. */
function bucketForBars(points: PnlPoint[], maxBars = 32): Array<PnlPoint & { label: string }> {
  if (points.length === 0) return [];
  const start = points[0].ts;
  const end = points[points.length - 1].ts;
  const span = Math.max(end - start, 1);
  const bucketMs = points.length <= maxBars ? Math.max(span / points.length, 1000) : Math.ceil(span / maxBars);

  const buckets = new Map<number, PnlPoint>();
  for (const p of points) {
    const key = Math.floor((p.ts - start) / bucketMs);
    buckets.set(key, p);
  }

  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, p]) => ({
      ...p,
      label: new Date(p.ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    }));
}

function formatInr(v: number) {
  const abs = Math.abs(v);
  if (abs >= 1000) return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  return `₹${v.toFixed(abs < 10 ? 2 : 1)}`;
}

function formatClock(ts: number) {
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function LivePnlPanel({ sessionId }: Props) {
  const gradId = useId().replace(/:/g, '');
  const [totalPnl, setTotalPnl] = useState(0);
  const [realizedPnl, setRealizedPnl] = useState(0);
  const [unrealizedPnl, setUnrealizedPnl] = useState(0);
  const [symbols, setSymbols] = useState<Record<string, { unrealized_pnl: number; realized_pnl: number }>>({});
  const [history, setHistory] = useState<PnlPoint[]>([]);
  const [stopped, setStopped] = useState(false);
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [chartType, setChartType] = useState<ChartType>('area');
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const lastSampledRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    lastSampledRef.current = 0;

    // Reload persisted history often enough that late-starting monitors still fill the chart.
    const loadHistory = () => {
      pluginApi.getLivePnlHistory(sessionId).then(res => {
        if (cancelled || !res.data?.snapshots?.length) return;
        const snapshots = res.data.snapshots.map(s => ({
          ts: new Date(s.sampled_at).getTime(),
          total: s.data.total_pnl,
          realized: s.data.realized_pnl,
          unrealized: s.data.live_unrealized_pnl,
        }));
        setHistory(prev => mergeHistory(prev, snapshots));
      }).catch(() => {});
    };

    loadHistory();
    const historyRefresh = setInterval(loadHistory, 30000);

    intervalRef.current = setInterval(async () => {
      try {
        const res = await pluginApi.getLivePnl(sessionId);
        if (cancelled) return;
        setConnected(true);
        if (res.data.ready && res.data.data) {
          setReady(true);
          setLastUpdated(new Date());
          setTotalPnl(res.data.data.total_pnl);
          setRealizedPnl(res.data.data.realized_pnl);
          setUnrealizedPnl(res.data.data.live_unrealized_pnl);
          setSymbols(res.data.data.symbols || {});

          const now = Date.now();
          // Sample at most every 2s so the series stays dense enough for lines without flooding bars.
          if (now - lastSampledRef.current >= 2000) {
            lastSampledRef.current = now;
            const point: PnlPoint = {
              ts: now,
              total: res.data.data.total_pnl,
              realized: res.data.data.realized_pnl,
              unrealized: res.data.data.live_unrealized_pnl,
            };
            setHistory(prev => mergeHistory(prev, [point]));
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

  const barData = useMemo(() => bucketForBars(history, 28), [history]);

  const isPositive = totalPnl >= 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;
  const trendColor = isPositive ? 'text-emerald-600' : 'text-red-600';
  const bgColor = isPositive ? 'bg-emerald-50' : 'bg-red-50';
  const placeholder = !ready;
  const stroke = isPositive ? GREEN : RED;
  const fillId = `pnlGrad-${gradId}`;

  const commonTooltip = {
    contentStyle: {
      borderRadius: 12,
      border: '1px solid #e2e8f0',
      fontSize: 12,
      boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
    },
    cursor: { fill: 'rgba(148, 163, 184, 0.12)' },
  };

  return (
    <div className="space-y-4">
      {stopped && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700">Session stopped</div>
      )}
      {!stopped && !connected && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700">
          Connection lost — retrying… {lastUpdated && `Last update ${lastUpdated.toLocaleTimeString('en-IN')}`}
        </div>
      )}
      {!stopped && connected && placeholder && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
          <Activity className="h-4 w-4 animate-pulse" aria-hidden="true" />
          Waiting for the first P&L update from the engine…
        </div>
      )}

      <div className="grid grid-cols-3 gap-3" aria-live="off">
        <div className={`rounded-xl border p-4 ${placeholder ? 'border-slate-200 bg-white' : bgColor}`}>
          <div className="flex items-center gap-2">
            <DollarSign className={`h-4 w-4 ${placeholder ? 'text-slate-400' : trendColor}`} aria-hidden="true" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total P&L</span>
          </div>
          <p className={`mt-1 text-lg font-bold ${placeholder ? 'text-slate-300' : trendColor}`}>{placeholder ? '—' : `₹${totalPnl.toFixed(2)}`}</p>
          {!placeholder && <TrendIcon className={`mt-0.5 h-4 w-4 ${trendColor}`} aria-hidden="true" />}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <Wallet className={`h-4 w-4 ${realizedPnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`} aria-hidden="true" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Realized</span>
          </div>
          <p className={`mt-1 text-lg font-bold ${placeholder ? 'text-slate-300' : realizedPnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {placeholder ? '—' : `₹${realizedPnl.toFixed(2)}`}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <Activity className={`h-4 w-4 ${unrealizedPnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`} aria-hidden="true" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Unrealized</span>
          </div>
          <p className={`mt-1 text-lg font-bold ${placeholder ? 'text-slate-300' : unrealizedPnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {placeholder ? '—' : `₹${unrealizedPnl.toFixed(2)}`}
          </p>
        </div>
      </div>

      {history.length > 1 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">P&L Chart</p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {chartType === 'bar'
                  ? `${barData.length} bars · from ${formatClock(history[0].ts)}`
                  : `${history.length} samples · from ${formatClock(history[0].ts)}`}
              </p>
            </div>
            <div role="group" aria-label="Chart type" className="flex gap-1 rounded-lg bg-slate-100 p-0.5">
              <button type="button" onClick={() => setChartType('area')}
                aria-pressed={chartType === 'area'}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
                  chartType === 'area' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}>
                <LineIcon className="h-3.5 w-3.5" aria-hidden="true" /> Line
              </button>
              <button type="button" onClick={() => setChartType('bar')}
                aria-pressed={chartType === 'bar'}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
                  chartType === 'bar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}>
                <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" /> Bar
              </button>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={260}>
            {chartType === 'area' ? (
              <AreaChart data={history} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={stroke} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="ts"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(ts: number) => new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  tick={{ fontSize: 11, fill: AXIS }}
                  axisLine={{ stroke: GRID }}
                  tickLine={false}
                  minTickGap={48}
                />
                <YAxis
                  tickFormatter={(v: number) => formatInr(v)}
                  tick={{ fontSize: 11, fill: AXIS }}
                  axisLine={false}
                  tickLine={false}
                  width={64}
                  domain={['auto', 'auto']}
                />
                <ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="4 4" />
                <Tooltip
                  {...commonTooltip}
                  labelFormatter={(ts) => (typeof ts === 'number' ? formatClock(ts) : '')}
                  formatter={(v) => [`₹${Number(v ?? 0).toFixed(2)}`, 'P&L']}
                />
                <Area type="monotone" dataKey="total" stroke={stroke} strokeWidth={2.25} fill={`url(#${fillId})`} isAnimationActive={false} />
              </AreaChart>
            ) : (
              <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }} barCategoryGap="18%">
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: AXIS }}
                  axisLine={{ stroke: GRID }}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  tickFormatter={(v: number) => formatInr(v)}
                  tick={{ fontSize: 11, fill: AXIS }}
                  axisLine={false}
                  tickLine={false}
                  width={64}
                  domain={['auto', 'auto']}
                />
                <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} />
                <Tooltip
                  {...commonTooltip}
                  labelFormatter={(_, payload) => {
                    const ts = payload?.[0]?.payload?.ts;
                    return typeof ts === 'number' ? formatClock(ts) : '';
                  }}
                  formatter={(v) => [`₹${Number(v ?? 0).toFixed(2)}`, 'P&L']}
                />
                <Bar dataKey="total" radius={[4, 4, 4, 4]} isAnimationActive={false} maxBarSize={40}>
                  {barData.map((point, i) => (
                    <Cell key={i} fill={point.total >= 0 ? GREEN : RED} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {Object.keys(symbols).length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Per-Symbol Breakdown</p>
          <div className="space-y-1">
            {Object.entries(symbols).map(([sym, data]) => (
              <div key={sym} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="font-semibold text-slate-900">{sym}</span>
                <span className={data.unrealized_pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                  ₹{data.unrealized_pnl.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
