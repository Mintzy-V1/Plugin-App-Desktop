import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSessionDataSource } from './sessionDataSource';
import {
  latestEventTime,
  loadSeen,
  markSeen,
  mergeSessionEvents,
  nextPopupEvent,
  parseSessionEvents,
  saveSeen,
  unseenEvents,
  type SessionEvent,
} from './sessionEvents';

interface Options {
  /** Ended session: poll slowly and never pop anything up */
  readOnly: boolean;
  /** Called once per new warning (toast) */
  onWarning?: (event: SessionEvent) => void;
}

/**
 * Polls the session's error events (every 10s live, 60s for an ended session) with a
 * ?since= cursor, and tracks what this viewer has seen.
 *
 * - popup: the most severe unseen critical / error event, only for a running session
 *   viewed by its owner (admins get the list, never popups)
 * - warnings are handed to onWarning once
 * - a critical event also raises a desktop notification (respects the app's setting)
 * - a gateway without the events route just yields no events
 */
export function useSessionEvents(sessionId: string, { readOnly, onWarning }: Options) {
  const source = useSessionDataSource();
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [expired, setExpired] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [seen, setSeen] = useState(() => loadSeen(sessionId));
  const cursorRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);
  const notifiedRef = useRef<Set<string>>(new Set());
  const onWarningRef = useRef(onWarning);
  onWarningRef.current = onWarning;

  useEffect(() => {
    let cancelled = false;
    setEvents([]);
    setExpired(false);
    setExpiresAt(null);
    setLoaded(false);
    setSeen(loadSeen(sessionId));
    cursorRef.current = null;

    const poll = async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const res = await source.getSessionEvents(sessionId, cursorRef.current);
        if (cancelled) return;
        const parsed = parseSessionEvents(res.data);
        setExpired(parsed.expired === true);
        setExpiresAt(parsed.expires_at ?? null);
        if (parsed.events.length > 0) {
          setEvents((prev) => {
            const merged = mergeSessionEvents(prev, parsed.events);
            cursorRef.current = latestEventTime(merged);
            return merged;
          });
        }
      } catch {
        // Older gateway (no route) or offline: keep what we have
      } finally {
        inFlightRef.current = false;
        if (!cancelled) setLoaded(true);
      }
    };

    poll();
    const id = setInterval(poll, readOnly ? 60000 : 10000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [sessionId, readOnly, source]);

  const owner = !source.viewOnly;
  const popupsOn = owner && !readOnly;

  const commitSeen = useCallback((list: SessionEvent[]) => {
    setSeen((prev) => {
      const next = markSeen(prev, list);
      saveSeen(sessionId, next);
      return next;
    });
  }, [sessionId]);

  // Warnings: one toast each; critical: one desktop notification each
  useEffect(() => {
    if (!popupsOn) return;
    const fresh = unseenEvents(events, seen);
    const warnings = fresh.filter((e) => e.severity === 'warning');
    if (warnings.length > 0) {
      for (const w of warnings) onWarningRef.current?.(w);
      commitSeen(warnings);
    }
    for (const e of fresh) {
      if (e.severity !== 'critical' || notifiedRef.current.has(e.event_id)) continue;
      notifiedRef.current.add(e.event_id);
      try {
        window.mintzy?.system?.showNotification?.(`Mintzy: ${e.title}`, e.message);
      } catch {
        // Not in the desktop shell
      }
    }
  }, [events, seen, popupsOn, commitSeen]);

  const popup = useMemo(() => (popupsOn ? nextPopupEvent(events, seen) : null), [popupsOn, events, seen]);
  const unread = useMemo(() => new Set(unseenEvents(events, seen).map((e) => e.event_id)), [events, seen]);

  return {
    events,
    expired,
    expiresAt,
    loaded,
    popup,
    unread,
    /** Close the popup for this event */
    dismiss: (event: SessionEvent) => commitSeen([event]),
    /** The Notifications tab was opened: everything listed counts as seen */
    markAllSeen: () => commitSeen(events),
  };
}
