/** Maps raw backend session status strings to polished user-facing labels. */
const STATUS_LABELS: Record<string, string> = {
  trading_active: 'Trading',
  authenticated: 'Ready',
  awaiting_totp: 'Awaiting 2FA',
  credentials_submitted: 'Connecting',
  stopped: 'Stopped',
  completed: 'Completed',
  expired: 'Expired',
  error: 'Error',
  failed: 'Failed',
};

export function sessionStatusLabel(status?: string | null): string {
  if (!status) return 'Unknown';
  return STATUS_LABELS[status] ?? status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function sessionStatusBadgeClass(status?: string | null): string {
  switch (status) {
    case 'trading_active':
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
