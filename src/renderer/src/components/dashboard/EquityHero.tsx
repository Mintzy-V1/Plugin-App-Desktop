import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { DailyPerformance, PerformanceStats } from '../../lib/pluginApi';
import { ChartEmpty, Segmented, TooltipCard } from './Panel';
import { axisProps, useThemeColors } from './useThemeColors';
import { dayLabel, inr, inrCompact, longDayLabel, pct, toneClass } from './format';

type Range = '1M' | '3M' | '6M' | '1Y' | 'ALL';
const RANGES: { id: Range; label: string }[] = [
  { id: '1M', label: '1M' }, { id: '3M', label: '3M' }, { id: '6M', label: '6M' }, { id: '1Y', label: '1Y' }, { id: 'ALL', label: 'All' },
];
const RANGE_MONTHS: Record<Range, number> = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12, ALL: 0 };

/** Days inside the range, with cumulative P&L re-based to zero at its start. */
function sliceRange(daily: DailyPerformance[], range: Range) {
  if (!daily.length) return [];
  let rows = daily;
  if (range !== 'ALL') {
    const last = new Date(`${daily[daily.length - 1].date}T00:00:00Z`);
    last.setUTCMonth(last.getUTCMonth() - RANGE_MONTHS[range]);
    const from = last.toISOString().slice(0, 10);
    rows = daily.filter((d) => d.date > from);
  }
  const first = rows[0];
  const base = first ? first.cumulative - first.pnl : 0;
  let peak = 0;
  return rows.map((d) => {
    const value = d.cumulative - base;
    peak = Math.max(peak, value);
    return { ...d, value, underwater: value - peak };
  });
}

function Figure({ label, value, detail, tone, loading }: { label: string; value: string; detail?: React.ReactNode; tone?: string; loading?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-muted">{label}</p>
      {loading ? <div className="mt-1.5 h-6 w-28 animate-pulse rounded bg-subtle" /> : (
        <p className={`mt-1 truncate text-lg font-semibold tracking-tight ${tone ?? 'text-ink'}`}>{value}</p>
      )}
      {detail && !loading && <p className="mt-0.5 truncate text-[11px] text-muted">{detail}</p>}
    </div>
  );
}

