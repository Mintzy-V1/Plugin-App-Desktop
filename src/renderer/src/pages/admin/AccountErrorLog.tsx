import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { adminApi } from '../../lib/adminApi';
import { parseSessionEvents, type SessionEvent } from '../../lib/sessionEvents';
import SessionNotifications from '../../components/plugin/SessionNotifications';
import { LoadError, Pager, Spinner, inputClass, secondaryButtonClass } from './adminFormat';

const PAGE_SIZE = 100;

const istDay = (value: string) => {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return 'Unknown day';
  return new Date(ms).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' });
};

/**
 * One account's raw error events across all its sessions for the last 7 days (the
 * events' retention), newest first, grouped by day and session.
 */
export default function AccountErrorLog({ userId, onOpenSession }: { userId: string; onOpenSession: (sessionId: string) => void }) {
  const [severity, setSeverity] = useState('');
  const [page, setPage] = useState(1);
  const [events, setEvents] = useState<SessionEvent[] | null>(null);
  const [total, setTotal] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    adminApi.getUserEvents(userId, { severity: severity || undefined, page, limit: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        setEvents(parseSessionEvents(res.data).events);
        setTotal(Number(res.data.total) || 0);
      })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, severity, page, tick]);

  // Day (IST) -> session -> events, keeping newest-first order
  const groups = useMemo(() => {
    const out: Array<{ day: string; sessions: Array<{ sessionId: string; events: SessionEvent[] }> }> = [];
    for (const e of events || []) {
      const day = istDay(e.last_at);
      let dayGroup = out.find((g) => g.day === day);
      if (!dayGroup) { dayGroup = { day, sessions: [] }; out.push(dayGroup); }
      const sid = e.session_id || 'unknown';
      let sessionGroup = dayGroup.sessions.find((s) => s.sessionId === sid);
      if (!sessionGroup) { sessionGroup = { sessionId: sid, events: [] }; dayGroup.sessions.push(sessionGroup); }
      sessionGroup.events.push(e);
    }
    return out;
  }, [events]);

  return (
    <div className="page-stack">
      <div className="flex flex-wrap items-center gap-2">
        <select value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(1); }} aria-label="Filter by severity" className={inputClass}>
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="error">Error</option>
          <option value="warning">Warning</option>
          <option value="info">Info (admin only)</option>
        </select>
        <button type="button" onClick={() => setTick((n) => n + 1)} className={secondaryButtonClass}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Refresh
        </button>
        {loading && <Spinner className="h-4 w-4 text-muted" />}
        <span className="ml-auto text-[12px] text-muted">Last 7 days · {total} event{total === 1 ? '' : 's'}</span>
      </div>

      {failed && <LoadError title="Could not load this account's error log" onRetry={() => setTick((n) => n + 1)} />}
      {!failed && events && events.length === 0 && (
        <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-12 text-center">
          <p className="text-sm font-semibold text-secondary">No errors in the last 7 days</p>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.day} className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">{g.day}</h3>
          {g.sessions.map((s) => (
            <div key={s.sessionId} className="space-y-1.5">
              <button
                type="button"
                onClick={() => s.sessionId !== 'unknown' && onOpenSession(s.sessionId)}
                className="font-mono text-[11px] text-muted hover:text-ink hover:underline"
                title="Open this session"
              >
                Session {s.sessionId}
              </button>
              <SessionNotifications events={s.events} raw expired={false} expiresAt={null} loaded unread={new Set()} />
            </div>
          ))}
        </section>
      ))}

      {total > PAGE_SIZE && <Pager page={page} limit={PAGE_SIZE} total={total} onPage={setPage} disabled={loading} />}
    </div>
  );
}
