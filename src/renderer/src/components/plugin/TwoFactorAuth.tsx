import { useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2, Shield } from 'lucide-react';
import { pluginApi } from '../../lib/pluginApi';

interface Props {
  sessionId: string;
  onSuccess: () => void;
  onBack: () => void;
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
      await pluginApi.submitTotp(sessionId, totp);
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4">
      <button onClick={onBack} className="mb-4 flex items-center text-sm text-slate-400 transition-colors hover:text-slate-600">
        <ArrowLeft className="mr-1 h-4 w-4" /> Back
      </button>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8">
        <div className="mb-6 text-center sm:mb-8">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 sm:mb-4 sm:h-14 sm:w-14">
            <Shield className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Two-Factor Auth</h2>
          <p className="mt-1 text-sm text-slate-500">Enter the 6-digit TOTP from your authenticator app</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" inputMode="numeric" maxLength={6} placeholder="000000" value={totp}
            onChange={e => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-2xl font-bold tracking-[0.3em] text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" />

          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-600">{error}</div>
          )}

          <button type="submit" disabled={loading || totp.length !== 6}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Verify <ArrowRight className="h-5 w-5" /></>}
          </button>
        </form>
      </div>
    </div>
  );
}
