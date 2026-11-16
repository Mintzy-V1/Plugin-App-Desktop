import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, KeyRound, LogOut, StopCircle } from 'lucide-react';
import { adminApi, type AdminAccount } from '../../lib/adminApi';
import type { SessionDataSource } from '../../lib/sessionDataSource';
import { pluginErrorMessage } from '../../lib/pluginErrors';
import { useToast } from '../../components/ui/Toast';
import { Spinner, inputClass } from './adminFormat';

type Action = 'stop' | 'exit';

interface OpenPosition {
  symbol: string;
  qty: number | null;
}

const QTY_KEYS = ['net_qty', 'NetQty', 'netqty', 'position_qty', 'qty', 'quantity', 'Quantity', 'QTY', 'Qty'];

function positionQty(row: Record<string, unknown>): number | null {
  for (const key of QTY_KEYS) {
    if (!(key in row)) continue;
    const n = Number(row[key]);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Symbols from a live P&L payload, open positions first. Flat (qty 0) symbols are left out. */
function positionsFromLivePnl(raw: unknown): OpenPosition[] {
  const data = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).data : null;
  const symbols = data && typeof data === 'object' ? (data as Record<string, unknown>).symbols : null;
  if (!symbols || typeof symbols !== 'object') return [];

  const entries = Array.isArray(symbols)
    ? symbols.map((item) => {
        const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
        return [String(row.symbol ?? row.Symbol ?? ''), row] as const;
      })
    : Object.entries(symbols as Record<string, unknown>);

  const out: OpenPosition[] = [];
  for (const [sym, value] of entries) {
    const symbol = sym.trim().toUpperCase();
    if (!symbol) continue;
    const qty = positionQty((value && typeof value === 'object' ? value : {}) as Record<string, unknown>);
    if (qty === 0) continue;
    out.push({ symbol, qty });
  }
  return out.sort((a, b) => Number(b.qty != null) - Number(a.qty != null) || a.symbol.localeCompare(b.symbol));
}

function controlErrorMessage(err: unknown, fallback: string): string {
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (status === 403) return 'That API key does not belong to this account.';
  if (status === 429) return 'Too many wrong API keys. Try again in 15 minutes.';
  return pluginErrorMessage(err, fallback);
}

/**
 * Stop and Exit for the admin session view. Both ask for the account's own
 * Mintzy API key, which the gateway checks against the session's owner, so an
 * admin key alone can't act on anyone's trades. The key lives in this
 * component's state only and is cleared when the dialog closes.
 */
export default function AdminSessionControls({ sessionId, user, source, onStopped }: {
  sessionId: string;
  user: AdminAccount | null;
  /** The admin session source, used to list the session's open positions. */
  source: SessionDataSource;
  onStopped: () => void;
}) {
  const [action, setAction] = useState<Action | null>(null);

  return (
    <>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => setAction('exit')}
          className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" /> Exit position
        </button>
        <button
          type="button"
          onClick={() => setAction('stop')}
          className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-2.5 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
        >
          <StopCircle className="h-3.5 w-3.5" aria-hidden="true" /> Stop session
        </button>
      </div>

      {action && (
        <ControlDialog
          action={action}
          sessionId={sessionId}
          user={user}
          source={source}
          onClose={() => setAction(null)}
          onDone={() => {
            const stopped = action === 'stop';
            setAction(null);
            if (stopped) onStopped();
          }}
        />
      )}
    </>
  );
}

