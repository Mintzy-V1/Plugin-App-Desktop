import { useId } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import TickerSelector from './TickerSelector';
import type { TradingConfigurationDraft, TradingStockDraft } from '../../lib/pluginTradingConfig';

interface Props {
  config: TradingConfigurationDraft;
  onChange: (config: TradingConfigurationDraft) => void;
}

const CANDLE_OPTIONS = ['1m', '5m', '15m'];
const STRATEGY_OPTIONS = [
  { value: 'A', label: 'Stoppage Reversal' },
  { value: 'B', label: 'Exposure Expansion' },
];

export default function TradingConfigurationFields({ config, onChange }: Props) {
  const uid = useId();
  const updateStock = (index: number, patch: Partial<TradingStockDraft>) => {
    const stocks = config.stocks.map((s, i) => i === index ? { ...s, ...patch } : s);
    onChange({ ...config, stocks });
  };

  const addStock = () => onChange({ ...config, stocks: [...config.stocks, { symbol: '', capital: '', stop_loss: 5 }] });
  const removeStock = (index: number) => onChange({ ...config, stocks: config.stocks.filter((_, i) => i !== index) });

  const selectedSymbols = config.stocks.map(s => s.symbol).filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor={`${uid}-candle`} className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Candle Interval</label>
          <select id={`${uid}-candle`} value={config.candle} onChange={e => onChange({ ...config, candle: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15">
            {CANDLE_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${uid}-strategy`} className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Strategy</label>
          <select id={`${uid}-strategy`} value={config.strategy} onChange={e => onChange({ ...config, strategy: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15">
            {STRATEGY_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <input type="checkbox" checked={config.useBrokerCash} onChange={e => onChange({ ...config, useBrokerCash: e.target.checked })}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
        <span>
          <span className="block text-sm font-medium text-slate-700">Use available broker cash</span>
          <span className="mt-0.5 block text-[11px] text-slate-500">Trades draw from your broker balance; per-stock capital below caps each symbol's allocation.</span>
        </span>
      </label>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Stock Allocation</span>
          <button type="button" onClick={addStock}
            className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40">
            <Plus className="h-3 w-3" aria-hidden="true" /> Add
          </button>
        </div>
        {config.stocks.map((stock, i) => (
          <div key={i} className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex-1 space-y-2">
              <TickerSelector value={stock.symbol} onChange={s => updateStock(i, { symbol: s })}
                excludeSymbols={selectedSymbols.filter(sym => sym !== stock.symbol)} />
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" aria-hidden="true">₹</span>
                  <input type="number" placeholder="Capital" value={stock.capital} min={1} step="any"
                    aria-label={`Capital for ${stock.symbol || `stock ${i + 1}`} in rupees`}
                    onChange={e => updateStock(i, { capital: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-7 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" />
                </div>
                <div className="relative">
                  <input type="number" placeholder="Stop loss" value={stock.stop_loss} min={0.1} max={100} step="any"
                    aria-label={`Stop loss percentage for ${stock.symbol || `stock ${i + 1}`}`}
                    onChange={e => updateStock(i, { stop_loss: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-3 pr-8 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" aria-hidden="true">%</span>
                </div>
              </div>
            </div>
            {config.stocks.length > 1 && (
              <button type="button" onClick={() => removeStock(i)}
                aria-label={`Remove ${stock.symbol || `stock ${i + 1}`} from allocation`}
                className="mt-1 shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
