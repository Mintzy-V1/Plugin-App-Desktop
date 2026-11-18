import { useEffect, useState } from 'react';

type Phase = 'open' | 'pre' | 'closed';

/** Regular NSE equity hours in IST. Exchange holidays are not known here. */
function marketPhase(now: Date): Phase {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  if (get('weekday') === 'Sat' || get('weekday') === 'Sun') return 'closed';
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));
  if (minutes >= 9 * 60 + 15 && minutes < 15 * 60 + 30) return 'open';
  if (minutes >= 9 * 60 && minutes < 9 * 60 + 15) return 'pre';
  return 'closed';
}

const LABEL: Record<Phase, string> = { open: 'Market open', pre: 'Pre-open', closed: 'Market closed' };
const DOT: Record<Phase, string> = { open: 'bg-gain', pre: 'bg-attention', closed: 'bg-muted/50' };

export default function MarketClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  const phase = marketPhase(now);
  const time = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });

  return (
    <div
      className="hidden items-center gap-3 rounded-full border border-line bg-subtle py-1 pl-2.5 pr-3 text-xs sm:flex"
      title="Regular NSE hours, 9:15 AM – 3:30 PM IST on weekdays. Exchange holidays are not shown."
    >
      <span className="flex items-center gap-1.5 font-semibold text-secondary">
        <span className={`h-1.5 w-1.5 rounded-full ${DOT[phase]}`} aria-hidden="true" />
        {LABEL[phase]}
      </span>
      <span className="h-3 w-px bg-line" aria-hidden="true" />
      <span className="tabular-nums text-muted">{time} IST</span>
    </div>
  );
}
