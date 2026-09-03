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

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Epoch ms for today's IST calendar date at hour:minute:second. */
export function istTodayAtMs(hour: number, minute: number, second = 0, now = Date.now()): number {
  const { year, month, day } = istParts(new Date(now));
  return Date.parse(
    `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:${pad2(second)}+05:30`,
  );
}

export function isBeforeIstWallClock(hour: number, minute: number, now = Date.now()): boolean {
  return now < istTodayAtMs(hour, minute, 0, now);
}

/** Simulation / live start is held until 10:30 AM IST the same calendar day. */
export const SIMULATION_START_HOUR = 10;
export const SIMULATION_START_MINUTE = 30;

export function simulationStartMs(now = Date.now()): number {
  return istTodayAtMs(SIMULATION_START_HOUR, SIMULATION_START_MINUTE, 0, now);
}

export function isBeforeSimulationStart(now = Date.now()): boolean {
  return isBeforeIstWallClock(SIMULATION_START_HOUR, SIMULATION_START_MINUTE, now);
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return '0s';
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
