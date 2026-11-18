import { StatTile as SharedStatTile } from '../ui/StatTile';
import type { PerformanceStats } from '../../lib/pluginApi';

const money = (n: number) => {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const pct = (n: number) =>
  `${n.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

function tone(n: number | null | undefined) {
  if (n == null || n === 0) return 'text-ink';
  return n > 0 ? 'text-gain' : 'text-loss';
}

function StatTile({
  label,
  value,
  hint,
  valueClass,
}: {
  label: string;
  value: string;
  hint?: string;
  valueClass?: string;
}) {
  return <SharedStatTile label={label} value={<span className={`text-2xl ${valueClass || 'text-ink'}`}>{value}</span>} delta={hint} />;
}

export default function PerformanceStatsGrid({
  stats,
  loading,
  onOpenMonths,
}: {
  stats: PerformanceStats | null;
  loading?: boolean;
  onOpenMonths: () => void;
}) {
  if (loading && !stats) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-busy="true" aria-label="Loading performance">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-[88px] animate-pulse rounded-xl bg-subtle" />
        ))}
      </div>
    );
  }

  const s = stats;
  const dash = '—';

  return (
    <div className="page-stack">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-[13px] font-semibold text-ink">Performance</h3>
          <p className="mt-0.5 text-[11px] text-muted">
            {loading
              ? 'Loading performance…'
              : s
                ? `Updated daily at 4:30 PM IST · through ${s.asOfDate}`
                : 'Performance will appear after your first trading day'}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenMonths}
          className="text-[12px] font-semibold text-gain hover:text-gain focus:outline-none focus-visible:ring-2 focus-visible:ring-gain/30"
        >
          Month over month
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile
          label="Max profit script"
          value={s?.maxProfitScript ? money(s.maxProfitScript.value) : dash}
          hint={s?.maxProfitScript?.label}
          valueClass={tone(s?.maxProfitScript?.value)}
        />
        <StatTile
          label="Max profit day"
          value={s?.maxProfitDay ? money(s.maxProfitDay.value) : dash}
          hint={s?.maxProfitDay?.label}
          valueClass={tone(s?.maxProfitDay?.value)}
        />
        <StatTile
          label="Max losing script"
          value={s?.maxLosingScript ? money(s.maxLosingScript.value) : dash}
          hint={s?.maxLosingScript?.label}
          valueClass={tone(s?.maxLosingScript?.value)}
        />
        <StatTile
          label="Max losing day"
          value={s?.maxLosingDay ? money(s.maxLosingDay.value) : dash}
          hint={s?.maxLosingDay?.label}
          valueClass={tone(s?.maxLosingDay?.value)}
        />
        <StatTile
          label="Avg win rate"
          value={s?.avgWinRate != null ? pct(s.avgWinRate) : dash}
          hint={s ? `${s.tradingDays} trading day${s.tradingDays === 1 ? '' : 's'}` : undefined}
        />
        <StatTile
          label="Max drawdown"
          value={s?.maxDrawdownPct != null ? pct(s.maxDrawdownPct) : dash}
        />
        <StatTile
          label="Average risk : reward"
          value={s?.avgRiskReward != null ? `1 : ${s.avgRiskReward.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : dash}
        />
        <StatTile
          label="Overall returns"
          value={s?.overallReturnPct != null ? pct(s.overallReturnPct) : dash}
          hint={s ? `Net ${money(s.totalPnl)}` : undefined}
          valueClass={tone(s?.overallReturnPct ?? s?.totalPnl)}
        />
        <StatTile
          label="Max winning streak"
          value={s && s.maxWinStreak > 0 ? `${s.maxWinStreak} day${s.maxWinStreak === 1 ? '' : 's'}` : dash}
        />
        <StatTile
          label="Max losing streak"
          value={s && s.maxLoseStreak > 0 ? `${s.maxLoseStreak} day${s.maxLoseStreak === 1 ? '' : 's'}` : dash}
        />
      </div>
    </div>
  );
}

export function MonthReturnsGrid({ stats, loading }: { stats: PerformanceStats | null; loading?: boolean }) {
  const months = stats?.months ?? [];
  return (
    <div className="page-stack">
      <div>
        <h3 className="text-[13px] font-semibold text-ink">Month over month</h3>
        <p className="mt-0.5 text-[11px] text-muted">
          Last 12 months from your first trade. Months with no trading show —.
        </p>
      </div>
      {loading && months.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-subtle" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {months.map((m) => (
            <div key={m.key} className="rounded-xl border border-line/80 bg-surface px-4 py-3.5 shadow-sm">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted">{m.label}</p>
              <p className={`mt-3 font-serif text-2xl tracking-tight tabular-nums ${m.pnl == null ? 'text-muted' : tone(m.pnl)}`}>
                {m.pnl == null ? '—' : money(m.pnl)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
