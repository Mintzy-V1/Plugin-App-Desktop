import type { PerformanceStats } from '../../lib/performanceStats';

const money = (n: number) => {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const pct = (n: number) =>
  `${n.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

function tone(n: number | null | undefined) {
  if (n == null || n === 0) return 'text-slate-900';
  return n > 0 ? 'text-emerald-600' : 'text-red-600';
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
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-1.5 text-[15px] font-semibold tracking-tight ${valueClass || 'text-slate-900'}`}>{value}</p>
      {hint ? <p className="mt-0.5 truncate text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading performance">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-[88px] animate-pulse rounded-2xl bg-slate-100" />
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
          <h3 className="text-[13px] font-semibold text-slate-900">Performance</h3>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {loading
              ? 'Recalculating from session trades…'
              : s
                ? `Recalculated on open · through ${s.asOfDate}`
                : 'Computed from session trades on this computer'}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenMonths}
          className="text-[12px] font-semibold text-emerald-700 hover:text-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
        >
          Month over month
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
        <h3 className="text-[13px] font-semibold text-slate-900">Month over month</h3>
        <p className="mt-0.5 text-[11px] text-slate-400">
          Last 12 months from your first trade. Months with no trading show —.
        </p>
      </div>
      {loading && months.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {months.map((m) => (
            <div key={m.key} className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-sm">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{m.label}</p>
              <p className={`mt-1.5 text-[16px] font-semibold tracking-tight ${m.pnl == null ? 'text-slate-300' : tone(m.pnl)}`}>
                {m.pnl == null ? '—' : money(m.pnl)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
