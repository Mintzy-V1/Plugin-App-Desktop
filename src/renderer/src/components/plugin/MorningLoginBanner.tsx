import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { brokerInfo } from '../../lib/brokers';
import type { BrokerOrUnsupported } from '../../lib/brokers';
import { formatCountdown, isBeforeSimulationStart, simulationStartMs } from '../../lib/istClock';

/** Weekday mornings in IST (no session starts at weekends). */
function isWeekdayIst(now: number): boolean {
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(new Date(now));
  return day !== 'Sat' && day !== 'Sun';
}

/**
 * "Log in before 10:30" for brokers whose daily login can't be done ahead of
 * time by Mintzy (5paisa: PIN and a fresh TOTP every morning). A session set
 * up before 10:30 IST waits and starts the morning simulation at 10:30.
 * Hidden after 10:30 and at weekends.
 */
export default function MorningLoginBanner({ broker }: { broker: BrokerOrUnsupported }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (broker === 'unsupported' || !brokerInfo(broker).morningLoginBanner) return null;
  if (!isWeekdayIst(now) || !isBeforeSimulationStart(now)) return null;

  const label = brokerInfo(broker).label;
  return (
    <div role="status" className="mx-auto mb-5 flex w-full max-w-xl items-start gap-3 rounded-xl border border-attention/25 bg-attention-soft px-4 py-3 text-sm text-attention">
      <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="leading-relaxed">
        <strong>Log in to {label} before 10:30 IST</strong> to be included today. A session set up by then
        waits and starts the morning simulation at 10:30 ({formatCountdown(simulationStartMs(now) - now)} from now).
      </p>
    </div>
  );
}
