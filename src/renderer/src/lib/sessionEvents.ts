/**
 * Session error events from the trading engine (gateway: GET /sessions/:id/events for the
 * owner, /admin/sessions/:id/events raw for admins).
 *
 * - critical / error open a popup once per event (and again if it gets more severe)
 * - warning shows a toast once
 * - every event is listed in the Notifications tab
 * Users see an event while the session runs and for 48h after it ends.
 */

export type EventSeverity = 'critical' | 'error' | 'warning' | 'info';

export interface SessionEventRaw {
  message?: string;
  broker_errorcode?: string | null;
  broker_response?: unknown;
  exception?: string;
  traceback?: string;
  context?: Record<string, unknown> | null;
}

export interface SessionEvent {
  event_id: string;
  code: string;
  severity: EventSeverity;
  category?: string;
  symbol?: string | null;
  title: string;
  message: string;
  action?: string;
  count: number;
  first_at: string;
  last_at: string;
  account?: string | null;
  simulation?: boolean;
  /** Admin responses only */
  raw?: SessionEventRaw;
  user_visible?: boolean;
  vm?: string;
  broker?: string;
  session_id?: string;
}

export interface SessionEventsResponse {
  events: SessionEvent[];
  expired?: boolean;
  expires_at?: string | null;
}

export const SEVERITY_RANK: Record<EventSeverity, number> = { info: 0, warning: 1, error: 2, critical: 3 };

const SEVERITIES = new Set<EventSeverity>(['critical', 'error', 'warning', 'info']);

function str(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

/** Tolerant parse of the gateway response; drops anything without an id. */
export function parseSessionEvents(raw: unknown): SessionEventsResponse {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(o.events) ? o.events : [];
  const events: SessionEvent[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const e = item as Record<string, unknown>;
    const id = str(e.event_id);
    if (!id) continue;
    const severity = (SEVERITIES.has(e.severity as EventSeverity) ? e.severity : 'info') as EventSeverity;
    events.push({
      ...(e as unknown as SessionEvent),
      event_id: id,
      severity,
      code: str(e.code),
      title: str(e.title) || str(e.code) || 'Notice',
      message: str(e.message),
      action: str(e.action) || undefined,
      count: Number(e.count) > 0 ? Number(e.count) : 1,
      first_at: str(e.first_at),
      last_at: str(e.last_at) || str(e.first_at),
    });
  }
  return { events, expired: o.expired === true, expires_at: (o.expires_at as string | null | undefined) ?? null };
}

/** Merge a polled batch (newer versions of the same event replace older ones), newest first. */
export function mergeSessionEvents(previous: SessionEvent[], incoming: SessionEvent[]): SessionEvent[] {
  const byId = new Map(previous.map((e) => [e.event_id, e]));
  for (const e of incoming) byId.set(e.event_id, e);
  return Array.from(byId.values()).sort((a, b) => Date.parse(b.last_at) - Date.parse(a.last_at));
}

/** The newest last_at, to poll with ?since=. */
export function latestEventTime(events: SessionEvent[]): string | null {
  let best: string | null = null;
  for (const e of events) if (!best || Date.parse(e.last_at) > Date.parse(best)) best = e.last_at;
  return best;
}

// --- What the viewer has already been shown (per viewer, per session) -------------

type SeenMap = Record<string, EventSeverity>;
const seenKey = (sessionId: string) => `mintzy_seen_events:${sessionId}`;

export function loadSeen(sessionId: string): SeenMap {
  try {
    const raw = localStorage.getItem(seenKey(sessionId));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as SeenMap) : {};
  } catch {
    return {};
  }
}

export function saveSeen(sessionId: string, seen: SeenMap): void {
  try {
    localStorage.setItem(seenKey(sessionId), JSON.stringify(seen));
  } catch {
    // Private window / storage blocked: popups may repeat, nothing else breaks
  }
}

/** Events not yet shown to this viewer at their current severity. */
export function unseenEvents(events: SessionEvent[], seen: SeenMap): SessionEvent[] {
  return events.filter((e) => {
    const prev = seen[e.event_id];
    return !prev || SEVERITY_RANK[e.severity] > SEVERITY_RANK[prev];
  });
}

/** The one event to pop up now: the most severe unseen critical / error, newest first. */
export function nextPopupEvent(events: SessionEvent[], seen: SeenMap): SessionEvent | null {
  const candidates = unseenEvents(events, seen).filter((e) => SEVERITY_RANK[e.severity] >= SEVERITY_RANK.error);
  candidates.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || Date.parse(b.last_at) - Date.parse(a.last_at));
  return candidates[0] ?? null;
}

export function markSeen(seen: SeenMap, events: SessionEvent[]): SeenMap {
  const next = { ...seen };
  for (const e of events) {
    const prev = next[e.event_id];
    if (!prev || SEVERITY_RANK[e.severity] > SEVERITY_RANK[prev]) next[e.event_id] = e.severity;
  }
  return next;
}

export const SEVERITY_LABEL: Record<EventSeverity, string> = {
  critical: 'Action needed',
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
};

/** Tailwind classes per severity: chip and list accent. */
export const SEVERITY_STYLE: Record<EventSeverity, { chip: string; accent: string }> = {
  critical: { chip: 'bg-red-100 text-red-800 ring-red-200', accent: 'border-l-red-500' },
  error: { chip: 'bg-orange-100 text-orange-800 ring-orange-200', accent: 'border-l-orange-400' },
  warning: { chip: 'bg-amber-100 text-amber-900 ring-amber-200', accent: 'border-l-amber-400' },
  info: { chip: 'bg-slate-100 text-slate-600 ring-slate-200', accent: 'border-l-slate-300' },
};
