import { useState } from 'react';
import { ArrowRight, Lock, ArrowLeft, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { pluginApi } from '../../lib/pluginApi';
import type { CredentialsPayload } from '../../lib/pluginApi';
import { useAuth } from '../../context/AuthContext';

export type BrokerType = 'angel' | 'tradex';

interface Props {
  onSuccess: (sessionId: string, requiresTotp: boolean, brokerType: BrokerType) => void;
  onBack: () => void;
}

const TRADEX_BASE_URL = 'https://tradex.markethubonline.com:30001/TradeXApi/v1';

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15';
const labelClass = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500';

/** JWTs / keys often get spaces when pasted — strip them for TradeX. */
const sanitizeTokenLike = (value: string) => value.replace(/\s+/g, '');

function isTradexBroker(broker?: string | null) {
  return String(broker || '').toLowerCase().replace(/\s+/g, '') === 'tradex';
}

export default function ConnectBrokerForm({ onSuccess, onBack }: Props) {
  const { user } = useAuth();
  const isTradex = isTradexBroker(user?.broker);
  const brokerName = isTradex ? 'TradeX' : 'Angel One';

  const [loading, setLoading] = useState(false);
  // Shared local form state; mapped to broker-specific API fields on submit.
  const [form, setForm] = useState({ accessKey: '', clientId: '', secret: '' });
  const [showSecret, setShowSecret] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const accessKey = isTradex ? sanitizeTokenLike(form.accessKey) : form.accessKey.trim();
    const clientId = form.clientId.trim();
    const secret = isTradex ? sanitizeTokenLike(form.secret) : form.secret.trim();

    if (!accessKey || !clientId || !secret) {
      setError('Fill in all fields');
      return;
    }

    const payload: CredentialsPayload = isTradex
      ? {
          // TradeX gateway validation requires these exact keys.
          userId: clientId,
          access_key: accessKey,
          access_secret: secret,
          base_url: TRADEX_BASE_URL,
        }
      : {
          api_key: accessKey,
          client_code: clientId,
          password: secret,
        };

    setLoading(true);
    try {
      const res = await pluginApi.submitCredentials(payload);
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
            <label htmlFor="broker-client-id" className={labelClass}>
              {isTradex ? 'Client ID / User ID' : 'Client Code'}
            </label>
            <input id="broker-client-id" type="text"
              placeholder={isTradex ? 'e.g. HO1112' : 'e.g. A123456'}
              required value={form.clientId} autoComplete="username" disabled={loading}
              onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
              className={inputClass} />
          </div>

          <div>
            <label htmlFor="broker-access-key" className={labelClass}>
              {isTradex ? 'Access Key / App Key / JWT 1' : 'API Key'}
            </label>
            <input id="broker-access-key" type="text"
              placeholder={isTradex ? 'Your Access Key or JWT 1' : 'Your broker API key'}
              required value={form.accessKey} autoComplete="off" disabled={loading}
              onChange={e => setForm(f => ({
                ...f,
                accessKey: isTradex ? sanitizeTokenLike(e.target.value) : e.target.value,
              }))}
              className={inputClass} />
          </div>

          <div>
            <label htmlFor="broker-secret" className={labelClass}>
              {isTradex ? 'Access Secret / Secret Key / JWT 2' : 'Password / PIN'}
            </label>
            <div className="relative">
              <input id="broker-secret" type={showSecret ? 'text' : 'password'}
                placeholder={isTradex ? 'Your Access Secret or JWT 2' : 'Your trading PIN'}
                required value={form.secret} autoComplete="current-password" disabled={loading}
                onChange={e => setForm(f => ({
                  ...f,
                  secret: isTradex ? sanitizeTokenLike(e.target.value) : e.target.value,
                }))}
                className={`${inputClass} pr-11`} />
              <button type="button" onClick={() => setShowSecret(s => !s)}
                aria-label={showSecret ? 'Hide secret' : 'Show secret'}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40">
                {showSecret ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
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
