import { useMemo, useState } from 'react';
import { ArrowRight, Lock, ArrowLeft, Loader2, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { pluginApi } from '../../lib/pluginApi';
import type { CredentialsPayload } from '../../lib/pluginApi';
import { pluginErrorMessage } from '../../lib/pluginErrors';
import { useAuth } from '../../context/AuthContext';

export type BrokerType = 'angel' | 'tradex';

interface Props {
  onSuccess: (sessionId: string, requiresTotp: boolean, brokerType: BrokerType) => void;
  onBack: () => void;
}

const TRADEX_BASE_URL = 'https://tradex.markethubonline.com:30001/TradeXApi/v1';

const BROKERS: { id: BrokerType; label: string }[] = [
  { id: 'angel', label: 'Angel One' },
  { id: 'tradex', label: 'TradeX' },
];

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:opacity-60';

/** JWTs / keys often get spaces when pasted — strip them for TradeX. */
const sanitizeTokenLike = (value: string) => value.replace(/\s+/g, '');

function brokerFromProfile(broker?: string | null): BrokerType {
  return String(broker || '').toLowerCase().replace(/\s+/g, '') === 'tradex' ? 'tradex' : 'angel';
}

export default function ConnectBrokerForm({ onSuccess, onBack }: Props) {
  const { user } = useAuth();
  const profileBroker = brokerFromProfile(user?.broker);

  const [broker, setBroker] = useState<BrokerType>(profileBroker);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ accessKey: '', clientId: '', secret: '' });
  const [showSecret, setShowSecret] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTradex = broker === 'tradex';

  const fields = useMemo(() => (
    isTradex
      ? {
          key: { id: 'broker-access-key', placeholder: 'Access Key / App Key / JWT 1', autoComplete: 'off' as const },
          client: { id: 'broker-client-id', placeholder: 'Client ID / User ID', autoComplete: 'username' as const },
          secret: { id: 'broker-secret', placeholder: 'Access Secret / Secret Key / JWT 2', autoComplete: 'current-password' as const },
        }
      : {
          key: { id: 'broker-access-key', placeholder: 'API Key', autoComplete: 'off' as const },
          client: { id: 'broker-client-id', placeholder: 'Client Code', autoComplete: 'username' as const },
          secret: { id: 'broker-secret', placeholder: 'Password / PIN', autoComplete: 'current-password' as const },
        }
  ), [isTradex]);

  const handleBrokerChange = (next: BrokerType) => {
    setBroker(next);
    setForm({ accessKey: '', clientId: '', secret: '' });
    setError(null);
    setShowSecret(false);
  };

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
        const status = String((res.data as any).status || '').toLowerCase();
        const requiresTotp = isTradex
          ? false
          : (res.data.requires_totp === true
            || status === 'awaiting_totp'
            || status === 'credentials_received'
            || res.data.requires_totp !== false);
        onSuccess(res.data.session_id, requiresTotp, broker);
      } else {
        setError('Broker rejected the credentials. Please check them and try again.');
      }
    } catch (err: unknown) {
      setError(pluginErrorMessage(err, 'Failed to verify credentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[380px]">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 flex items-center gap-1 text-sm text-slate-400 transition-colors hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Cancel
      </button>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-7 shadow-[0_12px_40px_-16px_rgba(15,23,42,0.18)]">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Lock className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </div>
          <h2 className="text-[22px] font-bold tracking-tight text-slate-900">Connect Broker</h2>
          <p className="mt-1 text-sm text-slate-500">Enter your broker API details</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label htmlFor="broker-select" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Broker
            </label>
            <div className="relative">
              <select
                id="broker-select"
                value={broker}
                disabled={loading}
                onChange={e => handleBrokerChange(e.target.value as BrokerType)}
                className={`${inputClass} appearance-none pr-10`}
              >
                {BROKERS.map(b => (
                  <option key={b.id} value={b.id}>{b.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            </div>
          </div>

          {/* Field order matches the reference: key → client → secret */}
          <div>
            <label htmlFor={fields.key.id} className="sr-only">{fields.key.placeholder}</label>
            <input
              id={fields.key.id}
              type="text"
              placeholder={fields.key.placeholder}
              required
              value={form.accessKey}
              autoComplete={fields.key.autoComplete}
              disabled={loading}
              onChange={e => setForm(f => ({
                ...f,
                accessKey: isTradex ? sanitizeTokenLike(e.target.value) : e.target.value,
              }))}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor={fields.client.id} className="sr-only">{fields.client.placeholder}</label>
            <input
              id={fields.client.id}
              type="text"
              placeholder={fields.client.placeholder}
              required
              value={form.clientId}
              autoComplete={fields.client.autoComplete}
              disabled={loading}
              onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div className="relative">
            <label htmlFor={fields.secret.id} className="sr-only">{fields.secret.placeholder}</label>
            <input
              id={fields.secret.id}
              type={showSecret ? 'text' : 'password'}
              placeholder={fields.secret.placeholder}
              required
              value={form.secret}
              autoComplete={fields.secret.autoComplete}
              disabled={loading}
              onChange={e => setForm(f => ({
                ...f,
                secret: isTradex ? sanitizeTokenLike(e.target.value) : e.target.value,
              }))}
              className={`${inputClass} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowSecret(s => !s)}
              aria-label={showSecret ? 'Hide secret' : 'Show secret'}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
            >
              {showSecret ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>

          {error && (
            <div role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-center text-[13px] font-medium text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Verifying…</>
            ) : (
              <>Continue <ArrowRight className="h-4 w-4" aria-hidden="true" /></>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
