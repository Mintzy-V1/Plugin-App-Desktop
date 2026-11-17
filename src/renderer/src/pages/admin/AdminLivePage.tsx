import { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';
import { adminApi, type OverviewResponse } from '../../lib/adminApi';
import {
  BROKER_OPTIONS, EmptyState, PhaseBadge, Spinner, brokerLabel, formatAge, formatMoney, inputClass, pnlClass,
} from './adminFormat';

const POLL_MS = 5000;

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-[120px] flex-1 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-1 text-[17px] font-semibold tabular-nums ${tone ?? 'text-slate-900'}`}>{value}</p>
    </div>
  );
}

export default function AdminLivePage({ onOpenSession }: { onOpenSession: (sessionId: string) => void }) {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [error, setError] = useState(false);
  const [includeStale, setIncludeStale] = useState(false);
  const [broker, setBroker] = useState('');
  const [search, setSearch] = useState('');
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
    return (data?.sessions ?? []).filter((s) => {
      if (broker && s.broker !== broker) return false;
      if (!q) return true;
      return [s.user?.name, s.user?.email, s.session_id, s.configuration_name]
        .some((v) => v?.toLowerCase().includes(q));
    });
  }, [data, broker, search]);

  const totals = data?.totals;

  return (
    <div className="page-stack">
      <div className="flex flex-wrap gap-3">
        <Stat label="Sessions" value={totals ? String(totals.sessions) : '—'} />
        <Stat label="Live · Sim · Scheduled" value={totals ? `${totals.live} · ${totals.simulation} · ${totals.scheduled}` : '—'} />
        <Stat label="Total P&L" value={formatMoney(totals?.total_pnl)} tone={pnlClass(totals?.total_pnl)} />
        <Stat label="Realized" value={formatMoney(totals?.realized_pnl)} tone={pnlClass(totals?.realized_pnl)} />
        <Stat label="Unrealized" value={formatMoney(totals?.unrealized_pnl)} tone={pnlClass(totals?.unrealized_pnl)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search user, email, session or strategy"
          aria-label="Search sessions"
          className={`${inputClass} min-w-[260px] flex-1`}
        />
        <select value={broker} onChange={(e) => setBroker(e.target.value)} aria-label="Filter by broker" className={inputClass}>
          <option value="">All brokers</option>
          {BROKER_OPTIONS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-[12px] text-slate-600">
          <input type="checkbox" checked={includeStale} onChange={(e) => setIncludeStale(e.target.checked)} />
          Show stale
        </label>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-400">
          {error ? (
            <><WifiOff className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" /> Reconnecting…</>
          ) : (
            <><RefreshCw className="h-3 w-3" aria-hidden="true" /> Updates every {POLL_MS / 1000}s</>
          )}
        </span>
      </div>

      {!data && !error && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400"><Spinner /> Loading live sessions…</div>
      )}
      {!data && error && <EmptyState title="Could not load live sessions" body="Retrying automatically." />}
      {data && rows.length === 0 && (
        <EmptyState
          title={data.sessions.length === 0 ? 'No live sessions right now' : 'No sessions match the filters'}
          body={data.sessions.length === 0 ? 'Sessions appear here when an account starts trading or simulating.' : undefined}
        />
      )}

      {data && rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <table className="w-full min-w-[860px] text-left text-[13px]">
            <thead className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-2.5 font-medium">Account</th>
                <th className="px-3 py-2.5 font-medium">Broker</th>
                <th className="px-3 py-2.5 font-medium">Phase</th>
                <th className="px-3 py-2.5 text-right font-medium">Total P&L</th>
                <th className="px-3 py-2.5 text-right font-medium">Realized</th>
                <th className="px-3 py-2.5 text-right font-medium">Unrealized</th>
                <th className="px-3 py-2.5 text-right font-medium">Open</th>
                <th className="px-4 py-2.5 text-right font-medium">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((s) => (
                <tr
                  key={s.session_id}
                  onClick={() => onOpenSession(s.session_id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onOpenSession(s.session_id); }}
                  tabIndex={0}
                  className="cursor-pointer transition-colors hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                >
                  <td className="px-4 py-2.5">
                    <p className="font-semibold text-slate-900">{s.user?.name ?? 'Unknown user'}</p>
                    <p className="text-[11px] text-slate-500">
                      {s.user?.email ?? '—'}
                      {s.configuration_name ? ` · ${s.configuration_name}` : ''}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{brokerLabel(s.broker)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <PhaseBadge phase={s.phase} />
                      {s.stale && <span className="text-[10px] font-semibold uppercase text-slate-400">stale</span>}
                    </div>
                  </td>
                  <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${pnlClass(s.pnl?.total)}`}>{formatMoney(s.pnl?.total)}</td>
                  <td className={`px-3 py-2.5 text-right tabular-nums ${pnlClass(s.pnl?.realized)}`}>{formatMoney(s.pnl?.realized)}</td>
                  <td className={`px-3 py-2.5 text-right tabular-nums ${pnlClass(s.pnl?.unrealized)}`}>{formatMoney(s.pnl?.unrealized)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{s.pnl ? `${s.pnl.open_positions}/${s.pnl.symbols}` : '—'}</td>
                  <td className={`px-4 py-2.5 text-right text-[12px] tabular-nums ${s.pnl && s.pnl.age_seconds > 120 ? 'text-amber-600' : 'text-slate-500'}`}>
                    {s.pnl ? formatAge(s.pnl.age_seconds) : 'No P&L yet'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
