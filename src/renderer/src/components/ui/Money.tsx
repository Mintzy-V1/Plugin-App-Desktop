const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Presentation only. Callers retain ownership of P&L calculations and rounding. */
export function Money({ value, large = false, signed = false, colored = true, className = '' }: {
  value: number | null | undefined; large?: boolean; signed?: boolean; colored?: boolean; className?: string;
}) {
  const valid = typeof value === 'number' && Number.isFinite(value);
  const tone = !colored || !valid || value === 0 ? 'text-ink' : value > 0 ? 'text-gain' : 'text-loss';
  return <span className={`tabular-nums ${large ? 'font-serif text-5xl tracking-tight' : ''} ${tone} ${className}`}>
    {valid ? `${signed && value > 0 ? '+' : ''}${formatter.format(value)}` : '—'}
  </span>;
}
