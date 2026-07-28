/** Maps raw backend session status strings to polished user-facing labels. */
const STATUS_LABELS: Record<string, string> = {
  trading_active: 'Trading',
  active: 'Trading',
  running: 'Trading',
  started: 'Trading',
  authenticated: 'Ready',
  awaiting_totp: 'Awaiting 2FA',
  credentials_submitted: 'Connecting',
  credentials_received: 'Connecting',
  stopped: 'Stopped',
  completed: 'Completed',
  abandoned: 'Abandoned',
  expired: 'Expired',
  error: 'Error',
  failed: 'Failed',
  unknown: 'Connecting',
  not_found: 'Not found',
};

const ACTIVE_STATUSES = ['trading_active', 'active', 'running', 'started'];

/** Prefer an active status when multiple sources disagree. */
export function resolveSessionStatus(...candidates: Array<string | null | undefined>): string | null {
  const normalized = candidates
    .map(v => (typeof v === 'string' ? v.trim().toLowerCase() : ''))
    .filter(Boolean);
  const active = ACTIVE_STATUSES.find(s => normalized.includes(s));
  if (active) return active;
  const first = candidates.find(v => typeof v === 'string' && v.trim() && v.trim().toLowerCase() !== 'unknown');
  if (first) return first.trim().toLowerCase();
  return normalized.includes('unknown') ? 'unknown' : null;
}

export function sessionStatusLabel(status?: string | null): string {
  if (!status) return 'Unknown';
  const key = status.toLowerCase();
  return STATUS_LABELS[key] ?? status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function sessionStatusBadgeClass(status?: string | null): string {
  switch ((status || '').toLowerCase()) {
    case 'trading_active':
    case 'active':
    case 'running':
    case 'started':
      return 'bg-emerald-50 text-emerald-700';
    case 'authenticated':
      return 'bg-blue-50 text-blue-700';
    case 'error':
    case 'failed':
      return 'bg-red-50 text-red-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}
