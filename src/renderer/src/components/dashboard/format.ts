/** Number formatting shared by the dashboard tiles, charts and tooltips. */

const MINUS = '−';

export const signOf = (n: number | null | undefined) => (n == null || n === 0 ? '' : n > 0 ? '+' : MINUS);

/** ₹1,23,456.78 with an explicit sign; `signed: false` drops the plus. */
export function inr(n: number | null | undefined, { signed = true, decimals = 2 } = {}) {
  if (n == null || !Number.isFinite(n)) return '—';
  const body = Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const sign = signed ? signOf(n) : n < 0 ? MINUS : '';
  return `${sign}₹${body}`;
}

/** Compact Indian units for axes and dense labels: ₹950, ₹12.4K, ₹3.2L, ₹1.1Cr. */
export function inrCompact(n: number | null | undefined, { signed = false } = {}) {
  if (n == null || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const [value, unit] = abs >= 1e7 ? [abs / 1e7, 'Cr'] : abs >= 1e5 ? [abs / 1e5, 'L'] : abs >= 1e3 ? [abs / 1e3, 'K'] : [abs, ''];
  const digits = unit && value < 10 ? 1 : 0;
  const body = `${value.toFixed(digits).replace(/\.0$/, '')}${unit}`;
  const sign = n < 0 ? MINUS : signed && n > 0 ? '+' : '';
  return `${sign}₹${body}`;
}

export function pct(n: number | null | undefined, { signed = false, decimals = 1 } = {}) {
  if (n == null || !Number.isFinite(n)) return '—';
  const body = Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const sign = n < 0 ? MINUS : signed && n > 0 ? '+' : '';
  return `${sign}${body}%`;
}

export const ratio = (n: number | null | undefined, decimals = 2) =>
  n == null || !Number.isFinite(n) ? '—' : n.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/** Text tone for a signed amount. Neutral stays ink so zero never reads as a gain. */
export const toneClass = (n: number | null | undefined) =>
  n == null || n === 0 ? 'text-ink' : n > 0 ? 'text-gain' : 'text-loss';

const dateFrom = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 6, 30));
};

export const dayLabel = (key: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) =>
  dateFrom(key).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', ...opts });

export const longDayLabel = (key: string) =>
  dayLabel(key, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export const plural = (n: number, word: string) => `${n.toLocaleString('en-IN')} ${word}${n === 1 ? '' : 's'}`;
