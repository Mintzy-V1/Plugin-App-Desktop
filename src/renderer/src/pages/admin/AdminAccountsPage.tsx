import { DataTable } from '../../components/ui/DataTable';
import { Pagination } from '../../components/ui/Pagination';
import { Tabs } from '../../components/ui/Tabs';
import { usePagination } from '../../lib/usePagination';
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
        {loading && <Spinner className="h-4 w-4 text-muted" />}
      </div>

      {failed && <LoadError title="Could not load accounts" onRetry={() => setRetryTick((n) => n + 1)} />}
      {data && data.users.length === 0 && <EmptyState title="No accounts found" />}

      {data && data.users.length > 0 && <DataTable caption="Accounts" minWidth={720} rows={data.users} rowKey={u => u._id} columns={[
        { id: 'account', header: 'Account', cell: u => <div><button type="button" onClick={() => onOpenUser(u._id)} className="rounded-sm font-semibold text-ink hover:text-brand hover:underline">{u.name}</button><p className="mt-1 text-xs text-muted">{u.email}</p></div> },
        { id: 'broker', header: 'Broker', cell: u => brokerLabel(u.broker) },
        { id: 'sessions', header: 'Sessions', align: 'right', cell: u => u.session_count },
        { id: 'live', header: 'Live now', align: 'right', cell: u => <span className={u.live_session_count ? 'font-semibold text-gain' : 'text-muted'}>{u.live_session_count}</span> },
        { id: 'last', header: 'Last session', align: 'right', cell: u => formatDateTime(u.last_session_at) },
      ]} />}

      {data && <Pager page={page} limit={PAGE_SIZE} total={data.total} onPage={setPage} disabled={loading} />}
    </div>
  );
}

function AccountDetail({ userId, onBack, onOpenSession }: { userId: string; onBack: () => void; onOpenSession: (sessionId: string) => void }) {
  const [data, setData] = useState<{ user: AdminAccount; sessions: AdminSession[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<'sessions' | 'errors'>('sessions');
  const [query, setQuery] = useState('');
  const matchingSessions = (data?.sessions ?? []).filter(s => [s.configuration_name, s.python_session_id, sessionStatusLabel(s.status)].some(v => v?.toLowerCase().includes(query.trim().toLowerCase())));
  const pagination = usePagination(matchingSessions, 25, `${userId}:${query}`);
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

      {!data && !failed && <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted"><Spinner /> Loading account…</div>}
      {!data && failed && <LoadError title="Could not load this account" onRetry={() => setRetryTick((n) => n + 1)} />}

      {data && (
        <>
          <div className="rounded-xl border border-line/80 bg-surface px-5 py-4 shadow-sm">
            <p className="text-[15px] font-semibold text-ink">{data.user.name}</p>
            <p className="text-[12px] text-muted">
              {data.user.email} · {brokerLabel(data.user.broker)} · {data.user.isActive === false ? 'Inactive' : 'Active'}
              {data.user.lastLogin ? ` · last login ${formatDateTime(data.user.lastLogin)}` : ''}
            </p>
          </div>

          <Tabs label="Account data" value={view} onChange={setView} items={[{id:'sessions',label:'Sessions',count:data.sessions.length},{id:'errors',label:'Error log (7 days)'}]} />

          <div role="tabpanel" id="account-data-panel-errors" aria-labelledby="account-data-tab-errors" hidden={view !== 'errors'}>{view === 'errors' && <AccountErrorLog userId={userId} onOpenSession={onOpenSession} />}</div>

          <div role="tabpanel" id="account-data-panel-sessions" aria-labelledby="account-data-tab-sessions" hidden={view !== 'sessions'}>
          {view === 'sessions' && data.sessions.length === 0 && <EmptyState title="No sessions yet" />}
          {view === 'sessions' && data.sessions.length > 0 && <>
            <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search strategy, session or status…" aria-label="Search account sessions" className={`${inputClass} w-full`} />
            <div><DataTable caption="Account sessions" rows={pagination.rows} rowKey={s => s._id} minWidth={680} emptyTitle="No sessions match this search" columns={[
              { id:'started',header:'Started · IST',cell:s => s.python_session_id ? <button type="button" onClick={() => onOpenSession(s.python_session_id)} className="rounded-sm font-medium text-ink hover:text-brand hover:underline">{formatDateTime(s.created_at)}</button> : formatDateTime(s.created_at) },
              { id:'strategy',header:'Strategy',cell:s => s.configuration_name || '—' },
              { id:'status',header:'Status',cell:s => <div className="flex flex-wrap items-center gap-2">{sessionStatusLabel(s.status)}{['live','simulation'].includes(s.phase) && ['trading_active','running','started','active','simulation_active'].includes(s.status) && <PhaseBadge phase={s.phase} />}</div> },
              { id:'session',header:'Session ID',cell:s => <span className="font-mono text-xs text-muted">{s.python_session_id || '—'}</span> },
            ]} /><Pagination {...pagination} label="Account sessions" /></div>
          </>}
          </div>
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
