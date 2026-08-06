import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Loader2, Settings2, Bookmark, XCircle } from 'lucide-react';
import { pluginApi } from '../../lib/pluginApi';
import type { SavedConfig } from '../../lib/pluginApi';
import {
  createDefaultConfig,
  validateConfig,
  buildPayload,
  draftFromConfiguration,
  alphasFromConfiguration,
} from '../../lib/pluginTradingConfig';
import type { AlphasInfo, TradingConfigurationDraft } from '../../lib/pluginTradingConfig';
import TradingConfigurationFields from './TradingConfigurationFields';
import ConfirmDialog from '../ui/ConfirmDialog';
import { pluginErrorMessage } from '../../lib/pluginErrors';

interface Props {
  sessionId: string;
  freeCash?: number | null;
  onSuccess: () => void;
  onAbandon: () => void;
  onBack: () => void;
}

function parseSavedList(data: unknown): SavedConfig[] {
  const d = data as Record<string, unknown> | unknown[] | null;
  if (!d) return [];
  if (Array.isArray(d)) return d as SavedConfig[];
  const list = (d as any).configurations || (d as any).savedConfigurations || (d as any).configs || (d as any).data;
  return Array.isArray(list) ? list : [];
}

export default function SessionConfigForm({ sessionId, freeCash, onSuccess, onAbandon, onBack }: Props) {
  const [config, setConfig] = useState<TradingConfigurationDraft>(createDefaultConfig());
  const [alphas, setAlphas] = useState<AlphasInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [abandoning, setAbandoning] = useState(false);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedConfigs, setSavedConfigs] = useState<SavedConfig[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [selectedSavedId, setSelectedSavedId] = useState('');

  useEffect(() => {
    setSavedLoading(true);
    pluginApi.getSavedConfigs()
      .then(res => setSavedConfigs(parseSavedList(res.data)))
      .catch(() => setSavedConfigs([]))
      .finally(() => setSavedLoading(false));
  }, []);

  const applySaved = (id: string) => {
    setSelectedSavedId(id);
    if (!id) {
      setConfig(createDefaultConfig());
      setAlphas(null);
      return;
    }
    const match = savedConfigs.find(c => (c._id || (c as any).id) === id);
    if (!match) return;
    const raw = match.configuration as Record<string, unknown>;
    setConfig(draftFromConfiguration(raw));
    setAlphas(alphasFromConfiguration(raw));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateConfig(config, { alphas });
    if (err) { setError(err); return; }
    const payload = buildPayload(config, alphas);
    if (payload.symbols.length === 0) {
      setError('Add at least one stock');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Always send the earlier body shape; include saved id when applicable.
      await pluginApi.startTrading({
        session_id: sessionId,
        ...(selectedSavedId ? { saved_configuration_id: selectedSavedId } : {}),
        ...payload,
      });
      onSuccess();
    } catch (err: any) {
      setError(pluginErrorMessage(err, 'Could not start trading. Please check your settings and try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleAbandon = async () => {
    setAbandoning(true);
    setError(null);
    try {
      await pluginApi.abandonSession(sessionId);
      setConfirmAbandon(false);
      onAbandon();
    } catch (err: any) {
      setConfirmAbandon(false);
      setError(pluginErrorMessage(err, 'Could not close this session. Please try again.'));
    } finally {
      setAbandoning(false);
    }
  };

  const validStocks = config.stocks.filter(s => s.symbol && Number(s.capital) > 0);
  const startPreview = buildPayload(config, alphas);
  const totalCapital = startPreview.symbols.reduce((sum, s) => sum + Number(s.capital), 0);
  const busy = loading || abandoning;

  return (
    <div className="mx-auto w-full max-w-lg">
      <button type="button" onClick={onBack} disabled={busy}
        className="mb-3 flex items-center rounded-lg text-sm text-slate-400 transition-colors hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-50">
        <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" /> Back
      </button>

      <div className="form-card">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <Settings2 className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Configure Session</h2>
          <p className="mt-1 text-sm text-slate-500">Set your trading parameters</p>
          {freeCash != null && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Broker free cash:{' '}
              {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(freeCash)}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="saved-strategy" className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <Bookmark className="h-3 w-3" aria-hidden="true" />
              Saved strategy
            </label>
            <select
              id="saved-strategy"
              value={selectedSavedId}
              disabled={savedLoading || busy}
              onChange={e => applySaved(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:opacity-60"
            >
              <option value="">
                {savedLoading ? 'Loading strategies…' : savedConfigs.length === 0 ? 'No saved strategies' : 'Configure manually'}
              </option>
              {savedConfigs.map((c) => {
                const id = c._id || (c as any).id;
                return (
                  <option key={id} value={id}>{c.name}</option>
                );
              })}
            </select>
            {!savedLoading && savedConfigs.length > 0 && (
              <p className="text-[11px] text-slate-400">
                Pick a saved strategy to fill the form, then start — or edit the fields below first.
              </p>
            )}
          </div>

          <TradingConfigurationFields
            config={config}
            alphas={alphas}
            onChange={(next) => {
              setConfig(next);
              // Manual edits drop the saved-id path so we send the edited payload only.
              if (selectedSavedId) {
                setSelectedSavedId('');
                setAlphas(null);
              }
            }}
          />

          {error && (
            <div role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-600">{error}</div>
          )}

          {startPreview.symbols.length > 0 && (
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-center text-xs text-slate-500">
              Starting <span className="font-semibold text-slate-700">{startPreview.symbols.length} symbol{startPreview.symbols.length > 1 ? 's' : ''}</span>
              {alphas && alphas.symbols.length > 0 ? (
                <> ({validStocks.length} manual + {alphas.symbols.length} auto)</>
              ) : null}
              {' '}with a total allocation of{' '}
              <span className="font-semibold text-slate-700">
                {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(totalCapital)}
              </span>{' '}on the {config.candle} candle
            </div>
          )}

          <button type="submit" disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? <><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Starting…</> : <>Start Trading <ArrowRight className="h-5 w-5" aria-hidden="true" /></>}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmAbandon(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <XCircle className="h-4 w-4" aria-hidden="true" />
            Abandon session
          </button>
        </form>
      </div>

      <ConfirmDialog
        open={confirmAbandon}
        title="Abandon this session?"
        description="This closes the session without starting trading. You can start a new session anytime."
        confirmLabel="Abandon session"
        tone="danger"
        busy={abandoning}
        onConfirm={handleAbandon}
        onCancel={() => { if (!abandoning) setConfirmAbandon(false); }}
      />
    </div>
  );
}
