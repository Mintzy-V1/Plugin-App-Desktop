import { useCallback, useEffect, useState } from 'react';
import { Copy, KeyRound, Plus } from 'lucide-react';
import { adminApi, type AdminKey } from '../../lib/adminApi';
import { pluginErrorMessage } from '../../lib/pluginErrors';
import { useToast } from '../../components/ui/Toast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { EmptyState, Spinner, formatDateTime, inputClass, primaryButtonClass, secondaryButtonClass } from './adminFormat';

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
    <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-5 py-4">
      <p className="text-[13px] font-semibold text-emerald-900">Key created for {name}</p>
      <p className="mt-0.5 text-[12px] text-emerald-800">
        Copy it now and share it with {name} securely. It won't be shown again; if it's lost, revoke it and create a new one.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 select-all break-all rounded-lg border border-emerald-200 bg-white px-3 py-2 font-mono text-[12px] text-slate-900">
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
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ name: string; key: string } | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<AdminKey | null>(null);
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(() => {
    adminApi.listKeys()
      .then((res) => setKeys(res.data.keys))
      .catch(() => toast.error('Could not load admin keys'));
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
      <form onSubmit={create} className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-sm">
        <div className="min-w-[180px] flex-1">
          <label htmlFor="key-name" className="block text-[11px] font-medium text-slate-500">Team member</label>
          <input id="key-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Name" className={`${inputClass} mt-1 w-full`} />
        </div>
        <div className="min-w-[200px] flex-1">
          <label htmlFor="key-email" className="block text-[11px] font-medium text-slate-500">Email (optional)</label>
          <input id="key-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className={`${inputClass} mt-1 w-full`} />
        </div>
        <button type="submit" disabled={creating} className={primaryButtonClass}>
          {creating ? <Spinner className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" aria-hidden="true" />} Create key
        </button>
      </form>

      {created && <NewKeyPanel name={created.name} keyValue={created.key} onDone={() => setCreated(null)} />}

      {!keys && <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400"><Spinner /> Loading keys…</div>}
      {keys && keys.length === 0 && <EmptyState title="No admin keys yet" body="Create one for each team member who needs admin access." />}

      {keys && keys.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-2.5 font-medium">Team member</th>
                <th className="px-3 py-2.5 font-medium">Key</th>
                <th className="px-3 py-2.5 font-medium">Created</th>
                <th className="px-3 py-2.5 font-medium">Last used</th>
                <th className="px-4 py-2.5 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {keys.map((k) => (
                <tr key={k._id} className={k.revokedAt ? 'text-slate-400' : ''}>
                  <td className="px-4 py-2.5">
                    <p className={`font-semibold ${k.revokedAt ? 'text-slate-500' : 'text-slate-900'}`}>{k.name}</p>
                    {k.email && <p className="text-[11px] text-slate-500">{k.email}</p>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-1.5 font-mono text-[12px] text-slate-600">
                      <KeyRound className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" /> mzadm_{k.keyPrefix}_…
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-slate-600">{formatDateTime(k.createdAt)}</td>
                  <td className="px-3 py-2.5 text-[12px] text-slate-600">
                    {k.lastUsedAt ? `${formatDateTime(k.lastUsedAt)}${k.lastUsedIp ? ` · ${k.lastUsedIp}` : ''}` : 'Never'}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {k.revokedAt ? (
                      <span className="text-[12px]">Revoked {formatDateTime(k.revokedAt)}</span>
                    ) : (
                      <button type="button" onClick={() => setPendingRevoke(k)}
                        className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[12px] font-semibold text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30">
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
