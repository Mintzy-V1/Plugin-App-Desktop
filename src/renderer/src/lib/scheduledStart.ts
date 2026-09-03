import { getBrokerKey, type StartPayload } from './pluginApi';
import { isBeforeSimulationStart, simulationStartMs } from './istClock';

const PREFIX = 'mintzy.scheduledStart.v1.';
const inFlightStarts = new Set<string>();

export interface ScheduledStart {
  sessionId: string;
  payload: StartPayload;
  startAtMs: number;
}

/** Angel One / Bear Street start-simulation waits until 10:30 AM IST. TradeX starts immediately. */
export function shouldDelaySimulationStart(now = Date.now()): boolean {
  return getBrokerKey() !== 'tradex' && isBeforeSimulationStart(now);
}

function storageKey(sessionId: string): string {
  return `${PREFIX}${sessionId}`;
}

export function saveScheduledStart(sessionId: string, payload: StartPayload, now = Date.now()): ScheduledStart {
  const rec: ScheduledStart = {
    sessionId,
    payload,
    startAtMs: simulationStartMs(now),
  };
  try {
    localStorage.setItem(storageKey(sessionId), JSON.stringify(rec));
  } catch {
    /* ignore quota */
  }
  return rec;
}

export function readScheduledStart(sessionId: string): ScheduledStart | null {
  try {
    const raw = localStorage.getItem(storageKey(sessionId));
    if (!raw) return null;
    const rec = JSON.parse(raw) as ScheduledStart;
    if (!rec?.sessionId || !rec.payload || !Number.isFinite(rec.startAtMs)) return null;
    return rec;
  } catch {
    return null;
  }
}

export function hasPendingScheduledStart(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  return readScheduledStart(sessionId) != null;
}

export function clearScheduledStart(sessionId: string | null | undefined): void {
  if (!sessionId) return;
  try {
    localStorage.removeItem(storageKey(sessionId));
  } catch {
    /* ignore */
  }
}

/** Prevents a remount from firing start-simulation twice. */
export function claimScheduledStartFire(sessionId: string): boolean {
  if (inFlightStarts.has(sessionId)) return false;
  inFlightStarts.add(sessionId);
  return true;
}

export function releaseScheduledStartFire(sessionId: string): void {
  inFlightStarts.delete(sessionId);
}
