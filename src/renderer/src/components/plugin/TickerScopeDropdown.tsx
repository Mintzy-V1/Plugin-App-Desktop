import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';

export interface TickerScopeOption {
  symbol: string;
  pnl: number;
  phase?: 'live' | 'simulation';
}

interface Props {
  tickers: TickerScopeOption[];
  /** `null` means every ticker is included (combined P&amp;L). */
  selected: string[] | null;
  onChange: (next: string[] | null) => void;
}

export function formatTickerScopeLabel(selected: string[] | null, tickerCount: number): string {
  if (selected == null || selected.length === 0 || selected.length === tickerCount) {
    return tickerCount > 0 ? 'All tickers' : 'Tickers';
  }
  if (selected.length === 1) return selected[0];
  if (selected.length === 2) return `${selected[0]} + ${selected[1]}`;
  return `${selected[0]} + ${selected.length - 1} more`;
}

export default function TickerScopeDropdown({ tickers, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const isAll = selected == null || (tickers.length > 0 && selected.length === tickers.length);
  const selectedSet = useMemo(() => new Set(isAll ? tickers.map((t) => t.symbol) : (selected ?? [])), [isAll, selected, tickers]);
  const label = formatTickerScopeLabel(isAll ? null : selected, tickers.length);
  const showSearch = tickers.length > 6;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tickers;
    return tickers.filter((t) => t.symbol.toLowerCase().includes(q));
  }, [tickers, query]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const setAll = () => onChange(null);

  const toggle = (symbol: string) => {
    if (isAll) {
      onChange([symbol]);
      return;
    }
    const next = selectedSet.has(symbol)
      ? (selected ?? []).filter((s) => s !== symbol)
      : [...(selected ?? []), symbol];
    if (next.length === 0 || next.length === tickers.length) {
      onChange(null);
      return;
    }
    onChange(next.sort((a, b) => a.localeCompare(b)));
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setQuery(''); }}
        disabled={tickers.length === 0}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-label={`Tickers on chart: ${label}`}
        className={`flex min-w-[148px] max-w-[220px] items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-50 ${
          open ? 'border-brand bg-surface text-ink ring-2 ring-brand/15' : 'border-line bg-surface text-secondary hover:border-line'
        }`}
      >
        <span className="truncate">{tickers.length === 0 ? 'No tickers yet' : label}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
      </button>

      {open && tickers.length > 0 && (
        <div className="animate-scale-in absolute right-0 z-30 mt-1.5 w-[280px] overflow-hidden rounded-xl border border-line bg-surface shadow-[0_20px_40px_rgba(15,23,42,0.16)]">
          <div className="border-b border-line px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted">Show P&amp;L for</p>
            <p className="mt-0.5 text-[11px] text-muted">Pick one ticker, or combine several.</p>
          </div>
          {showSearch && (
            <div className="border-b border-line p-2">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  autoFocus
                  placeholder="Search tickers"
                  aria-label="Search tickers"
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-xl border border-line bg-subtle py-1.5 pl-8 pr-3 text-xs outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                />
              </label>
            </div>
          )}
          <div id={listboxId} role="listbox" aria-multiselectable="true" className="max-h-64 overflow-y-auto p-1">
            <button
              type="button"
              role="option"
              aria-selected={isAll}
              onClick={setAll}
              className={`sticky top-0 z-10 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                isAll ? 'bg-info-soft font-semibold text-info' : 'bg-surface text-secondary hover:bg-subtle'
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                  isAll ? 'border-brand bg-primary text-on-primary' : 'border-line bg-surface'
                }`}
                aria-hidden="true"
              >
                {isAll && <Check className="h-3 w-3" />}
              </span>
              <span>Select all</span>
            </button>
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted">No tickers match “{query}”</p>
            ) : filtered.map((t) => {
              const on = selectedSet.has(t.symbol);
              const positive = t.pnl >= 0;
              return (
                <button
                  key={t.symbol}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => toggle(t.symbol)}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                    on && !isAll ? 'bg-subtle font-semibold text-ink' : 'text-secondary hover:bg-subtle'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        on ? 'border-brand bg-primary text-on-primary' : 'border-line bg-surface'
                      }`}
                      aria-hidden="true"
                    >
                      {on && <Check className="h-3 w-3" />}
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate">{t.symbol}</span>
                      {t.phase === 'live' && (
                        <span className="rounded bg-gain-soft px-1 py-px text-[11px] font-semibold uppercase tracking-wide text-gain">Live</span>
                      )}
                      {t.phase === 'simulation' && (
                        <span className="rounded bg-line px-1 py-px text-[11px] font-semibold tracking-wide text-muted">Sim</span>
                      )}
                    </span>
                  </span>
                  <span className={`shrink-0 tabular-nums text-[11px] font-medium ${positive ? 'text-gain' : 'text-loss'}`}>
                    {positive ? '+' : '−'}₹{Math.abs(t.pnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
