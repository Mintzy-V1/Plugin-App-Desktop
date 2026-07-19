import { useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2, Settings2 } from 'lucide-react';
import { pluginApi } from '../../lib/pluginApi';
import { createDefaultConfig, validateConfig, buildPayload } from '../../lib/pluginTradingConfig';
import type { TradingConfigurationDraft } from '../../lib/pluginTradingConfig';
import TradingConfigurationFields from './TradingConfigurationFields';

interface Props {
  sessionId: string;
  onSuccess: () => void;
  onBack: () => void;
}

export default function SessionConfigForm({ sessionId, onSuccess, onBack }: Props) {
  const [config, setConfig] = useState<TradingConfigurationDraft>(createDefaultConfig());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateConfig(config);
    if (err) { setError(err); return; }
    setLoading(true);
    setError(null);
    try {
      await pluginApi.startTrading({ session_id: sessionId, ...buildPayload(config) });
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to start trading');
    } finally {
      setLoading(false);
    }
  };

  const validStocks = config.stocks.filter(s => s.symbol && Number(s.capital) > 0);
  const totalCapital = validStocks.reduce((sum, s) => sum + Number(s.capital), 0);

  return (
    <div className="mx-auto w-full max-w-lg px-4">
      <button onClick={onBack}
        className="mb-4 flex items-center rounded-lg text-sm text-slate-400 transition-colors hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40">
        <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" /> Back
      </button>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8">
        <div className="mb-6 text-center sm:mb-8">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-violet-600 sm:mb-4 sm:h-14 sm:w-14">
            <Settings2 className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Configure Session</h2>
          <p className="mt-1 text-sm text-slate-500">Set your trading parameters</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <TradingConfigurationFields config={config} onChange={setConfig} />

          {error && (
            <div role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-600">{error}</div>
          )}

          {validStocks.length > 0 && (
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-center text-xs text-slate-500">
              Starting <span className="font-semibold text-slate-700">{validStocks.length} symbol{validStocks.length > 1 ? 's' : ''}</span> with a total allocation of{' '}
              <span className="font-semibold text-slate-700">
                {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(totalCapital)}
              </span>{' '}on the {config.candle} candle
            </div>
          )}

          <button type="submit" disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? <><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Starting…</> : <>Start Trading <ArrowRight className="h-5 w-5" aria-hidden="true" /></>}
          </button>
        </form>
      </div>
    </div>
  );
}
