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
  const updateStock = (index: number, patch: Partial<TradingStockDraft>) => {
    const stocks = config.stocks.map((s, i) => i === index ? { ...s, ...patch } : s);
    onChange({ ...config, stocks });
  };

  const addStock = () => onChange({ ...config, stocks: [...config.stocks, { symbol: '', capital: '', stop_loss: 5 }] });
  const removeStock = (index: number) => onChange({ ...config, stocks: config.stocks.filter((_, i) => i !== index) });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Candle Interval</label>
          <select value={config.candle} onChange={e => onChange({ ...config, candle: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15">
            {CANDLE_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Strategy</label>
          <select value={config.strategy} onChange={e => onChange({ ...config, strategy: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15">
            {STRATEGY_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <input type="checkbox" checked={config.useBrokerCash} onChange={e => onChange({ ...config, useBrokerCash: e.target.checked })}
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
        <span className="text-sm font-medium text-slate-700">Use available broker cash</span>
      </label>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Stock Allocation</label>
          <button type="button" onClick={addStock}
            className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
        {config.stocks.map((stock, i) => (
          <div key={i} className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex-1 space-y-2">
              <TickerSelector value={stock.symbol} onChange={s => updateStock(i, { symbol: s })} />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" placeholder="Capital" value={stock.capital}
                  onChange={e => updateStock(i, { capital: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" />
                <div className="relative">
                  <input type="number" placeholder="SL %" value={stock.stop_loss}
                    onChange={e => updateStock(i, { stop_loss: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                </div>
              </div>
            </div>
            {config.stocks.length > 1 && (
              <button type="button" onClick={() => removeStock(i)}
                className="mt-1 shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