export function EquityHero({ stats, loading, monthlyPnl, cash, equity, figuresLoading }: {
  stats: PerformanceStats | null;
  loading: boolean;
  monthlyPnl: number | null;
  cash: number | null;
  equity: number | null;
  figuresLoading: boolean;
}) {
  const c = useThemeColors();
  const [range, setRange] = useState<Range>('3M');
  const series = useMemo(() => sliceRange(stats?.daily ?? [], range), [stats?.daily, range]);
  const periodNet = series.length ? series[series.length - 1].value : 0;
  const lineColor = periodNet < 0 ? c.loss : c.gain;

  const months = stats?.months ?? [];
  const thisMonth = monthlyPnl ?? months[months.length - 1]?.pnl ?? null;
  const lastMonth = months[months.length - 2];
  const monthDelta = thisMonth != null && lastMonth?.pnl != null ? thisMonth - lastMonth.pnl : null;
  const total = stats?.totalPnl ?? null;
  const Arrow = (total ?? 0) < 0 ? ArrowDownRight : ArrowUpRight;

  return (
    <section aria-label="Account performance" className="grid overflow-hidden rounded-2xl border border-line bg-surface @min-[960px]:grid-cols-[300px_1fr]">
      <div className="flex flex-col gap-6 border-b border-line p-6 @min-[960px]:border-b-0 @min-[960px]:border-r">
        <div>
          <p className="text-xs font-medium text-muted">Net P&amp;L · all time</p>
          {loading && !stats ? <div className="mt-3 h-10 w-48 animate-pulse rounded bg-subtle" /> : (
            <p className={`mt-2 text-[2.5rem] font-semibold leading-none tracking-tight ${toneClass(total)}`}>{inr(total, { decimals: 0 })}</p>
          )}
          {stats?.overallReturnPct != null && (
            <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-secondary">
              <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-semibold ${(total ?? 0) < 0 ? 'bg-loss-soft text-loss' : 'bg-gain-soft text-gain'}`}>
                <Arrow className="h-3 w-3" aria-hidden="true" />{pct(stats.overallReturnPct, { signed: true, decimals: 2 })}
              </span>
              on {inr(stats.startCapital, { signed: false, decimals: 0 })} starting capital
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 @min-[960px]:grid-cols-1">
          <Figure
            label="This month"
            value={inr(thisMonth)}
            tone={toneClass(thisMonth)}
            loading={figuresLoading && thisMonth == null}
            detail={monthDelta != null ? <><span className={toneClass(monthDelta)}>{inrCompact(monthDelta, { signed: true })}</span> vs {lastMonth?.label}</> : new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          />
          <Figure label="Equity" value={inr(equity, { signed: false })} loading={figuresLoading} />
          <Figure label="Cash in broker" value={inr(cash, { signed: false })} loading={figuresLoading} />
        </div>
      </div>

      <div className="flex min-w-0 flex-col p-5 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">Equity curve</h3>
            <p className="mt-0.5 text-xs text-muted">
              Cumulative P&amp;L · <span className={`font-semibold ${toneClass(periodNet)}`}>{inr(periodNet, { decimals: 0 })}</span> over {range === 'ALL' ? 'all time' : `the last ${RANGES.find((r) => r.id === range)?.label}`}
            </p>
          </div>
          <Segmented label="Chart range" value={range} options={RANGES} onChange={setRange} />
        </div>
        {series.length < 2 ? (
          <div className="mt-4"><ChartEmpty height={276} message={loading ? 'Loading your equity curve…' : 'Your equity curve appears after two live trading days.'} /></div>
        ) : (
          <>
            <div className="mt-4 h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 6, right: 4, left: 4, bottom: 0 }} syncId="equity">
                  <defs>
                    <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={lineColor} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={c.line} strokeOpacity={0.7} />
                  <XAxis dataKey="date" hide />
                  <YAxis {...axisProps(c)} width={56} tickFormatter={(v) => inrCompact(v)} />
                  <ReferenceLine y={0} stroke={c.muted} strokeOpacity={0.5} />
                  <Tooltip
                    cursor={{ stroke: c.muted, strokeWidth: 1 }}
                    content={({ active, payload }) => {
                      const d = active && payload?.[0]?.payload;
                      if (!d) return null;
                      return <TooltipCard title={longDayLabel(d.date)} rows={[
                        { label: 'Day P&L', value: inr(d.pnl), tone: toneClass(d.pnl) },
                        { label: 'Cumulative', value: inr(d.value), tone: toneClass(d.value), swatch: lineColor },
                        { label: 'From peak', value: inr(d.underwater), tone: d.underwater < 0 ? 'text-loss' : undefined },
                      ]} />;
                    }}
                  />
                  <Area type="monotone" dataKey="value" stroke={lineColor} strokeWidth={2} fill="url(#equityFill)" activeDot={{ r: 4, strokeWidth: 2, stroke: c.surface }} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-[11px] font-medium text-muted">
              Drawdown from peak · deepest <span className="font-semibold text-loss">{inr(Math.min(...series.map((d) => d.underwater)), { decimals: 0 })}</span>
            </p>
            <div className="h-[64px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 2, right: 4, left: 60, bottom: 0 }} syncId="equity">
                  <XAxis dataKey="date" {...axisProps(c)} tickFormatter={(v) => dayLabel(v)} minTickGap={48} height={20} />
                  <YAxis hide domain={['dataMin', 0]} />
                  <Tooltip content={() => null} cursor={{ stroke: c.muted, strokeWidth: 1 }} />
                  <Area type="monotone" dataKey="underwater" stroke={c.loss} strokeWidth={1.5} fill={c.loss} fillOpacity={0.14} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
