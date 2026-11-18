import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PerformanceStats } from '../../lib/pluginApi';
import { ChartEmpty, Panel, Segmented, TooltipCard } from './Panel';
import { axisProps, useThemeColors } from './useThemeColors';
import { dayLabel, inr, inrCompact, longDayLabel, pct, plural, toneClass } from './format';

/** Bars grow from the zero line; 4px rounding on the data end only. */
const barRadius = (v: number): [number, number, number, number] => (v >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4]);

type DayWindow = '20' | '60' | '120';

export function DailyPnlChart({ stats, loading }: { stats: PerformanceStats | null; loading: boolean }) {
  const c = useThemeColors();
  const [win, setWin] = useState<DayWindow>('20');
  const rows = useMemo(() => (stats?.daily ?? []).slice(-Number(win)), [stats?.daily, win]);
  const net = rows.reduce((a, d) => a + d.pnl, 0);
  const green = rows.filter((d) => d.pnl > 0).length;

  return (
    <Panel
      title="Daily P&L"
      caption={rows.length ? <>{plural(green, 'green day')} of {rows.length} · net <span className={`font-semibold ${toneClass(net)}`}>{inr(net, { decimals: 0 })}</span></> : 'Each bar is one trading day'}
      actions={<Segmented label="Days shown" value={win} onChange={setWin} options={[{ id: '20', label: '20D' }, { id: '60', label: '60D' }, { id: '120', label: '120D' }]} />}
    >
      {rows.length === 0 ? <ChartEmpty height={240} message={loading ? 'Loading daily results…' : 'Daily results appear after your first live trading day.'} /> : (
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barCategoryGap={rows.length > 60 ? 1 : '18%'}>
              <CartesianGrid vertical={false} stroke={c.line} strokeOpacity={0.7} />
              <XAxis dataKey="date" {...axisProps(c)} tickFormatter={(v) => dayLabel(v)} minTickGap={36} height={22} />
              <YAxis {...axisProps(c)} width={52} tickFormatter={(v) => inrCompact(v)} />
              <ReferenceLine y={0} stroke={c.muted} strokeOpacity={0.6} />
              <Tooltip
                cursor={{ fill: c.subtle }}
                content={({ active, payload }) => {
                  const d = active && payload?.[0]?.payload;
                  if (!d) return null;
                  return <TooltipCard title={longDayLabel(d.date)} rows={[
                    { label: 'P&L', value: inr(d.pnl), tone: toneClass(d.pnl), swatch: d.pnl < 0 ? c.loss : c.gain },
                    ...(d.returnPct != null ? [{ label: 'Return', value: pct(d.returnPct, { signed: true, decimals: 2 }), tone: toneClass(d.returnPct) }] : []),
                    { label: 'Symbols', value: d.symbols },
                  ]} />;
                }}
              />
              <Bar dataKey="pnl" isAnimationActive={false} maxBarSize={18}>
                {rows.map((d) => <Cell key={d.date} fill={d.pnl < 0 ? c.loss : c.gain} radius={barRadius(d.pnl) as unknown as number} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

export function MonthlyBars({ stats, loading, onOpenMonths }: { stats: PerformanceStats | null; loading: boolean; onOpenMonths?: () => void }) {
  const c = useThemeColors();
  const months = stats?.months ?? [];
  const traded = months.filter((m) => m.pnl != null);
  const positive = traded.filter((m) => (m.pnl ?? 0) > 0).length;
  const avg = traded.length ? traded.reduce((a, m) => a + (m.pnl ?? 0), 0) / traded.length : null;

  return (
    <Panel
      title="Monthly returns"
      caption={traded.length ? <>{positive} of {traded.length} months positive · average <span className={`font-semibold ${toneClass(avg)}`}>{inrCompact(avg, { signed: true })}</span></> : 'Last 12 months'}
      actions={onOpenMonths && <button type="button" onClick={onOpenMonths} className="rounded-md px-2 py-1 text-xs font-semibold text-gain hover:bg-gain-soft">Compare months</button>}
    >
      {traded.length === 0 ? <ChartEmpty height={240} message={loading ? 'Loading monthly returns…' : 'Monthly returns appear after your first trading month.'} /> : (
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={months.map((m) => ({ ...m, value: m.pnl ?? 0 }))} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barCategoryGap="22%">
              <CartesianGrid vertical={false} stroke={c.line} strokeOpacity={0.7} />
              <XAxis dataKey="label" {...axisProps(c)} tickFormatter={(v: string) => v.split(' ')[0].slice(0, 3)} interval={0} height={22} />
              <YAxis {...axisProps(c)} width={52} tickFormatter={(v) => inrCompact(v)} />
              <ReferenceLine y={0} stroke={c.muted} strokeOpacity={0.6} />
              <Tooltip
                cursor={{ fill: c.subtle }}
                content={({ active, payload }) => {
                  const m = active && payload?.[0]?.payload;
                  if (!m) return null;
                  if (m.pnl == null) return <TooltipCard title={m.label} rows={[{ label: 'P&L', value: 'No trading' }]} />;
                  return <TooltipCard title={m.label} rows={[
                    { label: 'P&L', value: inr(m.pnl), tone: toneClass(m.pnl), swatch: m.pnl < 0 ? c.loss : c.gain },
                    ...(m.returnPct != null ? [{ label: 'Return', value: pct(m.returnPct, { signed: true, decimals: 2 }), tone: toneClass(m.returnPct) }] : []),
                    ...(m.tradingDays ? [{ label: 'Green days', value: `${m.winDays ?? 0} / ${m.tradingDays}` }] : []),
                  ]} />;
                }}
              />
              <Bar dataKey="value" isAnimationActive={false} maxBarSize={36}>
                {months.map((m) => <Cell key={m.key} fill={(m.pnl ?? 0) < 0 ? c.loss : c.gain} radius={barRadius(m.pnl ?? 0) as unknown as number} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}
