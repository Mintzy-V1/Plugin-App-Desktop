import { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { MonthReturn, PerformanceStats } from '../../lib/pluginApi';
import { MonthlyBars } from './PnlBars';
import { Panel } from './Panel';
import { inr, inrCompact, pct, toneClass } from './format';

function Delta({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted">—</span>;
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  return (
    <span className={`inline-flex items-center justify-end gap-0.5 font-medium ${toneClass(value)}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />{inrCompact(value, { signed: true })}
    </span>
  );
}

function Summary({ label, value, detail, tone }: { label: string; value: string; detail?: string; tone?: string }) {
  return (
    <div className="min-w-0 bg-surface px-5 py-4">
      <p className="text-[11px] font-medium text-muted">{label}</p>
      <p className={`mt-1.5 truncate text-xl font-semibold tracking-tight ${tone ?? 'text-ink'}`}>{value}</p>
      {detail && <p className="mt-0.5 truncate text-[11px] text-muted">{detail}</p>}
    </div>
  );
}

/** Month-over-month: summary, bar chart and a comparison table, newest month first. */
export function MonthComparison({ stats, loading }: { stats: PerformanceStats | null; loading: boolean }) {
  const months = stats?.months ?? [];
  const rows = useMemo(() => {
    const out: (MonthReturn & { delta: number | null })[] = [];
    let prev: number | null = null;
    for (const m of months) {
      out.push({ ...m, delta: m.pnl != null && prev != null ? m.pnl - prev : null });
      if (m.pnl != null) prev = m.pnl;
    }
    return out.reverse();
  }, [months]);
  const traded = months.filter((m) => m.pnl != null);
  const total = traded.reduce((a, m) => a + (m.pnl ?? 0), 0);
  const avg = traded.length ? total / traded.length : null;
  const positive = traded.filter((m) => (m.pnl ?? 0) > 0).length;
  const max = Math.max(1, ...traded.map((m) => Math.abs(m.pnl ?? 0)));

  if (loading && !stats) {
    return <div className="h-96 animate-pulse rounded-2xl border border-line bg-surface" aria-busy="true" aria-label="Loading monthly comparison" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Twelve-month summary" className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line @min-[900px]:grid-cols-4">
        <Summary label="12-month net" value={inr(total, { decimals: 0 })} tone={toneClass(total)} detail={`${traded.length} months traded`} />
        <Summary label="Average month" value={inr(avg, { decimals: 0 })} tone={toneClass(avg)} detail={traded.length ? `${positive} of ${traded.length} positive` : undefined} />
        <Summary label="Best month" value={inr(stats?.bestMonth?.value, { decimals: 0 })} tone={toneClass(stats?.bestMonth?.value)} detail={stats?.bestMonth?.label ?? 'No profitable month yet'} />
        <Summary label="Worst month" value={inr(stats?.worstMonth?.value, { decimals: 0 })} tone={toneClass(stats?.worstMonth?.value)} detail={stats?.worstMonth?.label ?? 'No losing month yet'} />
      </section>

      <MonthlyBars stats={stats} loading={loading} />

      <Panel title="Comparison" caption="Each month against the previous traded month" bodyClassName="overflow-x-auto pb-2">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-y border-line text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
              <th scope="col" className="px-5 py-2.5">Month</th>
              <th scope="col" className="px-3 py-2.5 text-right">P&amp;L</th>
              <th scope="col" className="w-[22%] px-3 py-2.5"><span className="sr-only">Relative size</span></th>
              <th scope="col" className="px-3 py-2.5 text-right">Return</th>
              <th scope="col" className="px-3 py-2.5 text-right">Green days</th>
              <th scope="col" className="px-5 py-2.5 text-right">vs prior</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const share = m.pnl != null ? (Math.abs(m.pnl) / max) * 100 : 0;
              return (
                <tr key={m.key} className="border-b border-line/70 last:border-b-0 hover:bg-subtle">
                  <th scope="row" className="px-5 py-3 text-left font-medium text-ink">{m.label}</th>
                  <td className={`px-3 py-3 text-right font-semibold tabular-nums ${m.pnl == null ? 'text-muted' : toneClass(m.pnl)}`}>{m.pnl == null ? 'No trading' : inr(m.pnl, { decimals: 0 })}</td>
                  <td className="px-3 py-3">
                    {m.pnl != null && <div className="h-1.5 rounded-full bg-subtle"><span className={`block h-full rounded-full ${m.pnl < 0 ? 'bg-loss' : 'bg-gain'}`} style={{ width: `${share}%` }} /></div>}
                  </td>
                  <td className={`px-3 py-3 text-right tabular-nums ${toneClass(m.returnPct)}`}>{pct(m.returnPct, { signed: true, decimals: 2 })}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-secondary">{m.tradingDays ? `${m.winDays ?? 0} / ${m.tradingDays}` : '—'}</td>
                  <td className="px-5 py-3 text-right tabular-nums"><Delta value={m.delta} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
