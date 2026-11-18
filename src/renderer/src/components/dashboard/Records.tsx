import { Flame, Snowflake, Trophy, TrendingDown } from 'lucide-react';
import type { NamedAmount, PerformanceStats } from '../../lib/pluginApi';
import { Panel } from './Panel';
import { inr, plural, toneClass } from './format';

function Pair({ label, best, worst }: { label: string; best?: NamedAmount | null; worst?: NamedAmount | null }) {
  const cell = (item: NamedAmount | null | undefined, kind: 'best' | 'worst') => (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-[11px] text-muted">
        {kind === 'best' ? <Trophy className="h-3 w-3" aria-hidden="true" /> : <TrendingDown className="h-3 w-3" aria-hidden="true" />}
        {kind === 'best' ? 'Best' : 'Worst'}
      </p>
      <p className={`mt-1 truncate text-sm font-semibold tabular-nums ${item ? toneClass(item.value) : 'text-muted'}`}>{item ? inr(item.value, { decimals: 0 }) : '—'}</p>
      <p className="truncate text-[11px] text-secondary">{item?.label ?? (kind === 'best' ? 'No gain yet' : 'No loss yet')}</p>
    </div>
  );
  return (
    <div className="min-w-0 rounded-xl bg-subtle px-4 py-3.5">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <div className="grid grid-cols-2 gap-4">{cell(best, 'best')}{cell(worst, 'worst')}</div>
    </div>
  );
}

export function Records({ stats }: { stats: PerformanceStats | null }) {
  const s = stats;
  const streak = s?.currentStreak;
  return (
    <Panel title="Records" caption={s ? `Through ${new Date(`${s.asOfDate}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : undefined}>
      <div className="grid gap-3 @min-[760px]:grid-cols-2 @min-[1100px]:grid-cols-4">
      <Pair label="Day" best={s?.maxProfitDay} worst={s?.maxLosingDay} />
      <Pair label="Symbol" best={s?.maxProfitScript} worst={s?.maxLosingScript} />
      <Pair label="Month" best={s?.bestMonth} worst={s?.worstMonth} />
      <div className="min-w-0 rounded-xl bg-subtle px-4 py-3.5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Streaks</p>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div><p className="text-[11px] text-muted">Longest green</p><p className="mt-1 text-sm font-semibold text-ink">{s?.maxWinStreak ? plural(s.maxWinStreak, 'day') : '—'}</p></div>
          <div><p className="text-[11px] text-muted">Longest red</p><p className="mt-1 text-sm font-semibold text-ink">{s?.maxLoseStreak ? plural(s.maxLoseStreak, 'day') : '—'}</p></div>
          <div>
            <p className="text-[11px] text-muted">Current</p>
            <p className={`mt-1 flex items-center gap-1 text-sm font-semibold ${streak ? (streak.type === 'win' ? 'text-gain' : 'text-loss') : 'text-ink'}`}>
              {streak && (streak.type === 'win' ? <Flame className="h-3.5 w-3.5" aria-hidden="true" /> : <Snowflake className="h-3.5 w-3.5" aria-hidden="true" />)}
              {streak ? `${streak.length} ${streak.type === 'win' ? 'green' : 'red'}` : '—'}
            </p>
          </div>
        </div>
      </div>
      </div>
    </Panel>
  );
}
