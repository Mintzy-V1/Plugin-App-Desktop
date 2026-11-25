import type { SignalDayResults, SignalDelivery } from '../../lib/adminApi';
import { Card } from '../../components/ui/Card';
import { StatusPill } from '../../components/ui/StatusPill';
import { formatDateTime, formatMoney, pnlClass } from './adminFormat';

/** Outbox statuses that mean a destination may not have the position the engine had. */
const PROBLEM_STATUSES = new Set(['dead', 'unknown', 'expired', 'skipped', 'pending', 'inflight']);
const STATUS_ORDER = ['sent', 'pending', 'inflight', 'superseded', 'skipped', 'expired', 'dead', 'unknown'];
const STATUS_HELP: Record<string, string> = {
  sent: 'Delivered',
  pending: 'Still waiting when the day closed: never delivered',
  inflight: 'Still being sent when the day closed: check the destination by hand',
  superseded: 'Replaced by a newer signal before sending (normal)',
  skipped: 'Not sent: an earlier leg of the same signal failed',
  expired: 'Not sent: too old to act on',
  dead: 'Rejected by the destination',
  unknown: 'Sent, but no clear answer: check the destination by hand',
};
const help = (status: string) => (Object.prototype.hasOwnProperty.call(STATUS_HELP, status) ? STATUS_HELP[status] : status);

function Stat({ label, value, note }: { label: string; value: number | null; note: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className={`mt-2 font-serif text-2xl tabular-nums ${pnlClass(value)}`}>{formatMoney(value)}</p>
      <p className="mt-1 text-xs text-secondary">{note}</p>
    </div>
  );
}

function Delivery({ d, showErrors }: { d: SignalDelivery; showErrors: boolean }) {
  const statuses = Object.keys(d.counts).sort((a, b) => STATUS_ORDER.indexOf(a) - STATUS_ORDER.indexOf(b));
  return (
    <div className="rounded-lg border border-line px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold capitalize text-ink">{d.dest}</span>
        {d.dry_run === true && <StatusPill tone="neutral">Dry run · nothing really sent</StatusPill>}
        {d.dry_run === false && <StatusPill tone="ok">Live</StatusPill>}
        <span className="ml-auto flex flex-wrap gap-1.5">
          {statuses.length === 0 && <span className="text-xs text-muted">No signals sent this day</span>}
          {statuses.map((status) => (
            <span key={status} title={help(status)}
              className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ${PROBLEM_STATUSES.has(status) ? 'bg-attention-soft text-attention ring-attention/25' : 'bg-subtle text-secondary ring-line'}`}>
              {d.counts[status]} {status}
            </span>
          ))}
        </span>
      </div>
      {d.issues.length > 0 && (
        <table className="mt-3 w-full text-left text-xs tabular-nums">
          <caption className="sr-only">Signals {d.dest} may not have acted on</caption>
          <thead className="text-[10px] uppercase tracking-wider text-muted">
            <tr><th className="py-1 pr-3 font-semibold">Symbol</th><th className="py-1 pr-3 font-semibold">Signal</th><th className="py-1 pr-3 font-semibold">Outcome</th><th className="py-1 pr-3 font-semibold">HTTP</th>{showErrors && <th className="py-1 font-semibold">Response</th>}</tr>
          </thead>
          <tbody className="divide-y divide-line text-secondary">
            {d.issues.map((i, n) => (
              <tr key={`${i.seq ?? n}:${i.symbol}:${n}`}>
                <td className="py-1.5 pr-3 font-medium text-ink">{i.symbol ?? '—'}</td>
                <td className="py-1.5 pr-3">{i.action ?? '—'}</td>
                <td className="py-1.5 pr-3 text-attention" title={i.status ? help(i.status) : undefined}>{i.status ?? '—'}</td>
                <td className="py-1.5 pr-3">{i.http_status ?? '—'}</td>
                {showErrors && <td className="max-w-md truncate py-1.5" title={i.error ?? undefined}>{i.error ?? '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** The day's result at close: P&L (paper, before costs) and what each destination got. */
export function SignalDayResultsCard({ results, isToday, full }: { results: SignalDayResults | null; isToday: boolean; full: boolean }) {
  if (!results) {
    return (
      <Card className="px-6 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Result at close</p>
        <p className="mt-1 text-[13px] text-secondary">
          {isToday
            ? 'The day’s P&L and delivery report appear here after the square-off.'
            : 'No end-of-day summary for this day: it was recorded before summaries existed (backfill it), or the service stopped early.'}
        </p>
      </Card>
    );
  }
  const split = results.afternoon_pnl != null;
  return (
    <Card className="px-6 py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Result at close</p>
        <p className="text-xs text-muted">
          {results.basis ?? 'paper, before costs'}
          {results.signals != null && ` · ${results.signals} signals`}
          {results.recorded_at && ` · recorded ${formatDateTime(results.recorded_at)}`}
          {results.source === 'backfill' && ' · backfilled'}
        </p>
      </div>
      <div className={`mt-4 grid gap-6 ${split ? 'sm:grid-cols-3' : 'sm:grid-cols-1'}`}>
        {split && <Stat label="Afternoon P&L" value={results.afternoon_pnl} note="The pyramided names, from 13:00: what was published" />}
        {split && <Stat label="Morning P&L" value={results.morning_pnl} note="Paper run before 13:00, never published" />}
        <Stat label="Full day" value={results.full_day_pnl} note={split ? 'Morning + afternoon' : 'Rank-threshold day: no afternoon split'} />
      </div>
      {results.delivery.length > 0 && (
        <div className="mt-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Delivery</p>
          <div className="mt-2 grid gap-2">
            {results.delivery.map((d) => <Delivery key={d.dest} d={d} showErrors={full} />)}
          </div>
          <p className="mt-2 text-[11px] text-muted">Paper numbers: what a destination actually filled can differ (a rejected order, an add that never went through, slippage).</p>
        </div>
      )}
    </Card>
  );
}
