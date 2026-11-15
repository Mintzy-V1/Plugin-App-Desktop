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

  useEffect(() => {
    adminApi.listKeys().then((res) => setKeys(res.data.keys)).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminApi.listAudit({
      adminKeyId: who || undefined,
      from: from ? istDayStart(from) : undefined,
      to: to ? istDayEnd(to) : undefined,
      page,
      limit: PAGE_SIZE,
    })
      .then((res) => { if (!cancelled) setData({ entries: res.data.entries, total: res.data.total }); })
      .catch(() => { if (!cancelled) toast.error('Could not load the audit log'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [who, from, to, page, toast]);

  const resetPage = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };

  return (
    <div className="page-stack">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="audit-who" className="block text-[11px] font-medium text-slate-500">Admin</label>
          <select id="audit-who" value={who} onChange={(e) => resetPage(setWho)(e.target.value)} className={`${inputClass} mt-1`}>
            <option value="">Everyone</option>
            <option value="master">Master key</option>
            {keys.map((k) => <option key={k._id} value={k._id}>{k.name}{k.revokedAt ? ' (revoked)' : ''}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="audit-from" className="block text-[11px] font-medium text-slate-500">From</label>
          <input id="audit-from" type="date" value={from} onChange={(e) => resetPage(setFrom)(e.target.value)} className={`${inputClass} mt-1`} />
        </div>
        <div>
          <label htmlFor="audit-to" className="block text-[11px] font-medium text-slate-500">To</label>
          <input id="audit-to" type="date" value={to} onChange={(e) => resetPage(setTo)(e.target.value)} className={`${inputClass} mt-1`} />
        </div>
        {loading && <Spinner className="mb-2.5 h-4 w-4 text-slate-400" />}
      </div>

      {data && data.entries.length === 0 && <EmptyState title="No audit entries for these filters" />}

      {data && data.entries.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <table className="w-full min-w-[820px] text-left text-[13px]">
            <thead className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-2.5 font-medium">When (IST)</th>
                <th className="px-3 py-2.5 font-medium">Who</th>
                <th className="px-3 py-2.5 font-medium">What</th>
                <th className="px-3 py-2.5 font-medium">Target</th>
                <th className="px-3 py-2.5 text-right font-medium">Result</th>
                <th className="px-4 py-2.5 font-medium">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.entries.map((e) => (
                <tr key={e._id}>
                  <td className="whitespace-nowrap px-4 py-2 text-[12px] tabular-nums text-slate-600">
                    {new Date(e.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="px-3 py-2 text-slate-800">
                    {e.adminName || (e.role === 'master' ? 'Master' : <span className="text-slate-400">Not signed in</span>)}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{describe(e)}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{e.targetSessionId || e.targetUserId || '—'}</td>
                  <td className={`px-3 py-2 text-right tabular-nums text-[12px] ${e.status >= 400 ? 'text-red-600' : 'text-slate-500'}`}>{e.status}</td>
                  <td className="px-4 py-2 font-mono text-[11px] text-slate-500">{e.ip || '—'}</td>
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
