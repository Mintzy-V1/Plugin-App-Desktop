import { Pagination } from '../../components/ui/Pagination';
import type { AdminBroker, SessionPhase } from '../../lib/adminApi';

export function formatMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const sign = n < 0 ? '-' : '';
  return `${sign}₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function pnlClass(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n === 0) return 'text-secondary';
  return n > 0 ? 'text-gain' : 'text-loss';
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatAge(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

const BROKER_LABELS: Record<string, string> = {
  angle_one: 'Angel One',
  'angle one': 'Angel One',
  tradex: 'TradeX',
  bear_street: 'Bear Street',
  firstock: 'Firstock',
  fivepaisa: '5paisa',
};

export function brokerLabel(broker: AdminBroker | string | null | undefined): string {
  if (!broker) return '—';
  return BROKER_LABELS[broker] ?? broker;
}

export const BROKER_OPTIONS: { value: AdminBroker; label: string }[] = [
  { value: 'angle_one', label: 'Angel One' },
  { value: 'tradex', label: 'TradeX' },
  { value: 'bear_street', label: 'Bear Street' },
  { value: 'firstock', label: 'Firstock' },
  { value: 'fivepaisa', label: '5paisa' },
];

const PHASE_STYLES: Record<SessionPhase, string> = {
  live: 'bg-gain-soft text-gain ring-gain/25',
  simulation: 'bg-info-soft text-info ring-brand/25',
  scheduled: 'bg-attention-soft text-attention ring-attention/25',
};

export function PhaseBadge({ phase }: { phase: SessionPhase }) {
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ${PHASE_STYLES[phase]}`}>
      {phase}
    </span>
  );
}

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-12 text-center">
      <p className="text-sm font-semibold text-secondary">{title}</p>
      {body && <p className="mt-1 text-[13px] text-muted">{body}</p>}
    </div>
  );
}

/** A page section that failed to load, with a way to try again. */
export function LoadError({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-loss/25 bg-loss-soft px-6 py-10 text-center">
      <p className="text-sm font-semibold text-loss">{title}</p>
      <p className="mt-1 text-[13px] text-loss/80">The gateway did not answer. Check the connection and try again.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-lg border border-loss/25 bg-surface px-3 py-1.5 text-[12px] font-semibold text-loss transition-colors hover:bg-loss-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-loss/30"
      >
        Retry
      </button>
    </div>
  );
}

export const inputClass =
  'rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder-muted shadow-sm focus:border-gain focus:outline-none focus:ring-2 focus:ring-gain/20';

export const secondaryButtonClass =
  'flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] font-semibold text-secondary transition-colors hover:bg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-gain/30 disabled:opacity-50';

export const primaryButtonClass =
  'flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[13px] font-semibold text-on-primary transition-colors hover:bg-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 disabled:opacity-50';

export function Pager({ page, limit, total, onPage, disabled }: { page: number; limit: number; total: number; onPage: (p: number) => void; disabled?: boolean }) {
  return <Pagination page={page} pageSize={limit} total={total} onPage={onPage} disabled={disabled} label="Records" />;
}
