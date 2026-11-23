import { DataTable } from '../../components/ui/DataTable';
import { LoadError } from './adminFormat';
import { useEffect, useState } from 'react';
import { adminApi, type AdminKey, type AuditEntry } from '../../lib/adminApi';
import { useToast } from '../../components/ui/Toast';
import { EmptyState, Pager, Spinner, inputClass } from './adminFormat';

const PAGE_SIZE = 50;

const ACTION_LABELS: Record<string, string> = {
  login_success: 'Signed in',
  login_failed: 'Failed sign-in',
  login_blocked: 'Sign-in blocked (rate limit)',
  key_created: 'Created key',
  key_revoked: 'Revoked key',
};

/** Human description of an audited request. */
function describe(entry: AuditEntry): string {
  if (entry.action && ACTION_LABELS[entry.action]) {
    return entry.detail ? `${ACTION_LABELS[entry.action]}: ${entry.detail}` : ACTION_LABELS[entry.action];
  }
  const path = entry.path.replace(/^\/api\/v1\/admin/, '') || '/';
  if (path === '/overview') return 'Viewed live sessions';
  if (path === '/users') return 'Searched accounts';
  if (path === '/keys') return 'Viewed admin keys';
  if (path === '/audit') return 'Viewed audit log';
  if (path === '/me') return 'Checked session';
  if (/^\/users\/[^/]+$/.test(path)) return 'Viewed account';
  if (path === '/signal/pyramid') return 'Viewed signal pyramid days';
  if (path === '/signal/status') return 'Viewed signal service status';
  const pyramidDay = /^\/signal\/pyramid\/(\d{4}-\d{2}-\d{2})$/.exec(path)?.[1];
  if (pyramidDay) return `Viewed signal pyramid for ${pyramidDay}`;
  const sub = /^\/sessions\/[^/]+(\/.*)?$/.exec(path)?.[1];
  if (path.startsWith('/sessions/')) return sub ? `Viewed session ${sub.slice(1)}` : 'Opened session';
  return `${entry.method} ${path}`;
}

/** yyyy-mm-dd (from a date input, IST) → ISO bounds for the API. */
const istDayStart = (day: string) => new Date(`${day}T00:00:00+05:30`).toISOString();
const istDayEnd = (day: string) => new Date(`${day}T23:59:59.999+05:30`).toISOString();

export default function AdminAuditPage() {
  const toast = useToast();
  const [keys, setKeys] = useState<AdminKey[]>([]);
  const [who, setWho] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ entries: AuditEntry[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    adminApi.listKeys().then((res) => setKeys(res.data.keys)).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    adminApi.listAudit({
      adminKeyId: who || undefined,
      from: from ? istDayStart(from) : undefined,
      to: to ? istDayEnd(to) : undefined,
      page,
      limit: PAGE_SIZE,
    })
      .then((res) => { if (!cancelled) setData({ entries: res.data.entries, total: res.data.total }); })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [who, from, to, page, toast, retry]);

  const resetPage = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };

  return (
    <div className="page-stack">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="audit-who" className="block text-[11px] font-medium text-muted">Admin</label>
          <select id="audit-who" value={who} onChange={(e) => resetPage(setWho)(e.target.value)} className={`${inputClass} mt-1`}>
            <option value="">Everyone</option>
            <option value="master">Master key</option>
            {keys.map((k) => <option key={k._id} value={k._id}>{k.name}{k.revokedAt ? ' (revoked)' : ''}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="audit-from" className="block text-[11px] font-medium text-muted">From</label>
          <input id="audit-from" type="date" value={from} onChange={(e) => resetPage(setFrom)(e.target.value)} className={`${inputClass} mt-1`} />
        </div>
        <div>
          <label htmlFor="audit-to" className="block text-[11px] font-medium text-muted">To</label>
          <input id="audit-to" type="date" value={to} onChange={(e) => resetPage(setTo)(e.target.value)} className={`${inputClass} mt-1`} />
        </div>
        {loading && <Spinner className="mb-2.5 h-4 w-4 text-muted" />}
      </div>

      {data && data.entries.length === 0 && <EmptyState title="No audit entries for these filters" />}

      {failed && <LoadError title={data ? 'Audit log could not refresh. Shown entries may be out of date.' : 'Could not load the audit log'} onRetry={() => setRetry(n => n + 1)} />}
      {data && data.entries.length > 0 && <DataTable caption="Audit entries" minWidth={820} rows={data.entries} rowKey={e => e._id} columns={[
        { id: 'when', header: 'When · IST', cell: e => <span className="whitespace-nowrap">{new Date(e.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span> },
        { id: 'who', header: 'Admin', cell: e => <span className="font-medium text-ink">{e.adminName || (e.role === 'master' ? 'Master' : 'Not signed in')}</span> },
        { id: 'what', header: 'Action', cell: e => describe(e) },
        { id: 'target', header: 'Target', cell: e => <span className="font-mono text-xs text-muted">{e.targetSessionId || e.targetUserId || '—'}</span> },
        { id: 'result', header: 'Result', align: 'right', cell: e => <span className={e.status >= 400 ? 'text-loss' : 'text-secondary'}>{e.status}</span> },
        { id: 'ip', header: 'IP address', cell: e => <span className="font-mono text-xs">{e.ip || '—'}</span> },
      ]} />}
      {data && <Pager page={page} limit={PAGE_SIZE} total={data.total} onPage={setPage} disabled={loading} />}
    </div>
  );
}
