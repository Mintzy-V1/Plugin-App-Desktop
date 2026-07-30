import { useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2, Shield } from 'lucide-react';
import { pluginApi } from '../../lib/pluginApi';
import { pluginErrorMessage } from '../../lib/pluginErrors';

interface Props {
  sessionId: string;
  onSuccess: (info?: { freeCash?: number | null }) => void;
  onBack: () => void;
}

function extractFreeCash(data: Record<string, any> | undefined | null): number | null {
  if (!data) return null;
  const candidates = [
    data.free_cash,
    data.account_info?.free_cash,
    data.account_info?.balance_details?.free_cash,
    data.account_info?.balance_details?.data?.availablecash,
    data.account_info?.balance_details?.raw?.data?.availablecash,
  ];
  for (const c of candidates) {
    if (c == null || c === '') continue;
    const n = Number(c);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export default function TwoFactorAuth({ sessionId, onSuccess, onBack }: Props) {
  const [totp, setTotp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totp.length !== 6) { setError('Enter a 6-digit code'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await pluginApi.submitTotp(sessionId, totp);
      const freeCash = extractFreeCash(res.data as Record<string, any>);
      onSuccess({ freeCash });
    } catch (err: unknown) {
      setError(pluginErrorMessage(err, 'Invalid code. Try a fresh TOTP from your authenticator.'));
      // Clear so the user enters a new code (TOTP rotates every ~30s).
      setTotp('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <button type="button" onClick={onBack}
        className="mb-3 flex items-center rounded-lg text-sm text-slate-400 transition-colors hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30">
        <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" /> Back
      </button>

      <div className="form-card">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Shield className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Two-Factor Auth</h2>
          <p className="mt-1 text-sm text-slate-500">Enter the 6-digit TOTP from your Angel One authenticator</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="totp-code" className="sr-only">6-digit authentication code</label>
            <input id="totp-code" type="text" inputMode="numeric" maxLength={6} placeholder="000000" value={totp}
              autoComplete="one-time-code" autoFocus disabled={loading}
              onChange={e => { setTotp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(null); }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-2xl font-bold tracking-[0.3em] text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15" />
            <p className="mt-2 text-center text-[11px] text-slate-400">Codes expire every 30 seconds — use a fresh one</p>
          </div>

          {error && (
            <div role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-600">{error}</div>
          )}

          <button type="submit" disabled={loading || totp.length !== 6}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? <><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Verifying…</> : <>Verify <ArrowRight className="h-5 w-5" aria-hidden="true" /></>}
          </button>
        </form>
      </div>
    </div>
  );
}
