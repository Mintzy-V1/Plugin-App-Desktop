const IST = 'Asia/Kolkata';

function istParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

/** YYYY-MM-DD in Asia/Kolkata. */
export function istDateKey(ms: number | Date = Date.now()): string {
  const d = typeof ms === 'number' ? new Date(ms) : ms;
  const { year, month, day } = istParts(d);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function istNowParts(now = new Date()) {
  return istParts(now);
}

export function formatIstDayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return dateKey;
  const utc = Date.UTC(y, m - 1, d, 6, 30);
  return new Date(utc).toLocaleDateString('en-IN', {
    timeZone: IST,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatIstMonthLabel(year: number, month: number): string {
  const utc = Date.UTC(year, month - 1, 15, 6, 30);
  return new Date(utc).toLocaleDateString('en-IN', {
    timeZone: IST,
    month: 'short',
    year: 'numeric',
  });
}
