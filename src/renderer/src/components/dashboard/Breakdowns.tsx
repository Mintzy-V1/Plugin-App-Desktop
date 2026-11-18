import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PerformanceStats, SymbolPerformance } from '../../lib/pluginApi';
import { ChartEmpty, Panel, Segmented } from './Panel';
import { inr, inrCompact, pct, plural, toneClass } from './format';

/** Diverging bar from a centre line: gains extend right, losses left. */
function DivergingBar({ value, max }: { value: number; max: number }) {
  const share = max ? Math.min(1, Math.abs(value) / max) * 50 : 0;
  return (
    <div className="relative h-2 w-full rounded-full bg-subtle" aria-hidden="true">
      <span className="absolute inset-y-[-2px] left-1/2 w-px bg-line" />
      <span
        className={`absolute inset-y-0 rounded-full ${value < 0 ? 'bg-loss' : 'bg-gain'}`}
        style={value < 0 ? { right: '50%', width: `${share}%` } : { left: '50%', width: `${share}%` }}
      />
    </div>
  );
}

type SymbolView = 'top' | 'bottom' | 'all';

export function SymbolLeaderboard({ stats, loading }: { stats: PerformanceStats | null; loading: boolean }) {
  const [view, setView] = useState<SymbolView>('top');
  const symbols = stats?.symbols ?? [];
  const rows: SymbolPerformance[] = useMemo(() => {
    if (view === 'top') return symbols.filter((s) => s.pnl > 0).slice(0, 10);
    if (view === 'bottom') return symbols.filter((s) => s.pnl < 0).slice(-10).reverse();
    return symbols.slice(0, 12);
  }, [symbols, view]);
  const max = Math.max(0, ...symbols.map((s) => Math.abs(s.pnl)));

  return (
    <Panel
      title="Symbols"
      caption={stats?.symbolsTraded ? `${plural(stats.symbolsTraded, 'symbol')} traded · win rate by symbol-day ${pct(stats.symbolWinRate)}` : 'P&L by traded symbol'}
      actions={<Segmented label="Symbols shown" value={view} onChange={setView} options={[{ id: 'top', label: 'Winners' }, { id: 'bottom', label: 'Losers' }, { id: 'all', label: 'All' }]} />}
    >
      {symbols.length === 0 ? <ChartEmpty height={260} message={loading ? 'Loading symbols…' : 'Symbol results appear after your first trade.'} /> : rows.length === 0 ? (
        <ChartEmpty height={260} message={view === 'top' ? 'No symbol is in profit yet.' : 'No symbol is in loss — nice.'} />
      ) : (
        <table className="w-full text-xs">
          <thead className="bg-transparent">
            <tr className="text-[11px] text-muted">
              <th scope="col" className="pb-2 text-left font-medium">Symbol</th>
              <th scope="col" className="w-[38%] pb-2 font-medium"><span className="sr-only">Share of largest result</span></th>
              <th scope="col" className="pb-2 text-right font-medium">Win rate</th>
              <th scope="col" className="pb-2 text-right font-medium">P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.symbol} className="border-t border-line/70">
                <td className="py-2.5 pr-3">
                  <p className="font-semibold text-ink">{s.symbol}</p>
                  <p className="text-[11px] text-muted">{plural(s.days, 'day')}</p>
                </td>
                <td className="px-2"><DivergingBar value={s.pnl} max={max} /></td>
                <td className="py-2.5 text-right tabular-nums text-secondary">{pct(s.winRate, { decimals: 0 })}</td>
                <td className={`py-2.5 pl-3 text-right font-semibold tabular-nums ${toneClass(s.pnl)}`}>{inrCompact(s.pnl, { signed: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

export function WeekdayBreakdown({ stats }: { stats: PerformanceStats | null }) {
  const days = stats?.weekdays ?? [];
  const max = Math.max(0, ...days.map((d) => Math.abs(d.avgPnl ?? 0)));
  const best = days.reduce<typeof days[number] | null>((b, d) => (d.avgPnl != null && (!b || d.avgPnl > (b.avgPnl ?? -Infinity)) ? d : b), null);
  return (
    <Panel title="By weekday" caption={best?.avgPnl != null && best.avgPnl > 0 ? `${best.label} is your strongest day on average` : 'Average P&L per weekday'}>
      {days.every((d) => !d.days) ? <ChartEmpty height={200} message="Weekday patterns appear after a week of trading." /> : (
        <ul className="space-y-3.5">
          {days.map((d) => (
            <li key={d.label} className="grid grid-cols-[2.25rem_1fr_4.5rem] items-center gap-3 text-xs">
              <span className="font-semibold text-secondary">{d.label}</span>
              <div title={`${plural(d.days, 'day')} · win rate ${pct(d.winRate, { decimals: 0 })}`}><DivergingBar value={d.avgPnl ?? 0} max={max} /></div>
              <span className={`text-right font-semibold tabular-nums ${toneClass(d.avgPnl)}`}>{d.days ? inrCompact(d.avgPnl, { signed: true }) : '—'}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Month grid of daily P&L; colour depth scales with size, sign shown by hue and a ± in the tooltip. */
export function PnlCalendar({ stats }: { stats: PerformanceStats | null }) {
  const daily = stats?.daily ?? [];
  const byDate = useMemo(() => new Map(daily.map((d) => [d.date, d])), [daily]);
  const lastKey = daily[daily.length - 1]?.date ?? new Date().toISOString().slice(0, 10);
  const [offset, setOffset] = useState(0);
  const [y, m] = lastKey.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + offset, 1));
  const monthKey = first.toISOString().slice(0, 7);
  const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const cells = Array.from({ length: lead + daysInMonth }, (_, i) => (i < lead ? null : `${monthKey}-${String(i - lead + 1).padStart(2, '0')}`));
  const monthRows = cells.flatMap((k) => (k && byDate.get(k) ? [byDate.get(k)!] : []));
  const scale = Math.max(1, ...monthRows.map((d) => Math.abs(d.pnl)));
  const net = monthRows.reduce((a, d) => a + d.pnl, 0);
  const earliest = daily[0]?.date.slice(0, 7);

  return (
    <Panel
      title="P&L calendar"
      caption={monthRows.length ? <>{plural(monthRows.length, 'trading day')} · net <span className={`font-semibold ${toneClass(net)}`}>{inr(net, { decimals: 0 })}</span></> : 'No trading this month'}
      actions={
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Previous month" disabled={!earliest || monthKey <= earliest} onClick={() => setOffset((o) => o - 1)} className="rounded-md p-1 text-muted hover:bg-subtle hover:text-ink disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-20 text-center text-xs font-semibold text-ink">{first.toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' })}</span>
          <button type="button" aria-label="Next month" disabled={offset >= 0} onClick={() => setOffset((o) => o + 1)} className="rounded-md p-1 text-muted hover:bg-subtle hover:text-ink disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
        </div>
      }
    >
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {WEEK.map((w) => <span key={w} className="pb-1 text-[10px] font-medium uppercase tracking-wide text-muted">{w}</span>)}
        {cells.map((key, i) => {
          if (!key) return <span key={`pad-${i}`} />;
          const d = byDate.get(key);
          const depth = d ? 0.18 + 0.62 * Math.min(1, Math.abs(d.pnl) / scale) : 0;
          const label = d ? `${key}: ${inr(d.pnl)}` : `${key}: no trading`;
          return (
            <div
              key={key}
              title={label}
              aria-label={label}
              className={`relative flex aspect-[1.35] flex-col items-start justify-between rounded-md border p-1.5 text-left ${d ? 'border-transparent' : 'border-line/60'}`}
            >
              {d && <span className={`absolute inset-0 rounded-md ${d.pnl < 0 ? 'bg-loss' : 'bg-gain'}`} style={{ opacity: depth }} aria-hidden="true" />}
              <span className={`relative text-[10px] font-medium ${d ? 'text-ink' : 'text-muted/70'}`}>{Number(key.slice(8))}</span>
              {d && <span className="relative hidden text-[10px] font-semibold tabular-nums text-ink @min-[1100px]:block">{inrCompact(d.pnl, { signed: true })}</span>}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
