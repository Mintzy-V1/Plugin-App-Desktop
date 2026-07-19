import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Loader2 } from 'lucide-react';
import { pluginApi } from '../../lib/pluginApi';
import { createDefaultConfig, buildPayload } from '../../lib/pluginTradingConfig';
import type { SavedConfig } from '../../lib/pluginApi';
import TradingConfigurationFields from './TradingConfigurationFields';
import type { TradingConfigurationDraft } from '../../lib/pluginTradingConfig';

interface Props {
  sessionId: string | null;
  onUseConfig: (configId: string, payload: Record<string, unknown>) => void;
  onBack: () => void;
}

export default function SavedStrategiesView({ sessionId, onUseConfig, onBack }: Props) {
  const [configs, setConfigs] = useState<SavedConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<TradingConfigurationDraft>(createDefaultConfig());
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    pluginApi.getSavedConfigs().then(res => setConfigs(res.data.configurations || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await pluginApi.createSavedConfig(name.trim(), buildPayload(draft) as unknown as Record<string, unknown>);
      setName('');
      setDraft(createDefaultConfig());
      const res = await pluginApi.getSavedConfigs();
      setConfigs(res.data.configurations || []);
    } catch {} finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await pluginApi.deleteSavedConfig(id);
      setConfigs(prev => prev.filter(c => c._id !== id));
    } catch {}
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4">
      <button onClick={onBack} className="mb-4 flex items-center text-sm text-slate-400 transition-colors hover:text-slate-600">
        <ArrowLeft className="mr-1 h-4 w-4" /> Back
      </button>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Saved Strategies</h2>
          <p className="mt-1 text-sm text-slate-500">Quick-start from a saved configuration</p>
          <div className="mt-4 space-y-2">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
            ) : configs.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No saved strategies yet</p>
            ) : (
              configs.map(c => (
                <div key={c._id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                      {c.description && <p className="text-xs text-slate-500">{c.description}</p>}
                    </div>
                    <div className="flex gap-2">
                      {sessionId && (
                        <button onClick={() => onUseConfig(c._id, c.configuration as Record<string, unknown>)}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
                          Quick Start
                        </button>
                      )}
                      <button onClick={() => handleDelete(c._id)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">
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
            <input type="text" placeholder="Strategy name" value={name} onChange={e => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" />
            <TradingConfigurationFields config={draft} onChange={setDraft} />
            <button onClick={handleSave} disabled={saving || !name.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Save Strategy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
