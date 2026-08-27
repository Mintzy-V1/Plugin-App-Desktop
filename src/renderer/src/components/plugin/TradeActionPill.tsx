import { actionPillClass, formatTradeLabel } from '../../lib/tradeSignals';

export default function TradeActionPill({ value }: { value: string | number | null | undefined }) {
  const { label, tone } = formatTradeLabel(value);
  if (label === '—') {
    return <span className="text-slate-400">—</span>;
  }
  return (
    <span className={actionPillClass(tone)} title={String(value ?? label)}>
      {label}
    </span>
  );
}
