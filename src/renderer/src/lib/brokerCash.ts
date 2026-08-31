const STORAGE_KEY = 'mintzy.broker.cash';

export function pickCash(...sources: unknown[]): number | null {
  for (const src of sources) {
    if (src == null) continue;
    if (typeof src === 'number' && Number.isFinite(src)) return src;
    if (typeof src === 'object') {
      const o = src as Record<string, unknown>;
      const candidates = [
        o.cash_balance, o.free_cash, o.total_capital, o.available_cash,
        o.availablecash, o.AvailableCash, o.net, o.available_balance,
      ];
      for (const c of candidates) {
        if (c == null || c === '') continue;
        const n = Number(c);
        if (Number.isFinite(n)) return n;
      }
      if (o.data && typeof o.data === 'object') {
        const nested = pickCash(o.data);
        if (nested != null) return nested;
      }
      if (o.account_info && typeof o.account_info === 'object') {
        const nested = pickCash(o.account_info);
        if (nested != null) return nested;
      }
      if (o.status && typeof o.status === 'object') {
        const nested = pickCash(o.status);
        if (nested != null) return nested;
      }
      if (o.current && typeof o.current === 'object') {
        const nested = pickCash(o.current);
        if (nested != null) return nested;
      }
    }
  }
  return null;
}

export function rememberBrokerCash(value: number | null | undefined): void {
  if (value == null || !Number.isFinite(value)) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ value, updatedAt: Date.now() }));
  } catch { /* ignore quota / private mode */ }
}

export function readRememberedBrokerCash(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { value?: unknown };
    const n = Number(parsed?.value);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function clearRememberedBrokerCash(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}

/** NSE cash session is 09:15–15:30 IST. */
export function isAfterMarketCloseIST(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour > 15 || (hour === 15 && minute >= 30);
}
