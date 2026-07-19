import { useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Wallet, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
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

export default function LivePnlPanel({ sessionId }: Props) {
  const [totalPnl, setTotalPnl] = useState(0);
  const [realizedPnl, setRealizedPnl] = useState(0);
  const [unrealizedPnl, setUnrealizedPnl] = useState(0);
  const [symbols, setSymbols] = useState<Record<string, { unrealized_pnl: number; realized_pnl: number }>>({});
  const [history, setHistory] = useState<PnlPoint[]>([]);
  const [stopped, setStopped] = useState(false);
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    pluginApi.getLivePnlHistory(sessionId).then(res => {
      if (res.data?.snapshots) {
        setHistory(res.data.snapshots.map(s => ({
          ts: new Date(s.sampled_at).getTime(),
          total: s.data.total_pnl,
          realized: s.data.realized_pnl,
          unrealized: s.data.live_unrealized_pnl,
        })));
      }
    }).catch(() => {});

    intervalRef.current = setInterval(async () => {
      try {
        const res = await pluginApi.getLivePnl(sessionId);
        setConnected(true);
        if (res.data.ready && res.data.data) {
          setReady(true);
          setLastUpdated(new Date());
          setTotalPnl(res.data.data.total_pnl);
          setRealizedPnl(res.data.data.realized_pnl);
          setUnrealizedPnl(res.data.data.live_unrealized_pnl);
          setSymbols(res.data.data.symbols || {});
          setHistory(prev => {
            const point = { ts: Date.now(), total: res.data.data!.total_pnl, realized: res.data.data!.realized_pnl, unrealized: res.data.data!.live_unrealized_pnl };
            const next = [...prev, point];
            return next.length > 300 ? next.slice(-300) : next;
          });
        }
        if (res.data.stopped) setStopped(true);
      } catch {
        setConnected(false);
      }
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [sessionId]);

  const isPositive = totalPnl >= 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;
  const trendColor = isPositive ? 'text-emerald-600' : 'text-red-600';
  const bgColor = isPositive ? 'bg-emerald-50' : 'bg-red-50';
  const placeholder = !ready;

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
            <Wallet className="h-4 w-4 text-blue-500" aria-hidden="true" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Realized</span>
          </div>
          <p className={`mt-1 text-lg font-bold ${placeholder ? 'text-slate-300' : 'text-slate-900'}`}>{placeholder ? '—' : `₹${realizedPnl.toFixed(2)}`}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-violet-500" aria-hidden="true" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Unrealized</span>
          </div>
          <p className={`mt-1 text-lg font-bold ${placeholder ? 'text-slate-300' : 'text-slate-900'}`}>{placeholder ? '—' : `₹${unrealizedPnl.toFixed(2)}`}</p>
        </div>
      </div>

      {history.length > 1 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">P&L Chart</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={history}>
              <defs>
                <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="ts" hide />
              <YAxis hide domain={['dataMin', 'dataMax']} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                labelFormatter={(ts) => typeof ts === 'number' ? new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
                formatter={(v) => [`₹${Number(v ?? 0).toFixed(2)}`, 'P&L']} />
              <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} fill="url(#pnlGrad)" />
            </AreaChart>
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
