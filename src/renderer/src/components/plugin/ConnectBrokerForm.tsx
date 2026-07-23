import { useState } from 'react';
import { ArrowRight, Lock, ArrowLeft, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { pluginApi } from '../../lib/pluginApi';
import { useAuth } from '../../context/AuthContext';

export type BrokerType = 'angel' | 'tradex';

interface Props {
  onSuccess: (sessionId: string, requiresTotp: boolean, brokerType: BrokerType) => void;
  onBack: () => void;
}

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15';
const labelClass = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500';

export default function ConnectBrokerForm({ onSuccess, onBack }: Props) {
  const { user } = useAuth();
  const isTradex = user?.broker === 'tradex';
  const brokerName = isTradex ? 'TradeX' : 'Angel One';

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ api_key: '', client_code: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.api_key || !form.client_code || !form.password) { setError('Fill in all fields'); return; }
    setLoading(true);
    try {
      const res = await pluginApi.submitCredentials({
        api_key: form.api_key.trim(),
        client_code: form.client_code.trim(),
        password: form.password.trim(),
      });
      if (res.data?.success) {
        onSuccess(res.data.session_id, Boolean(res.data.requires_totp), isTradex ? 'tradex' : 'angel');
      } else {
        setError('Broker rejected the credentials. Please check them and try again.');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to verify credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4">
      <button onClick={onBack}
        className="mb-4 flex items-center rounded-lg text-sm text-slate-400 transition-colors hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40">
        <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" /> Cancel
      </button>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8">
        <div className="mb-6 text-center sm:mb-8">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 sm:mb-4 sm:h-14 sm:w-14">
            <Lock className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Connect Broker</h2>
          <p className="mt-1 text-sm text-slate-500">Enter your {brokerName} credentials to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="broker-api-key" className={labelClass}>{isTradex ? 'App Key / JWT 1' : 'API Key'}</label>
            <input id="broker-api-key" type="text" placeholder={isTradex ? 'Your App Key or JWT 1' : 'Your broker API key'} required value={form.api_key}
              autoComplete="off" disabled={loading}
              onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
              className={inputClass} />
          </div>
          <div>
            <label htmlFor="broker-client-code" className={labelClass}>{isTradex ? 'Client ID (e.g. HO9999)' : 'Client Code'}</label>
            <input id="broker-client-code" type="text" placeholder={isTradex ? 'e.g. HO9999' : 'e.g. A123456'} required value={form.client_code}
              autoComplete="username" disabled={loading}
              onChange={e => setForm(f => ({ ...f, client_code: e.target.value }))}
              className={inputClass} />
          </div>
          <div>
            <label htmlFor="broker-password" className={labelClass}>{isTradex ? 'Secret Key / JWT 2' : 'Password / PIN'}</label>
            <div className="relative">
              <input id="broker-password" type={showPassword ? 'text' : 'password'} placeholder={isTradex ? 'Your Secret Key or JWT 2' : 'Your trading PIN'} required
                value={form.password} autoComplete="current-password" disabled={loading}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className={`${inputClass} pr-11`} />
              <button type="button" onClick={() => setShowPassword(s => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40">
                {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          </div>

          {error && (
            <div role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-600">{error}</div>
          )}

          <button type="submit" disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? (
              <><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Verifying…</>
            ) : (
              <>Continue <ArrowRight className="h-5 w-5" aria-hidden="true" /></>
            )}
          </button>

          <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Credentials are sent securely to your broker and never stored on this device.
          </p>
        </form>
      </div>
    </div>
  );
}
