import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Plus, Loader2, Bookmark, PencilLine, Save, Trash2 } from 'lucide-react';
import { pluginApi } from '../../lib/pluginApi';
import type { SavedConfig } from '../../lib/pluginApi';
import {
  createDefaultConfig,
  buildPayload,
  validateConfig,
  draftFromConfiguration,
  summarizeConfiguration,
} from '../../lib/pluginTradingConfig';
import type { TradingConfigurationDraft } from '../../lib/pluginTradingConfig';
import TradingConfigurationFields from './TradingConfigurationFields';
import { useToast } from '../ui/Toast';
import ConfirmDialog from '../ui/ConfirmDialog';
import { pluginErrorMessage } from '../../lib/pluginErrors';

interface Props {
  sessionId: string | null;
  onUseConfig: (configId: string, payload: Record<string, unknown>) => void;
  onBack: () => void;
  quickStarting?: boolean;
}

type EditorMode = 'idle' | 'create' | 'edit';

function parseSavedList(data: unknown): SavedConfig[] {
  const d = data as Record<string, unknown> | unknown[] | null;
  if (!d) return [];
  if (Array.isArray(d)) return d as SavedConfig[];
  const list = (d as any).configurations || (d as any).savedConfigurations || (d as any).configs || (d as any).data;
  return Array.isArray(list) ? list : [];
}

function configId(c: SavedConfig | Record<string, unknown>): string {
  return String((c as any)._id || (c as any).id || '');
}

