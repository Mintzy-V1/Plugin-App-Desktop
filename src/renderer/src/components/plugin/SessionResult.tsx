/** Receives already formatted results; owns no trading calculations. */
export function SessionResult({ total, booked, open, positive, bookedPositive, openPositive, scope, unavailable }: {
  total: string; booked: string; open: string; positive: boolean; bookedPositive: boolean; openPositive: boolean; scope?: string; unavailable?: boolean;
}) {
  return <section aria-label="Session result" className="grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-surface @min-[700px]:grid-cols-[1.6fr_1fr_1fr]">
    <div className="col-span-2 px-6 py-6 @min-[700px]:col-span-1"><p className="text-xs font-medium uppercase tracking-[0.15em] text-muted">Session result{scope ? ` · ${scope}` : ''}</p>
      <p className={`mt-3 font-serif text-5xl tracking-tight tabular-nums ${unavailable ? 'text-muted' : positive ? 'text-gain' : 'text-loss'}`}>{total}</p>
      <p className="mt-3 text-xs text-secondary">{unavailable ? 'Waiting for the first result' : 'Reported P&L for the selected scope'}</p>
    </div>
    <div className="border-t border-line px-6 py-6 @min-[700px]:border-l @min-[700px]:border-t-0"><p className="text-xs uppercase tracking-wider text-muted">Booked</p><p className={`mt-3 font-serif text-3xl tabular-nums ${unavailable ? 'text-muted' : bookedPositive ? 'text-gain' : 'text-loss'}`}>{booked}</p><p className="mt-3 text-xs text-secondary">Closed trades</p></div>
    <div className="border-t border-line px-6 py-6 @min-[700px]:border-l @min-[700px]:border-t-0"><p className="text-xs uppercase tracking-wider text-muted">Open P&L</p><p className={`mt-3 font-serif text-3xl tabular-nums ${unavailable ? 'text-muted' : openPositive ? 'text-gain' : 'text-loss'}`}>{open}</p><p className="mt-3 text-xs text-secondary">Still in the market</p></div>
  </section>;
}
