import { useEffect, useState } from 'react';
import AccountErrorLog from './AccountErrorLog';
import { ArrowLeft } from 'lucide-react';
import { adminApi, type AdminAccount, type AdminSession } from '../../lib/adminApi';
import { sessionStatusLabel } from '../../lib/sessionStatus';
import {
  BROKER_OPTIONS, EmptyState, LoadError, Pager, PhaseBadge, Spinner, brokerLabel, formatDateTime, inputClass, secondaryButtonClass,
} from './adminFormat';

const PAGE_SIZE = 25;

function AccountList({ onOpenUser }: { onOpenUser: (userId: string) => void }) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [broker, setBroker] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ users: AdminAccount[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  // Debounce typing so each keystroke doesn't hit the API (and the audit log).
  useEffect(() => {
    const id = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 350);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    adminApi.listUsers({ search: query || undefined, broker: broker || undefined, page, limit: PAGE_SIZE })
      .then((res) => { if (!cancelled) setData({ users: res.data.users, total: res.data.total }); })
      .catch(() => {
        if (cancelled) return;
        setData(null);
        setFailed(true);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query, broker, page, retryTick]);

  return (
    <div className="page-stack">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email"
          aria-label="Search accounts"
          className={`${inputClass} min-w-[260px] flex-1`}
        />
        <select value={broker} onChange={(e) => { setBroker(e.target.value); setPage(1); }} aria-label="Filter by broker" className={inputClass}>
          <option value="">All brokers</option>
          {BROKER_OPTIONS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
        </select>
        {loading && <Spinner className="h-4 w-4 text-slate-400" />}
      </div>

      {failed && <LoadError title="Could not load accounts" onRetry={() => setRetryTick((n) => n + 1)} />}
      {data && data.users.length === 0 && <EmptyState title="No accounts found" />}

      {data && data.users.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-2.5 font-medium">Account</th>
                <th className="px-3 py-2.5 font-medium">Broker</th>
                <th className="px-3 py-2.5 text-right font-medium">Sessions</th>
                <th className="px-3 py-2.5 text-right font-medium">Live now</th>
                <th className="px-4 py-2.5 text-right font-medium">Last session</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.users.map((u) => (
                <tr
                  key={u._id}
                  onClick={() => onOpenUser(u._id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onOpenUser(u._id); }}
                  tabIndex={0}
                  className="cursor-pointer transition-colors hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                >
                  <td className="px-4 py-2.5">
                    <p className="font-semibold text-slate-900">{u.name}</p>
                    <p className="text-[11px] text-slate-500">{u.email}</p>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{brokerLabel(u.broker)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{u.session_count}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {u.live_session_count > 0
                      ? <span className="font-semibold text-emerald-700">{u.live_session_count}</span>
                      : <span className="text-slate-400">0</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[12px] text-slate-500">{formatDateTime(u.last_session_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pager page={page} limit={PAGE_SIZE} total={data.total} onPage={setPage} />}
    </div>
  );
}

function AccountDetail({ userId, onBack, onOpenSession }: { userId: string; onBack: () => void; onOpenSession: (sessionId: string) => void }) {
  const [data, setData] = useState<{ user: AdminAccount; sessions: AdminSession[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<'sessions' | 'errors'>('sessions');
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    adminApi.getUser(userId)
      .then((res) => { if (!cancelled) setData({ user: res.data.user, sessions: res.data.sessions }); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [userId, retryTick]);

  return (
    <div className="page-stack">
      <div>
        <button type="button" onClick={onBack} className={secondaryButtonClass}>
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Accounts
        </button>
      </div>

      {!data && !failed && <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400"><Spinner /> Loading account…</div>}
      {!data && failed && <LoadError title="Could not load this account" onRetry={() => setRetryTick((n) => n + 1)} />}

      {data && (
        <>
          <div className="rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-sm">
            <p className="text-[15px] font-semibold text-slate-900">{data.user.name}</p>
            <p className="text-[12px] text-slate-500">
              {data.user.email} · {brokerLabel(data.user.broker)} · {data.user.isActive === false ? 'Inactive' : 'Active'}
              {data.user.lastLogin ? ` · last login ${formatDateTime(data.user.lastLogin)}` : ''}
            </p>
          </div>

          <div role="tablist" aria-label="Account data" className="inline-flex gap-0.5 self-start rounded-lg bg-slate-200/60 p-0.5">
            {([['sessions', 'Sessions'], ['errors', 'Error log (7 days)']] as const).map(([key, label]) => (
              <button key={key} role="tab" aria-selected={view === key} onClick={() => setView(key)}
                className={`rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 ${
                  view === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}>
                {label}
              </button>
            ))}
          </div>

          {view === 'errors' && <AccountErrorLog userId={userId} onOpenSession={onOpenSession} />}

          {view === 'sessions' && data.sessions.length === 0 && <EmptyState title="No sessions yet" />}
          {view === 'sessions' && data.sessions.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <table className="w-full min-w-[640px] text-left text-[13px]">
                <thead className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Started</th>
                    <th className="px-3 py-2.5 font-medium">Strategy</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Session id</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.sessions.map((s) => {
                    const openable = !!s.python_session_id;
                    return (
                      <tr
                        key={s._id}
                        onClick={() => openable && onOpenSession(s.python_session_id)}
                        onKeyDown={(e) => { if (openable && e.key === 'Enter') onOpenSession(s.python_session_id); }}
                        tabIndex={openable ? 0 : -1}
                        className={openable ? 'cursor-pointer transition-colors hover:bg-slate-50 focus:bg-slate-50 focus:outline-none' : 'opacity-60'}
                      >
                        <td className="px-4 py-2.5 text-slate-700">{formatDateTime(s.created_at)}</td>
                        <td className="px-3 py-2.5 text-slate-600">{s.configuration_name || '—'}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-700">{sessionStatusLabel(s.status) || s.status}</span>
                            {['live', 'simulation'].includes(s.phase) && ['trading_active', 'running', 'started', 'active', 'simulation_active'].includes(s.status) && <PhaseBadge phase={s.phase} />}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">{s.python_session_id || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function AdminAccountsPage({ userId, onOpenUser, onBack, onOpenSession }: {
  userId: string | null;
  onOpenUser: (userId: string) => void;
  onBack: () => void;
  onOpenSession: (sessionId: string) => void;
}) {
  return userId
    ? <AccountDetail userId={userId} onBack={onBack} onOpenSession={onOpenSession} />
    : <AccountList onOpenUser={onOpenUser} />;
}