export default function SavedStrategiesView({ sessionId, onUseConfig, onBack, quickStarting }: Props) {
  const toast = useToast();
  const [configs, setConfigs] = useState<SavedConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [editorMode, setEditorMode] = useState<EditorMode>('idle');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TradingConfigurationDraft>(createDefaultConfig());
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<SavedConfig | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchConfigs = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await pluginApi.getSavedConfigs();
      setConfigs(parseSavedList(res.data));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchConfigs(); }, []);

  const editingConfig = useMemo(
    () => configs.find(c => configId(c) === editingId) ?? null,
    [configs, editingId],
  );

  const resetEditor = () => {
    setEditorMode('idle');
    setEditingId(null);
    setName('');
    setDescription('');
    setDraft(createDefaultConfig());
    setSaveError(null);
  };

  const handleCreate = () => {
    setEditorMode('create');
    setEditingId(null);
    setName('');
    setDescription('');
    setDraft(createDefaultConfig());
    setSaveError(null);
  };

  const handleEdit = (configuration: SavedConfig) => {
    const id = configId(configuration);
    setEditorMode('edit');
    setEditingId(id);
    setName(configuration.name || '');
    setDescription(configuration.description || '');
    setDraft(draftFromConfiguration(configuration.configuration));
    setSaveError(null);
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setSaveError('Strategy name is required');
      return;
    }
    const err = validateConfig(draft);
    if (err) { setSaveError(err); return; }

    setSaveError(null);
    setSaving(true);
    const payload = {
      name: trimmedName,
      description: description.trim(),
      configuration: buildPayload(draft) as unknown as Record<string, unknown>,
    };

    try {
      if (editorMode === 'edit' && editingId) {
        await pluginApi.updateSavedConfig(editingId, payload);
        toast.success('Strategy updated');
      } else {
        await pluginApi.createSavedConfig(payload.name, payload.configuration, payload.description);
        toast.success('Strategy saved');
      }
      await fetchConfigs();
      resetEditor();
    } catch (e: any) {
      setSaveError(pluginErrorMessage(e, 'Could not save the strategy. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const id = configId(pendingDelete);
    setDeleting(true);
    try {
      await pluginApi.deleteSavedConfig(id);
      setConfigs(prev => prev.filter(c => configId(c) !== id));
      toast.success(`Deleted "${pendingDelete.name}"`);
      if (editingId === id) resetEditor();
    } catch {
      toast.error('Could not delete the strategy. Please try again.');
    }
    setDeleting(false);
    setPendingDelete(null);
  };

  const editorTitle =
    editorMode === 'edit' && editingConfig ? editingConfig.name
      : editorMode === 'create' ? 'New strategy'
        : 'Strategy details';

  return (
    <div className="mx-auto w-full max-w-4xl">
      <button type="button" onClick={onBack}
        className="mb-3 flex items-center rounded-lg text-sm text-slate-400 transition-colors hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40">
        <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" /> Back
      </button>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Saved Strategies</h2>
          <p className="mt-1 text-sm text-slate-500">View, edit, or create reusable trading setups</p>
        </div>
        <button type="button" onClick={handleCreate}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> New strategy
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          {loading ? (
            <div className="space-y-2" aria-busy="true" aria-label="Loading saved strategies">
              {[0, 1, 2].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center">
              <p className="text-sm text-slate-500">Couldn't load saved strategies.</p>
              <button type="button" onClick={() => void fetchConfigs()}
                className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30">
                Retry
              </button>
            </div>
          ) : configs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center">
              <Bookmark className="mx-auto h-6 w-6 text-slate-300" aria-hidden="true" />
              <p className="mt-2 text-sm font-medium text-slate-500">No saved strategies yet</p>
              <p className="mt-1 text-xs text-slate-400">Create one to reuse it for future sessions.</p>
              <button type="button" onClick={handleCreate}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800">
                <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Create first strategy
              </button>
            </div>
          ) : (
            configs.map((c) => {
              const id = configId(c);
              const summary = summarizeConfiguration(c.configuration);
              const isActive = editingId === id && editorMode === 'edit';
              return (
                <article
                  key={id || c.name}
                  className={`rounded-xl border p-3.5 transition-shadow ${
                    isActive
                      ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                      : 'border-slate-200 bg-white hover:shadow-sm'
                  }`}
                >
                  <div className="min-w-0">
                    <p className={`truncate text-sm font-semibold ${isActive ? 'text-white' : 'text-slate-900'}`}>{c.name}</p>
                    <p className={`mt-0.5 line-clamp-2 text-xs ${isActive ? 'text-slate-300' : 'text-slate-500'}`}>
                      {c.description || 'No description'}
                    </p>
                    <div className={`mt-2.5 flex flex-wrap gap-1.5 text-[11px] font-semibold ${isActive ? 'text-slate-200' : 'text-slate-600'}`}>
                      <span className={`rounded-md px-2 py-0.5 ${isActive ? 'bg-white/10' : 'bg-slate-100'}`}>
                        {summary.symbolCount} symbol{summary.symbolCount === 1 ? '' : 's'}
                      </span>
                      <span className={`rounded-md px-2 py-0.5 ${isActive ? 'bg-white/10' : 'bg-slate-100'}`}>
                        {summary.strategyLabel}
                      </span>
                      <span className={`rounded-md px-2 py-0.5 ${isActive ? 'bg-white/10' : 'bg-slate-100'}`}>
                        {summary.candle}
                      </span>
                      {summary.symbols.length > 0 && (
                        <span className={`rounded-md px-2 py-0.5 ${isActive ? 'bg-white/10' : 'bg-slate-100'}`}>
                          {summary.symbols.slice(0, 4).join(', ')}
                          {summary.symbols.length > 4 ? ` +${summary.symbols.length - 4}` : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => handleEdit(c)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
                        isActive
                          ? 'border border-white/20 bg-white/10 text-white hover:bg-white/15'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}>
                      <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
                      {isActive ? 'Editing' : 'View / Edit'}
                    </button>
                    {sessionId && (
                      <button type="button"
                        onClick={() => onUseConfig(id, c.configuration as Record<string, unknown>)}
                        disabled={quickStarting}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-50 ${
                          isActive
                            ? 'bg-white text-slate-900 hover:bg-slate-100'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}>
                        {quickStarting && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
                        Quick Start
                      </button>
                    )}
                    <button type="button" onClick={() => setPendingDelete(c)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 ${
                        isActive
                          ? 'border border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20'
                          : 'border border-slate-200 text-red-600 hover:bg-red-50'
                      }`}>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Delete
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {editorMode === 'edit' ? 'Edit strategy' : editorMode === 'create' ? 'New strategy' : 'Editor'}
              </p>
              <h3 className="mt-0.5 truncate text-base font-bold text-slate-900">{editorTitle}</h3>
              <p className="mt-1 text-xs text-slate-500">
                {editorMode === 'idle'
                  ? 'Select a saved strategy to view and edit it, or create a new one.'
                  : 'Same trading fields used when starting a live session.'}
              </p>
            </div>
            {editorMode !== 'idle' && (
              <button type="button" onClick={resetEditor}
                className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50">
                Cancel
              </button>
            )}
          </div>

          {editorMode === 'idle' ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-12 text-center">
              <Save className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
              <p className="mx-auto mt-3 max-w-xs text-sm text-slate-500">
                Open a saved strategy to view its symbols and risk settings, or create a new setup.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label htmlFor="strategy-name" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Strategy name
                </label>
                <input id="strategy-name" type="text" placeholder="e.g. Morning momentum"
                  value={name} onChange={e => setName(e.target.value)} disabled={saving}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:opacity-60" />
              </div>
              <div>
                <label htmlFor="strategy-description" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Description
                </label>
                <textarea id="strategy-description" rows={2} placeholder="Optional notes"
                  value={description} onChange={e => setDescription(e.target.value)} disabled={saving}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:opacity-60" />
              </div>

              <TradingConfigurationFields config={draft} onChange={setDraft} />

              {saveError && (
                <div role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-600">
                  {saveError}
                </div>
              )}

              <button type="button" onClick={() => void handleSave()} disabled={saving || !name.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
                {editorMode === 'edit' ? 'Update strategy' : 'Save strategy'}
              </button>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog open={!!pendingDelete} title="Delete strategy?"
        description={<>"{pendingDelete?.name}" will be permanently removed. This cannot be undone.</>}
        confirmLabel="Delete" tone="danger" busy={deleting}
        onConfirm={confirmDelete} onCancel={() => { if (!deleting) setPendingDelete(null); }} />
    </div>
  );
}
