import { DataTable } from '../../components/ui/DataTable';
import { Pagination } from '../../components/ui/Pagination';
import { usePagination } from '../../lib/usePagination';
import { useCallback, useEffect, useState } from 'react';
import { Copy, KeyRound, Plus } from 'lucide-react';
import { adminApi, type AdminKey } from '../../lib/adminApi';
import { pluginErrorMessage } from '../../lib/pluginErrors';
import { useToast } from '../../components/ui/Toast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { EmptyState, LoadError, Spinner, formatDateTime, inputClass, primaryButtonClass, secondaryButtonClass } from './adminFormat';

function NewKeyPanel({ name, keyValue, onDone }: { name: string; keyValue: string; onDone: () => void }) {
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(keyValue);
      toast.success('Key copied');
    } catch {
      toast.error('Could not copy. Select the key and copy it manually.');
    }
  };

  return (
    <div role="status" className="rounded-xl border border-gain/25 bg-gain-soft px-5 py-4">
      <p className="text-[13px] font-semibold text-gain">Key created for {name}</p>
      <p className="mt-0.5 text-[12px] text-gain">
        Copy it now and share it with {name} securely. It won't be shown again; if it's lost, revoke it and create a new one.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 select-all break-all rounded-lg border border-gain/25 bg-surface px-3 py-2 font-mono text-[12px] text-ink">
          {keyValue}
        </code>
        <button type="button" onClick={copy} className={secondaryButtonClass}>
          <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copy
        </button>
        <button type="button" onClick={onDone} className={secondaryButtonClass}>Done</button>
      </div>
    </div>
  );
}

export default function AdminKeysPage() {
  const toast = useToast();
  const [keys, setKeys] = useState<AdminKey[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ name: string; key: string } | null>(null);
  const [query, setQuery] = useState('');
  const [keyStatus, setKeyStatus] = useState('');
  const matchingKeys = (keys ?? []).filter(k => (!keyStatus || (keyStatus === 'active' ? !k.revokedAt : !!k.revokedAt)) && [k.name, k.email, k.keyPrefix].some(v => v?.toLowerCase().includes(query.trim().toLowerCase())));
  const pagination = usePagination(matchingKeys, 25, `${query}:${keyStatus}`);
  const [pendingRevoke, setPendingRevoke] = useState<AdminKey | null>(null);
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(() => {
    setLoadFailed(false);
    adminApi.listKeys()
      .then((res) => setKeys(res.data.keys))
      .catch(() => {
        // Keep a list already on screen; only an empty page needs the error state
        setLoadFailed(true);
        toast.error('Could not load admin keys');
      });
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Enter a name for the key'); return; }
    setCreating(true);
    try {
      const res = await adminApi.createKey(name.trim(), email.trim() || undefined);
      setCreated({ name: res.data.adminKey.name, key: res.data.key });
      setName('');
      setEmail('');
      load();
    } catch (err) {
      toast.error(pluginErrorMessage(err, 'Could not create the key. Please try again.'));
    }
    setCreating(false);
  };

  const revoke = async () => {
    if (!pendingRevoke) return;
    setRevoking(true);
    try {
      await adminApi.revokeKey(pendingRevoke._id);
      toast.success(`Revoked ${pendingRevoke.name}'s key`);
      load();
    } catch {
      toast.error('Could not revoke the key. Please try again.');
    }
    setRevoking(false);
    setPendingRevoke(null);
  };

  return (
    <div className="page-stack">
      <form onSubmit={create} className="flex flex-wrap items-end gap-2 rounded-xl border border-line/80 bg-surface px-5 py-4 shadow-sm">
        <div className="min-w-[180px] flex-1">
          <label htmlFor="key-name" className="block text-[11px] font-medium text-muted">Team member</label>
          <input id="key-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Name" className={`${inputClass} mt-1 w-full`} />
        </div>
        <div className="min-w-[200px] flex-1">
          <label htmlFor="key-email" className="block text-[11px] font-medium text-muted">Email (optional)</label>
          <input id="key-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className={`${inputClass} mt-1 w-full`} />
        </div>
        <button type="submit" disabled={creating} className={primaryButtonClass}>
          {creating ? <Spinner className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" aria-hidden="true" />} Create key
        </button>
      </form>

      {created && <NewKeyPanel name={created.name} keyValue={created.key} onDone={() => setCreated(null)} />}

      {!keys && !loadFailed && <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted"><Spinner /> Loading keys…</div>}
      {!keys && loadFailed && <LoadError title="Could not load admin keys" onRetry={load} />}
      {keys && loadFailed && <LoadError title="Keys could not refresh. Shown access details may be out of date." onRetry={load} />}
      {keys && keys.length === 0 && <EmptyState title="No admin keys yet" body="Create one for each team member who needs admin access." />}

      {keys && keys.length > 0 && <>
        <div className="flex flex-wrap gap-3 rounded-xl border border-line bg-surface p-4">
          <input type="search" aria-label="Search admin keys" placeholder="Search team member or key prefix…" value={query} onChange={e => setQuery(e.target.value)} className={`${inputClass} min-w-48 flex-1`} />
          <select aria-label="Filter key status" value={keyStatus} onChange={e => setKeyStatus(e.target.value)} className={inputClass}><option value="">All keys</option><option value="active">Active</option><option value="revoked">Revoked</option></select>
          {(query || keyStatus) && <button type="button" onClick={() => {setQuery('');setKeyStatus('');}} className="text-xs text-gain">Clear filters</button>}
        </div>
        <div><DataTable caption="Admin keys" rows={pagination.rows} rowKey={k => k._id} minWidth={760} emptyTitle="No keys match these filters" columns={[
          { id: 'member', header: 'Team member', cell: k => <div><p className={`font-semibold ${k.revokedAt ? 'text-muted' : 'text-ink'}`}>{k.name}</p>{k.email && <p className="mt-1 text-xs text-muted">{k.email}</p>}</div> },
          { id: 'key', header: 'Key prefix', cell: k => <span className="flex items-center gap-2 font-mono text-xs"><KeyRound className="h-3.5 w-3.5" />mzadm_{k.keyPrefix}_…</span> },
          { id: 'created', header: 'Created', cell: k => formatDateTime(k.createdAt) },
          { id: 'used', header: 'Last used', cell: k => <div>{formatDateTime(k.lastUsedAt)}{k.lastUsedIp && <p className="mt-1 text-xs text-muted">{k.lastUsedIp}</p>}</div> },
          { id: 'status', header: 'Access', align: 'right', cell: k => k.revokedAt ? <span className="text-xs text-muted">Revoked {formatDateTime(k.revokedAt)}</span> : <button type="button" onClick={() => setPendingRevoke(k)} className="rounded-lg border border-loss/25 px-3 py-1.5 text-xs font-semibold text-loss hover:bg-loss-soft">Revoke</button> },
        ]} /><Pagination {...pagination} label="Keys" /></div>
      </>}

      <ConfirmDialog
        open={!!pendingRevoke}
        title="Revoke admin key?"
        description={<>{pendingRevoke?.name} will lose admin access within 30 seconds, including any session they have open. This can't be undone; create a new key if they need access again.</>}
        confirmLabel="Revoke"
        tone="danger"
        busy={revoking}
        onConfirm={revoke}
        onCancel={() => { if (!revoking) setPendingRevoke(null); }}
      />
    </div>
  );
}
