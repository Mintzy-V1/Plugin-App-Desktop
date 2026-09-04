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

export function isBeforeSimulationStart(now = Date.now()): boolean {
  return isBeforeIstWallClock(SIMULATION_START_HOUR, SIMULATION_START_MINUTE, now);
}