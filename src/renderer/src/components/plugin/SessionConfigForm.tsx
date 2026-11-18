import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Loader2, Settings2, Bookmark, XCircle } from 'lucide-react';
import { pluginApi, supportsLeverageMultiplier } from '../../lib/pluginApi';
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
import { clampLeverage } from './LeverageMultiplierControl';
import ConfirmDialog from '../ui/ConfirmDialog';
import { pluginErrorMessage } from '../../lib/pluginErrors';
import { isBeforeSimulationStart } from '../../lib/istClock';

interface Props {
  sessionId: string;
  freeCash?: number | null;
  onSuccess: (result?: { scheduled?: boolean }) => void;
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

function savedId(c: SavedConfig): string {
  return String(c._id || (c as any).id || '');
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
  /** Kept when fields are edited so leverage can still target the chosen strategy. */
  const [leverageConfigId, setLeverageConfigId] = useState('');
  const [leverageValue, setLeverageValue] = useState(1);
  const [appliedLeverage, setAppliedLeverage] = useState<number | null>(null);
  const showLeverage = supportsLeverageMultiplier();

  useEffect(() => {
    setSavedLoading(true);
    pluginApi.getSavedConfigs()
      .then(res => setSavedConfigs(parseSavedList(res.data)))
      .catch(() => setSavedConfigs([]))
      .finally(() => setSavedLoading(false));
  }, []);

  const hydrateLeverage = (match: SavedConfig | undefined) => {
    if (!match || match.leverage_multiplier == null) {
      setLeverageValue(1);
      setAppliedLeverage(null);
      return;
    }
    const lev = clampLeverage(match.leverage_multiplier);
    setLeverageValue(lev);
    setAppliedLeverage(lev);
  };

  const applySaved = (id: string) => {
    setSelectedSavedId(id);
    setLeverageConfigId(id);
    if (!id) {
      setConfig(createDefaultConfig());
      setAlphas(null);
      hydrateLeverage(undefined);
      return;
    }
    const match = savedConfigs.find(c => savedId(c) === id);
    if (!match) return;
    const raw = match.configuration as Record<string, unknown>;
    setConfig(draftFromConfiguration(raw));
    setAlphas(alphasFromConfiguration(raw));
    hydrateLeverage(match);
    setError(null);
  };

  const handleSetLeverage = async (value: number) => {
    if (!leverageConfigId) {
      throw new Error('Select a saved strategy to set leverage.');
    }
    try {
      const res = await pluginApi.setSavedConfigLeverage(leverageConfigId, value);
      const updated = res.data?.configuration;
      const next = clampLeverage(updated?.leverage_multiplier ?? value);
      setAppliedLeverage(next);
      setLeverageValue(next);
      setSavedConfigs(prev => prev.map(c => (
        savedId(c) === leverageConfigId
          ? { ...c, ...updated, leverage_multiplier: next }
          : c
      )));
    } catch (err: any) {
      throw new Error(pluginErrorMessage(err, 'Could not update leverage. Please try again.'));
    }
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
    const startPayload = {
      session_id: sessionId,
      ...(selectedSavedId ? { saved_configuration_id: selectedSavedId } : {}),
      ...payload,
    };
    try {
      const res = await pluginApi.startTrading(startPayload);
      const scheduled = !!(res.data as { scheduled?: boolean } | undefined)?.scheduled;
      onSuccess({ scheduled });
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
        className="mb-3 flex items-center rounded-lg text-sm text-muted transition-colors hover:text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-50">
        <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" /> Back
      </button>

      <div className="form-card">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-info-soft text-info">
            <Settings2 className="h-6 w-6" />
          </div>
          <h2 className="font-serif text-3xl text-ink">Configure Session</h2>
          <p className="mt-1 text-sm text-muted">Set your trading parameters</p>
          {freeCash != null && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gain-soft px-3 py-1 text-xs font-semibold text-gain">
              Broker free cash:{' '}
              {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(freeCash)}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="saved-strategy" className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <Bookmark className="h-3 w-3" aria-hidden="true" />
              Saved strategy
            </label>
            <select
              id="saved-strategy"
              value={selectedSavedId}
              disabled={savedLoading || busy}
              onChange={e => applySaved(e.target.value)}
              className="w-full rounded-xl border border-line bg-subtle px-3 py-2.5 text-sm font-medium text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 disabled:opacity-60"
            >
              <option value="">
                {savedLoading ? 'Loading strategies…' : savedConfigs.length === 0 ? 'No saved strategies' : 'Configure manually'}
              </option>
              {savedConfigs.map((c) => {
                const id = savedId(c);
                const lev = c.leverage_multiplier != null ? clampLeverage(c.leverage_multiplier) : null;
                return (
                  <option key={id} value={id}>
                    {c.name}{lev != null ? ` · ${lev}×` : ''}
                  </option>
                );
              })}
            </select>
            {!savedLoading && savedConfigs.length > 0 && (
              <p className="text-[11px] text-muted">
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
            leverage={showLeverage ? {
              configurationId: leverageConfigId || null,
              appliedValue: appliedLeverage,
              value: leverageValue,
              onChange: setLeverageValue,
              onApply: handleSetLeverage,
              disabled: busy,
              unavailableHint: savedConfigs.length === 0
                ? 'Save a strategy first (Saved Strategies), then set leverage here before starting.'
                : 'Select a saved strategy above to attach leverage — works with pre-saved and before you start.',
            } : null}
          />

          {error && (
            <div role="alert" className="rounded-xl border border-loss/25 bg-loss-soft px-4 py-3 text-center text-sm font-medium text-loss">{error}</div>
          )}

          {isBeforeSimulationStart() && (
            <div className="rounded-xl border border-attention/25 bg-attention-soft px-4 py-3 text-center text-xs text-attention">
              Before 10:30 AM IST the engine is held. Start now and trading will auto-start at 10:30 AM.
            </div>
          )}

          {startPreview.symbols.length > 0 && (
            <div className="rounded-xl bg-subtle px-4 py-3 text-center text-xs text-muted">
              Starting <span className="font-semibold text-secondary">{startPreview.symbols.length} symbol{startPreview.symbols.length > 1 ? 's' : ''}</span>
              {alphas && alphas.symbols.length > 0 ? (
                <> ({validStocks.length} manual + {alphas.symbols.length} auto)</>
              ) : null}
              {' '}with a total allocation of{' '}
              <span className="font-semibold text-secondary">
                {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(totalCapital)}
              </span>{' '}on the {config.candle} candle
              {showLeverage && appliedLeverage != null && leverageConfigId ? (
                <> · leverage <span className="font-semibold text-secondary">{appliedLeverage}×</span></>
              ) : null}
            </div>
          )}

          <div className="sticky bottom-0 z-10 space-y-2 border-t border-line bg-surface pb-1 pt-4">
          <button type="submit" disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-on-primary shadow-lg shadow-overlay/10 transition-all hover:bg-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? <><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Starting…</> : isBeforeSimulationStart() ? <>Schedule 10:30 AM start <ArrowRight className="h-5 w-5" aria-hidden="true" /></> : <>Start Trading <ArrowRight className="h-5 w-5" aria-hidden="true" /></>}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmAbandon(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-secondary transition-colors hover:border-loss/25 hover:bg-loss-soft hover:text-loss focus:outline-none focus-visible:ring-2 focus-visible:ring-loss/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <XCircle className="h-4 w-4" aria-hidden="true" />
            Abandon session
          </button>
          </div>
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
