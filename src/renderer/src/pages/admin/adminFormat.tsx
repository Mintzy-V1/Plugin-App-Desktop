import type { AdminBroker, SessionPhase } from '../../lib/adminApi';

export function formatMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const sign = n < 0 ? '-' : '';
  return `${sign}₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function pnlClass(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n === 0) return 'text-slate-700';
  return n > 0 ? 'text-emerald-700' : 'text-red-600';
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
];

const PHASE_STYLES: Record<SessionPhase, string> = {
  live: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  simulation: 'bg-blue-50 text-blue-700 ring-blue-200',
  scheduled: 'bg-amber-50 text-amber-800 ring-amber-200',
};

export function PhaseBadge({ phase }: { phase: SessionPhase }) {
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${PHASE_STYLES[phase]}`}>
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
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {body && <p className="mt-1 text-[13px] text-slate-500">{body}</p>}
    </div>
  );
}

/** A page section that failed to load, with a way to try again. */
export function LoadError({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 px-6 py-10 text-center">
      <p className="text-sm font-semibold text-red-800">{title}</p>
      <p className="mt-1 text-[13px] text-red-700/80">The gateway did not answer. Check the connection and try again.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-red-700 transition-colors hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
      >
        Retry
      </button>
    </div>
  );
}

export const inputClass =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 placeholder-slate-400 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20';

export const secondaryButtonClass =
  'flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 disabled:opacity-50';

export const primaryButtonClass =
  'flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 disabled:opacity-50';

export function Pager({ page, limit, total, onPage }: { page: number; limit: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (total <= limit) return null;
  return (
    <div className="flex items-center justify-between px-1 pt-3 text-[12px] text-slate-500">
      <span>
        {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
      </span>
      <div className="flex gap-1.5">
        <button type="button" className={secondaryButtonClass} disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <button type="button" className={secondaryButtonClass} disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}
