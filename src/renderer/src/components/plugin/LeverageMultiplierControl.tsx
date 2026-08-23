import { useId, useState } from 'react';
import { Gauge, Loader2, Check } from 'lucide-react';

const MIN = 1;
const MAX = 5;
const OPTIONS = [1, 2, 3, 4, 5] as const;

export function clampLeverage(value: unknown, fallback = 1): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX, Math.max(MIN, Math.round(n)));
}

interface Props {
  /** Saved configuration id required by the leverage endpoint. */
  configurationId?: string | null;
  /** Last known server-side multiplier for this configuration. */
  appliedValue?: number | null;
  value: number;
  onChange: (value: number) => void;
  onApply: (value: number) => Promise<void> | void;
  disabled?: boolean;
  /** Extra hint when Apply is unavailable (e.g. no saved strategy selected). */
  unavailableHint?: string;
  compact?: boolean;
}

/**
 * Leverage 1–5× control with Apply — used on session config and saved strategies.
 * Calls the parent-provided onApply; parent owns the API request.
 */
export default function LeverageMultiplierControl({
  configurationId,
  appliedValue,
  value,
  onChange,
  onApply,
  disabled = false,
  unavailableHint,
  compact = false,
}: Props) {
  const uid = useId();
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justApplied, setJustApplied] = useState(false);

  const canApply = !!configurationId && !disabled && !applying;
  const normalized = clampLeverage(value);
  const applied = appliedValue != null ? clampLeverage(appliedValue) : null;
  const isDirty = applied == null || applied !== normalized;

  const handleApply = async () => {
    if (!canApply) return;
    setApplying(true);
    setError(null);
    setJustApplied(false);
    try {
      await onApply(normalized);
      setJustApplied(true);
      window.setTimeout(() => setJustApplied(false), 2000);
    } catch (err: any) {
      setError(err?.message || 'Could not update leverage. Please try again.');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white ${
        compact ? 'px-3 py-2.5' : 'px-4 py-3'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <label htmlFor={`${uid}-leverage`} className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <Gauge className="h-3 w-3" aria-hidden="true" />
            Leverage
          </label>
          <p className={`mt-0.5 text-xs text-slate-500 ${compact ? 'line-clamp-1' : ''}`}>
            Scale position size {MIN}×–{MAX}× for this strategy. Default is 1×.
          </p>
        </div>
        {applied != null && (
          <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
            Live {applied}×
          </span>
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="Leverage multiplier">
          {OPTIONS.map((n) => {
            const selected = normalized === n;
            return (
              <button
                key={n}
                type="button"
                disabled={disabled || applying}
                aria-pressed={selected}
                onClick={() => onChange(n)}
                className={`min-w-[2.25rem] rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-50 ${
                  selected
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {n}×
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <input
            id={`${uid}-leverage`}
            type="number"
            inputMode="numeric"
            min={MIN}
            max={MAX}
            step={1}
            value={normalized}
            disabled={disabled || applying}
            onChange={(e) => onChange(clampLeverage(e.target.value, normalized))}
            className="w-14 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:opacity-50"
            aria-label="Leverage multiplier"
          />
          <button
            type="button"
            onClick={() => void handleApply()}
            disabled={!canApply || !isDirty}
            title={!configurationId ? (unavailableHint || 'Select a saved strategy first') : undefined}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {applying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : justApplied ? (
              <Check className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
            ) : null}
            {applying ? 'Saving…' : justApplied ? 'Saved' : 'Set leverage'}
          </button>
        </div>
      </div>

      {!configurationId && (
        <p className="mt-2 text-[11px] text-amber-700">
          {unavailableHint || 'Select or save a strategy first, then set leverage.'}
        </p>
      )}
      {configurationId && !isDirty && applied != null && (
        <p className="mt-2 text-[11px] text-emerald-700">Leverage is set to {applied}× on this strategy.</p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[11px] font-medium text-red-600">{error}</p>
      )}
    </div>
  );
}