function ControlDialog({ action, sessionId, user, source, onClose, onDone }: {
  action: Action;
  sessionId: string;
  user: AdminAccount | null;
  source: SessionDataSource;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [positions, setPositions] = useState<OpenPosition[] | null>(action === 'exit' ? null : []);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const keyRef = useRef<HTMLInputElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const isExit = action === 'exit';
  const account = user ? user.name || user.email : 'this account';

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null;
    keyRef.current?.focus();
    return () => previousFocus.current?.focus?.();
  }, []);

  useEffect(() => {
    if (!isExit) return;
    let cancelled = false;
    source.getLivePnl(sessionId)
      .then((res) => {
        if (cancelled) return;
        const list = positionsFromLivePnl(res.data);
        setPositions(list);
        if (list.length > 0) setSymbol(list[0].symbol);
      })
      .catch(() => { if (!cancelled) setPositions([]); });
    return () => { cancelled = true; };
  }, [isExit, sessionId, source]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) { e.stopPropagation(); onClose(); }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [busy, onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = apiKey.trim();
    const sym = symbol.trim().toUpperCase();
    if (!key) { setError(`Enter the Mintzy API key for ${account}.`); return; }
    if (isExit && !sym) { setError('Choose the symbol to exit.'); return; }

    setBusy(true);
    setError('');
    try {
      if (isExit) {
        await adminApi.exitSymbol(sessionId, sym, key);
        toast.success(`Exit sent for ${sym}`);
      } else {
        await adminApi.stopSession(sessionId, key);
        toast.success('Session stopped');
      }
      setApiKey('');
      onDone();
    } catch (err) {
      setError(controlErrorMessage(err, isExit
        ? `Could not exit ${sym}. The position may still be open.`
        : 'Could not stop the session. It may still be running.'));
      setBusy(false);
    }
  };

  const confirmClass = isExit
    ? 'bg-red-500 hover:bg-red-600 focus-visible:ring-red-500/40'
    : 'bg-amber-500 hover:bg-amber-600 focus-visible:ring-amber-500/40';

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-control-title"
        className="animate-scale-in w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
      >
        <h3 id="admin-control-title" className="text-[15px] font-semibold text-slate-900">
          {isExit ? 'Exit a position?' : 'Stop session?'}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
          {isExit
            ? <>This squares off the chosen symbol in <span className="font-medium text-slate-700">{account}</span>’s live session. The rest of the session keeps running.</>
            : <>The engine will finish gracefully for <span className="font-medium text-slate-700">{account}</span>: it stops taking new positions and winds down the session.</>}
        </p>

        {isExit && (
          <div className="mt-4">
            <label htmlFor="admin-exit-symbol" className="block text-[11px] font-medium text-slate-500">Symbol</label>
            {positions == null ? (
              <p className="mt-1 flex items-center gap-2 text-[13px] text-slate-400"><Spinner className="h-3.5 w-3.5" /> Loading positions…</p>
            ) : positions.length > 0 ? (
              <select
                id="admin-exit-symbol"
                value={symbol}
                onChange={(e) => { setSymbol(e.target.value); setError(''); }}
                disabled={busy}
                className={`${inputClass} mt-1 w-full`}
              >
                {positions.map((p) => (
                  <option key={p.symbol} value={p.symbol}>
                    {p.symbol}{p.qty != null ? ` · Qty ${Math.abs(p.qty)}` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <input
                  id="admin-exit-symbol"
                  value={symbol}
                  onChange={(e) => { setSymbol(e.target.value.toUpperCase()); setError(''); }}
                  disabled={busy}
                  placeholder="e.g. RELIANCE"
                  autoComplete="off"
                  className={`${inputClass} mt-1 w-full font-mono`}
                />
                <p className="mt-1 text-[11px] text-slate-400">No open positions were reported. Type the symbol to exit.</p>
              </>
            )}
          </div>
        )}

        <div className="mt-4">
          <label htmlFor="admin-control-key" className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <KeyRound className="h-3 w-3" aria-hidden="true" /> Mintzy API key for {account}
          </label>
          <div className="relative mt-1">
            <input
              ref={keyRef}
              id="admin-control-key"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setError(''); }}
              disabled={busy}
              placeholder="Paste the account’s API key"
              autoComplete="off"
              spellCheck={false}
              className={`${inputClass} w-full pr-9 font-mono`}
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? 'Hide API key' : 'Show API key'}
              className="absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400 hover:text-slate-600"
            >
              {showKey ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Checked against this account and recorded in the audit log. It is not saved.</p>
        </div>

        {error && <p role="alert" className="mt-3 text-[12px] font-medium text-red-600">{error}</p>}

        <div className="mt-5 flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !apiKey.trim() || (isExit && (positions == null || !symbol.trim()))}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white transition-colors focus:outline-none focus-visible:ring-2 disabled:opacity-60 ${confirmClass}`}
          >
            {busy && <Spinner className="h-4 w-4" />}
            {isExit ? 'Exit position' : 'Stop session'}
          </button>
        </div>
      </form>
    </div>
  );
}
