import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import type { PerformanceStats } from '../../lib/pluginApi';
import { dayLabel, inr, inrCompact, pct, plural, ratio, toneClass } from './format';

function Kpi({ label, help, value, tone, detail, visual }: {
  label: string;
  help: string;
  value: string;
  tone?: string;
  detail?: ReactNode;
  visual?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 px-5 py-4">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
        {label}
        <span title={help} aria-label={help} className="inline-flex cursor-help text-muted/70 hover:text-secondary">
          <Info className="h-3 w-3" aria-hidden="true" />
        </span>
      </p>
      <p className={`text-xl font-semibold tracking-tight ${tone ?? 'text-ink'}`}>{value}</p>
      {visual}
      {detail && <p className="truncate text-[11px] text-muted">{detail}</p>}
    </div>
  );
}

/** Two-part bar: share of a whole, gain on the left and loss on the right, 2px surface gap. */
function SplitBar({ left, right, label }: { left: number; right: number; label: string }) {
  const total = left + right;
  if (!total) return <div className="h-1.5 rounded-full bg-subtle" />;
  return (
    <div className="flex h-1.5 gap-0.5" role="img" aria-label={label}>
      <span className="rounded-full bg-gain" style={{ flexGrow: left }} />
      <span className="rounded-full bg-loss" style={{ flexGrow: right }} />
    </div>
  );
}

/** Position of a value on a 0..max track, for ratios where higher is better. */
function Gauge({ value, max, good }: { value: number | null | undefined; max: number; good: number }) {
  const fill = value == null ? 0 : Math.max(0, Math.min(1, value / max));
  return (
    <div className="relative h-1.5 rounded-full bg-subtle">
      <span className={`absolute inset-y-0 left-0 rounded-full ${value != null && value >= good ? 'bg-gain' : 'bg-attention'}`} style={{ width: `${fill * 100}%` }} />
      <span className="absolute -top-0.5 h-2.5 w-px bg-muted/60" style={{ left: `${(good / max) * 100}%` }} aria-hidden="true" />
    </div>
  );
}

export function KpiStrip({ stats, loading }: { stats: PerformanceStats | null; loading: boolean }) {
  if (loading && !stats) {
    return <div className="h-[118px] animate-pulse rounded-2xl border border-line bg-surface" aria-busy="true" aria-label="Loading key metrics" />;
  }
  const s = stats;
  const winDays = s?.winningDays ?? 0;
  const lossDays = s?.losingDays ?? 0;
  const ddPct = s?.maxDrawdownPct;

  return (
    <section aria-label="Key metrics" className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line @min-[640px]:grid-cols-3 @min-[1100px]:grid-cols-6 [&>*]:bg-surface">
      <Kpi
        label="Win rate"
        help="Share of trading days that closed in profit (flat days excluded)."
        value={pct(s?.avgWinRate)}
        visual={<SplitBar left={winDays} right={lossDays} label={`${winDays} winning and ${lossDays} losing days`} />}
        detail={`${winDays} won · ${lossDays} lost days`}
      />
      <Kpi
        label="Profit factor"
        help="Gross profit on winning days divided by gross loss on losing days. Above 1 means the account makes more than it gives back."
        value={s?.profitFactor != null ? ratio(s.profitFactor) : s?.grossProfit ? 'No losses' : '—'}
        tone={s?.profitFactor != null ? (s.profitFactor >= 1 ? 'text-gain' : 'text-loss') : undefined}
        visual={<Gauge value={s?.profitFactor} max={3} good={1} />}
        detail={s?.grossProfit != null ? `${inrCompact(s.grossProfit)} won · ${inrCompact(s.grossLoss)} lost` : undefined}
      />
      <Kpi
        label="Risk : reward"
        help="Average winning day divided by average losing day."
        value={s?.avgRiskReward != null ? `1 : ${ratio(s.avgRiskReward)}` : '—'}
        visual={<SplitBar left={Math.abs(s?.avgWinDay ?? 0)} right={Math.abs(s?.avgLossDay ?? 0)} label="Average win versus average loss" />}
        detail={s?.avgWinDay != null ? `${inrCompact(s.avgWinDay, { signed: true })} vs ${inrCompact(s.avgLossDay)}` : undefined}
      />
      <Kpi
        label="Max drawdown"
        help="Largest fall in cumulative P&L from a previous high, as a share of account value at that high."
        value={ddPct != null ? pct(-ddPct, { decimals: 1 }) : s?.maxDrawdownAmount != null ? inrCompact(-s.maxDrawdownAmount) : '—'}
        tone={(s?.maxDrawdownAmount ?? 0) > 0 ? 'text-loss' : undefined}
        visual={<div className="h-1.5 rounded-full bg-subtle"><span className="block h-full rounded-full bg-loss" style={{ width: `${Math.min(100, ((ddPct ?? 0) / 30) * 100)}%` }} /></div>}
        detail={s?.maxDrawdownAmount ? `${inr(-s.maxDrawdownAmount, { decimals: 0 })}${s.maxDrawdownDate ? ` · ${dayLabel(s.maxDrawdownDate)}` : ''}` : undefined}
      />
      <Kpi
        label="Sharpe ratio"
        help="Annualised average daily return divided by its volatility. Above 1 is good; needs five or more trading days."
        value={ratio(s?.sharpeRatio)}
        tone={s?.sharpeRatio != null ? (s.sharpeRatio >= 1 ? 'text-gain' : s.sharpeRatio < 0 ? 'text-loss' : 'text-ink') : undefined}
        visual={<Gauge value={s?.sharpeRatio} max={3} good={1} />}
        detail={s?.sortinoRatio != null ? `Sortino ${ratio(s.sortinoRatio)}` : 'Needs 5+ trading days'}
      />
      <Kpi
        label="Avg day"
        help="Expectancy: the mean P&L across every trading day."
        value={inr(s?.expectancy, { decimals: 0 })}
        tone={toneClass(s?.expectancy)}
        visual={<SplitBar left={s?.grossProfit ?? 0} right={s?.grossLoss ?? 0} label="Gross profit versus gross loss" />}
        detail={s ? `${plural(s.tradingDays, 'trading day')} · ${plural(s.symbolsTraded ?? 0, 'symbol')}` : undefined}
      />
    </section>
  );
}
