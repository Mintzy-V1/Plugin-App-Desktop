import { useState, useRef, useEffect, useDeferredValue } from 'react';
import { Search, Check } from 'lucide-react';
import { PLUGIN_TICKERS } from '../../lib/pluginTradingConfig';

interface Props {
  value: string;
  onChange: (symbol: string) => void;
}

export default function TickerSelector({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (('key' in e && e.key === 'Escape') || ('target' in e && ref.current && !ref.current.contains(e.target as Node)))
        setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, []);

  const filtered = deferredQuery
    ? PLUGIN_TICKERS.filter(t => t.toLowerCase().includes(deferredQuery.toLowerCase()))
    : PLUGIN_TICKERS;

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => { setOpen(!open); setQuery(''); }}
        className={`flex w-full items-center justify-between rounded-xl border bg-slate-50 px-3 py-2.5 text-sm outline-none transition ${
          open ? 'border-blue-500 ring-2 ring-blue-500/15' : 'border-slate-200 hover:border-slate-300'
        } ${value ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
        {value || 'Select symbol'}
        <Search className="h-4 w-4 text-slate-400" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_40px_rgba(15,23,42,0.16)]">
          <div className="border-b border-slate-100 p-2">
            <input type="text" placeholder="Search symbols..." value={query} autoFocus
              onChange={e => setQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" />
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {filtered.map(t => (
              <button key={t} type="button" onClick={() => { onChange(t); setOpen(false); }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                  t === value ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                }`}>
                <span>{t}</span>
                {t === value && <Check className="h-4 w-4 text-blue-600" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
