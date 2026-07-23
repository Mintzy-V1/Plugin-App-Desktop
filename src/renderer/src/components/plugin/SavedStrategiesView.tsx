import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Loader2, Bookmark } from 'lucide-react';
import { pluginApi } from '../../lib/pluginApi';
import { createDefaultConfig, buildPayload, validateConfig } from '../../lib/pluginTradingConfig';
import type { SavedConfig } from '../../lib/pluginApi';
import TradingConfigurationFields from './TradingConfigurationFields';
import type { TradingConfigurationDraft } from '../../lib/pluginTradingConfig';
import { useToast } from '../ui/Toast';
import ConfirmDialog from '../ui/ConfirmDialog';

interface Props {
  sessionId: string | null;
  onUseConfig: (configId: string, payload: Record<string, unknown>) => void;
  onBack: () => void;
  quickStarting?: boolean;
}

export default function SavedStrategiesView({ sessionId, onUseConfig, onBack, quickStarting }: Props) {
  const toast = useToast();
  const [configs, setConfigs] = useState<SavedConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState<TradingConfigurationDraft>(createDefaultConfig());
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SavedConfig | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchConfigs = () => {
    setLoading(true);
    setLoadError(false);
    pluginApi.getSavedConfigs()
      .then(res => {
        const d = res.data as any;
        const list = d.configurations || d.savedConfigurations || d.configs || d.data || (Array.isArray(d) ? d : []);
        setConfigs(list);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchConfigs(); }, []);

  const handleSave = async () => {
    if (!name.trim()) return;
    const err = validateConfig(draft);
    if (err) { setSaveError(err); return; }
    setSaveError(null);
    setSaving(true);
    try {
      await pluginApi.createSavedConfig(name.trim(), buildPayload(draft) as unknown as Record<string, unknown>);
      setName('');
      setDraft(createDefaultConfig());
      toast.success('Strategy saved');
      const res = await pluginApi.getSavedConfigs();
      const d = res.data as any;
      setConfigs(d.configurations || d.savedConfigurations || d.configs || d.data || (Array.isArray(d) ? d : []));
    } catch {
      toast.error('Could not save the strategy. Please try again.');
    } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await pluginApi.deleteSavedConfig(pendingDelete._id);
      setConfigs(prev => prev.filter(c => c._id !== pendingDelete._id));
      toast.success(`Deleted "${pendingDelete.name}"`);
    } catch {
      toast.error('Could not delete the strategy. Please try again.');
    }
    setDeleting(false);
    setPendingDelete(null);
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4">
      <button onClick={onBack}
        className="mb-4 flex items-center rounded-lg text-sm text-slate-400 transition-colors hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40">
        <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" /> Back
      </button>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Saved Strategies</h2>
          <p className="mt-1 text-sm text-slate-500">Quick-start from a saved configuration</p>
          <div className="mt-4 space-y-2">
            {loading ? (
              <div className="space-y-2" aria-busy="true" aria-label="Loading saved strategies">
                {[0, 1, 2].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}
              </div>
            ) : loadError ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
                <p className="text-sm text-slate-500">Couldn't load saved strategies.</p>
                <button onClick={fetchConfigs}
                  className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30">
                  Retry
                </button>
              </div>
            ) : configs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
                <Bookmark className="mx-auto h-6 w-6 text-slate-300" aria-hidden="true" />
                <p className="mt-2 text-sm font-medium text-slate-500">No saved strategies yet</p>
                <p className="mt-1 text-xs text-slate-400">Build one on the right to reuse it for future sessions.</p>
              </div>
            ) : (
              configs.map((c: any) => (
                <div key={c._id || c.id} className="rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{c.name}</p>
                      {c.description && <p className="truncate text-xs text-slate-500">{c.description}</p>}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {sessionId && (
                        <button onClick={() => onUseConfig(c._id || c.id, c.configuration as Record<string, unknown>)}
                          disabled={quickStarting}
                          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-50">
                          {quickStarting && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
                          Quick Start
                        </button>
                      )}
                      <button onClick={() => setPendingDelete(c)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900">Save New</h2>
          <p className="mt-1 text-sm text-slate-500">Create a reusable configuration</p>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="strategy-name" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Strategy name</label>
              <input id="strategy-name" type="text" placeholder="e.g. Morning momentum" value={name} onChange={e => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" />
            </div>
            <TradingConfigurationFields config={draft} onChange={setDraft} />
            {saveError && (
              <div role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-600">{saveError}</div>
            )}
            <button onClick={handleSave} disabled={saving || !name.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
              Save Strategy
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog open={!!pendingDelete} title="Delete strategy?"
        description={<>"{pendingDelete?.name}" will be permanently removed. This cannot be undone.</>}
        confirmLabel="Delete" tone="danger" busy={deleting}
        onConfirm={confirmDelete} onCancel={() => { if (!deleting) setPendingDelete(null); }} />
    </div>
  );
}
