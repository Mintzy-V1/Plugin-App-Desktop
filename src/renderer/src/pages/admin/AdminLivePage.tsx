import { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';
import { adminApi, type OverviewResponse, type OverviewSession } from '../../lib/adminApi';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { StatTile } from '../../components/ui/StatTile';
import { StatusPill } from '../../components/ui/StatusPill';
import { Pagination } from '../../components/ui/Pagination';
import { usePagination } from '../../lib/usePagination';
import { BROKER_OPTIONS, PhaseBadge, brokerLabel, formatAge, formatMoney, inputClass, pnlClass } from './adminFormat';
const POLL_MS = 5000;
const problemCount = (s: OverviewSession) => (s.problems?.critical ?? 0) + (s.problems?.error ?? 0);

export default function AdminLivePage({ onOpenSession }: { onOpenSession: (sessionId: string) => void }) {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [error, setError] = useState(false);
  const [includeStale, setIncludeStale] = useState(false);
  const [broker, setBroker] = useState('');
  const [search, setSearch] = useState('');
  const [phase, setPhase] = useState('');
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [sort, setSort] = useState('attention');
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (inFlight.current) return;
      inFlight.current = true;
      adminApi.getOverview(includeStale)
        .then((res) => { if (!cancelled) { setData(res.data); setError(false); } })
        .catch(() => { if (!cancelled) setError(true); })
        .finally(() => { inFlight.current = false; });
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [includeStale]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.sessions ?? []).filter(s => (!broker || s.broker === broker) && (!phase || s.phase === phase) && (!attentionOnly || problemCount(s) > 0) && (!q || [s.user?.name, s.user?.email, s.session_id, s.configuration_name].some(v => v?.toLowerCase().includes(q))))
      .sort((a, b) => {
        if (sort === 'name') return (a.user?.name ?? '').localeCompare(b.user?.name ?? '') || a.session_id.localeCompare(b.session_id);
        if (sort === 'attention') {
          const rank = (s: OverviewSession) => (s.problems?.critical ?? 0) > 0 ? 2 : problemCount(s) > 0 ? 1 : 0;
          const severity = rank(b) - rank(a);
          if (severity) return severity;
        }
        return (b.pnl?.total ?? -Infinity) - (a.pnl?.total ?? -Infinity) || a.session_id.localeCompare(b.session_id);
      });
  }, [data, broker, search, phase, attentionOnly, sort]);
  const pagination = usePagination(rows, 25, `${search}:${broker}:${phase}:${attentionOnly}:${sort}`);
  const totals = data?.totals;
  const needAttention = data?.sessions.filter(s => problemCount(s) > 0).length;
  const columns: Column<OverviewSession>[] = [
    { id: 'account', header: 'Account / strategy', cell: s => <div className="min-w-44"><button type="button" onClick={() => onOpenSession(s.session_id)} className="rounded-sm text-left font-semibold text-ink hover:text-brand hover:underline">{s.user?.name ?? 'Unknown user'}</button><p className="mt-1 max-w-60 truncate text-xs text-muted" title={s.user?.email}>{s.user?.email ?? '—'}</p>{s.configuration_name && <p className="mt-1 text-xs text-secondary">{s.configuration_name}</p>}</div> },
    { id: 'broker', header: 'Broker', cell: s => brokerLabel(s.broker) },
    { id: 'phase', header: 'Phase', cell: s => <div className="flex flex-col items-start gap-2"><PhaseBadge phase={s.phase} />{s.stale && <StatusPill tone="attention">Stale</StatusPill>}</div> },
    { id: 'pnl', header: 'Total P&L', align: 'right', cell: s => <span className={`font-semibold ${pnlClass(s.pnl?.total)}`}>{formatMoney(s.pnl?.total)}</span> },
    { id: 'realized', header: 'Booked', align: 'right', cell: s => <span className={pnlClass(s.pnl?.realized)}>{formatMoney(s.pnl?.realized)}</span> },
    { id: 'unrealized', header: 'Open P&L', align: 'right', cell: s => <span className={pnlClass(s.pnl?.unrealized)}>{formatMoney(s.pnl?.unrealized)}</span> },
    { id: 'positions', header: 'Open / symbols', align: 'right', cell: s => s.pnl ? `${s.pnl.open_positions} / ${s.pnl.symbols}` : '—' },
    { id: 'problems', header: 'Problems · last hour', cell: s => problemCount(s) ? <div className="flex min-w-28 flex-col items-start gap-1">{(s.problems?.critical ?? 0) > 0 && <StatusPill tone="problem">{s.problems!.critical} critical</StatusPill>}{(s.problems?.error ?? 0) > 0 && <StatusPill tone="problem">{s.problems!.error} errors</StatusPill>}<button type="button" onClick={() => onOpenSession(s.session_id)} className="mt-1 text-xs font-medium text-loss underline underline-offset-2">View session details</button></div> : <span className="text-muted">—</span> },
    { id: 'freshness', header: 'Updated', align: 'right', cell: s => <span className={s.stale || (s.pnl?.age_seconds ?? 0) > 120 ? 'text-attention' : 'text-muted'}>{s.pnl ? formatAge(s.pnl.age_seconds) : 'No P&L yet'}</span> },
  ];
  const clearFilters = () => { setSearch(''); setBroker(''); setPhase(''); setAttentionOnly(false); };
  return <div className="page-stack">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.16em] text-muted">Operations overview</p><h2 className="mt-1 font-serif text-3xl text-ink">Live desk</h2></div><p className="flex items-center gap-2 text-xs text-muted">{error ? <><WifiOff className="h-3.5 w-3.5 text-attention" /> Reconnecting · values may be out of date</> : <><RefreshCw className="h-3.5 w-3.5" /> Updates every 5 seconds</>}</p></div>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <StatTile label="Live sessions" value={totals?.live ?? '—'} delta={totals ? `${totals.simulation} simulation · ${totals.scheduled} scheduled` : undefined} />
      <StatTile label="Book P&L" value={<span className={pnlClass(totals?.total_pnl)}>{formatMoney(totals?.total_pnl)}</span>} delta="All returned sessions · before table filters" />
      <StatTile label="Need attention" value={<span className={needAttention ? 'text-loss' : 'text-ink'}>{needAttention ?? '—'}</span>} delta="Sessions with critical or error events · last hour" />
      <StatTile label="Booked / open" value={<span className="text-xl">{formatMoney(totals?.realized_pnl)}</span>} delta={`Open P&L ${formatMoney(totals?.unrealized_pnl)}`} />
    </div>
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-4">
      <input type="search" aria-label="Search sessions" placeholder="Search account, strategy or session…" value={search} onChange={e => setSearch(e.target.value)} className={`${inputClass} min-w-48 flex-1`} />
      <select aria-label="Filter by broker" value={broker} onChange={e => setBroker(e.target.value)} className={inputClass}><option value="">All brokers</option>{BROKER_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}</select>
      <select aria-label="Filter by phase" value={phase} onChange={e => setPhase(e.target.value)} className={inputClass}><option value="">All phases</option><option value="live">Live</option><option value="simulation">Simulation</option><option value="scheduled">Scheduled</option></select>
      <select aria-label="Sort sessions" value={sort} onChange={e => setSort(e.target.value)} className={inputClass}><option value="attention">Attention first, then P&L</option><option value="pnl">Highest P&L</option><option value="name">Account name</option></select>
      <label className="flex items-center gap-2 text-xs text-secondary"><input type="checkbox" checked={attentionOnly} onChange={e => setAttentionOnly(e.target.checked)} />Needs attention</label>
      <label className="flex items-center gap-2 text-xs text-secondary"><input type="checkbox" checked={includeStale} onChange={e => setIncludeStale(e.target.checked)} />Include stale</label>
      {(search || broker || phase || attentionOnly) && <button type="button" onClick={clearFilters} className="text-xs font-medium text-gain">Clear filters</button>}
    </div>
    <div><DataTable caption="Live sessions" columns={columns} rows={pagination.rows} rowKey={s => s.session_id} isProblem={s => problemCount(s) > 0} loading={!data && !error} emptyTitle={error && !data ? 'Could not load live sessions' : data?.sessions.length ? 'No sessions match these filters' : 'No live sessions right now'} emptyDescription={error ? 'Retrying automatically.' : 'Sessions appear when an account starts trading or simulating.'} minWidth={1000} /><Pagination {...pagination} label="Sessions" /></div>
  </div>;
}
