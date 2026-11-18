import { useMemo, useState } from 'react';
import { ChevronRight, Download, Loader2, Search, X } from 'lucide-react';
import type { TradingSession } from '../../lib/pluginApi';
import { Pagination } from '../ui/Pagination';
import { usePagination } from '../../lib/usePagination';
import { isConfigurableSessionStatus, isLiveSessionStatus, sessionStatusBadgeClass, sessionStatusLabel } from '../../lib/sessionStatus';

type Group = 'all' | 'live' | 'ready' | 'closed';
const GROUPS: { id: Group; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'live', label: 'Live' }, { id: 'ready', label: 'Ready' }, { id: 'closed', label: 'Closed' },
];
const groupOf = (s: TradingSession): Group =>
  isLiveSessionStatus(s.status) ? 'live' : isConfigurableSessionStatus(s.status) ? 'ready' : 'closed';

const shortId = (id?: string) => (id && id.length > 18 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id || '—');
const when = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '—', time: '' };
  return {
    date: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }),
  };
};

export function SessionsTable({ sessions, loading, loadError, onRetry, onOpenSession, downloadingId, onDownload }: {
  sessions: TradingSession[];
  loading: boolean;
  loadError: boolean;
  onRetry: () => void;
  onOpenSession?: (s: TradingSession) => void;
  downloadingId: string | null;
  onDownload: (sessionId?: string, status?: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<Group>('all');
  const counts = useMemo(() => {
    const c: Record<Group, number> = { all: sessions.length, live: 0, ready: 0, closed: 0 };
    for (const s of sessions) c[groupOf(s)] += 1;
    return c;
  }, [sessions]);
  const q = query.trim().toLowerCase();
  const filtered = sessions.filter((s) =>
    (group === 'all' || groupOf(s) === group) &&
    (!q || [s.python_session_id, s.configuration_name, sessionStatusLabel(s.status)].some((v) => v?.toLowerCase().includes(q))));
  const history = usePagination(filtered, 10, `${q}:${group}`);

  if (loading && sessions.length === 0) {
    return <div className="h-80 animate-pulse rounded-2xl border border-line bg-surface" aria-busy="true" aria-label="Loading sessions" />;
  }
  if (loadError && sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-12 text-center">
        <p className="text-sm font-semibold text-ink">Couldn’t load your sessions</p>
        <p className="mt-1 text-sm text-muted">Check your connection and try again.</p>
        <button type="button" onClick={onRetry} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary">Retry</button>
      </div>
    );
  }

  return (
    <section aria-label="Session history" className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
        <div role="radiogroup" aria-label="Filter by state" className="flex flex-wrap gap-1.5">
          {GROUPS.map((g) => (
            <button key={g.id} type="button" role="radio" aria-checked={group === g.id} onClick={() => setGroup(g.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${group === g.id ? 'border-ink bg-ink text-canvas' : 'border-line text-secondary hover:border-muted hover:text-ink'}`}>
              {g.label}<span className={`tabular-nums ${group === g.id ? 'opacity-70' : 'text-muted'}`}>{counts[g.id]}</span>
            </button>
          ))}
        </div>
        <label className="relative ml-auto min-w-56 flex-1 @min-[900px]:max-w-80">
          <span className="sr-only">Search session history</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input type="search" placeholder="Search strategy or session ID" value={query} onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-line bg-subtle py-2 pl-8 pr-8 text-sm text-ink focus:bg-surface" />
          {query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted hover:text-ink"><X className="h-3.5 w-3.5" /></button>}
        </label>
      </div>

      {sessions.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <p className="text-sm font-semibold text-ink">No trading sessions yet</p>
          <p className="mt-1 text-sm text-muted">Start one from Launch Terminal and it will show up here.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="px-6 py-14 text-center text-sm text-muted">No sessions match these filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] font-semibold uppercase tracking-wider text-muted">
                <th scope="col" className="px-5 py-2.5">Strategy</th>
                <th scope="col" className="px-5 py-2.5">Started</th>
                <th scope="col" className="px-5 py-2.5">Status</th>
                <th scope="col" className="px-5 py-2.5 text-right">Export</th>
              </tr>
            </thead>
            <tbody>
              {history.rows.map((s) => {
                const { date, time } = when(s.created_at);
                const busy = downloadingId === s.python_session_id;
                return (
                  <tr key={s._id}
                    onClick={() => onOpenSession?.(s)}
                    onKeyDown={(e) => { if (onOpenSession && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpenSession(s); } }}
                    tabIndex={onOpenSession ? 0 : undefined}
                    aria-label={onOpenSession ? `Open ${s.configuration_name || 'session'} from ${date}` : undefined}
                    className={`group border-b border-line/70 last:border-b-0 transition-colors hover:bg-subtle ${onOpenSession ? 'cursor-pointer' : ''}`}>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-ink">{s.configuration_name || 'One-off session'}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted" title={s.python_session_id}>{shortId(s.python_session_id)}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] text-ink">{date}</p>
                      <p className="mt-0.5 text-[11px] text-muted">{time}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${sessionStatusBadgeClass(s.status)}`}>
                        <span className={`h-1.5 w-1.5 rounded-full bg-current ${isLiveSessionStatus(s.status) ? 'animate-pulse' : 'opacity-70'}`} aria-hidden="true" />
                        {sessionStatusLabel(s.status)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={(e) => { e.stopPropagation(); onDownload(s.python_session_id, s.status); }}
                          disabled={!s.python_session_id || busy} aria-label={`Download CSV for ${date}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-2.5 py-1.5 text-xs font-semibold text-secondary transition-colors hover:border-line hover:bg-surface hover:text-ink disabled:opacity-40">
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Download className="h-3.5 w-3.5" aria-hidden="true" />}CSV
                        </button>
                        {onOpenSession && <ChevronRight className="h-4 w-4 text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100" aria-hidden="true" />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {filtered.length > 0 && <Pagination page={history.page} pageSize={history.pageSize} total={history.total} onPage={history.onPage} onPageSize={history.onPageSize} label="Sessions" />}
    </section>
  );
}
