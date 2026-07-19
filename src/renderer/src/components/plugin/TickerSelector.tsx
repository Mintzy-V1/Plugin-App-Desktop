import { useState, useRef, useEffect, useDeferredValue, useId } from 'react';
import { Search, Check } from 'lucide-react';
import { PLUGIN_TICKERS } from '../../lib/pluginTradingConfig';

interface Props {
  value: string;
  onChange: (symbol: string) => void;
  /** Symbols already picked in other rows, hidden from this list to prevent duplicates. */
  excludeSymbols?: string[];
}

export default function TickerSelector({ value, onChange, excludeSymbols = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const available = PLUGIN_TICKERS.filter(t => !excludeSymbols.includes(t));
  const filtered = deferredQuery
    ? available.filter(t => t.toLowerCase().includes(deferredQuery.toLowerCase()))
    : available;

  useEffect(() => { setHighlighted(0); }, [deferredQuery, open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[highlighted] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlighted, open]);

  const select = (symbol: string) => {
    onChange(symbol);
    setOpen(false);
  };

  const onSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[highlighted]) select(filtered[highlighted]); }
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => { setOpen(!open); setQuery(''); }}
        role="combobox" aria-expanded={open} aria-controls={listboxId} aria-haspopup="listbox"
        aria-label={value ? `Symbol: ${value}` : 'Select symbol'}
        className={`flex w-full items-center justify-between rounded-xl border bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
          open ? 'border-blue-500 ring-2 ring-blue-500/15' : 'border-slate-200 hover:border-slate-300'
        } ${value ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
        {value || 'Select symbol'}
        <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
      </button>

      {open && (
        <div className="animate-scale-in absolute left-0 right-0 top-[calc(100%+4px)] z-30 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_40px_rgba(15,23,42,0.16)]">
          <div className="border-b border-slate-100 p-2">
            <input type="text" placeholder="Search symbols..." value={query} autoFocus
              aria-label="Search symbols" onKeyDown={onSearchKeyDown}
              onChange={e => setQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" />
          </div>
          <div ref={listRef} id={listboxId} role="listbox" className="max-h-48 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-slate-400">No symbols match "{query}"</p>
            ) : filtered.map((t, i) => (
              <button key={t} type="button" role="option" aria-selected={t === value}
                onClick={() => select(t)} onMouseEnter={() => setHighlighted(i)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                  t === value ? 'bg-blue-50 font-semibold text-blue-700'
                    : i === highlighted ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-700'
                }`}>
                <span>{t}</span>
                {t === value && <Check className="h-4 w-4 text-blue-600" aria-hidden="true" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
