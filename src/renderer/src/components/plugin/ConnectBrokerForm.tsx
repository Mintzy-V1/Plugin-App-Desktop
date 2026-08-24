import { useMemo, useState } from 'react';
import { ArrowRight, Lock, ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react';
import { pluginApi } from '../../lib/pluginApi';
import type { CredentialsPayload } from '../../lib/pluginApi';
import { pluginErrorMessage } from '../../lib/pluginErrors';
import { useAuth } from '../../context/AuthContext';

export type BrokerType = 'angel' | 'tradex' | 'bear_street';

interface Props {
  onSuccess: (sessionId: string, requiresTotp: boolean) => void;
  onBack: () => void;
}

const TRADEX_BASE_URL = 'https://tradex.markethubonline.com:30001/TradeXApi/v1';
const BEAR_STREET_BASE_URL = 'https://connectorservices.odinconnector.co.in/interactive';

/** Brokers that authenticate in one credentials call (no separate TOTP step). */
const SKIP_TOTP_BROKERS: ReadonlySet<BrokerType> = new Set(['tradex', 'bear_street']);

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:opacity-60';

/** JWTs / keys often get spaces when pasted — strip them for TradeX. */
const sanitizeTokenLike = (value: string) => value.replace(/\s+/g, '');

/** Broker is fixed at Mintzy API-key onboard — never chosen in this form. */
export function brokerFromProfile(broker?: string | null): BrokerType {
  const normalized = String(broker || '').toLowerCase().replace(/[\s_-]+/g, '');
  if (normalized === 'tradex') return 'tradex';
  if (normalized === 'bearstreet' || normalized.includes('bear')) return 'bear_street';
  return 'angel';
}

function brokerLabel(broker: BrokerType): string {
  if (broker === 'tradex') return 'TradeX';
  if (broker === 'bear_street') return 'Bear Street';
  return 'Angel One';
}

export default function ConnectBrokerForm({ onSuccess, onBack }: Props) {
  const { user } = useAuth();
  const broker = brokerFromProfile(user?.broker);
  const isTradex = broker === 'tradex';
  const isBearStreet = broker === 'bear_street';

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ accessKey: '', clientId: '', secret: '', secondAuth: '' });
  const [showSecret, setShowSecret] = useState(false);
  const [showSecondAuth, setShowSecondAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fields = useMemo(() => {
    if (isTradex) {
      return {
        key: { id: 'broker-access-key', placeholder: 'Access Key / App Key / JWT 1', autoComplete: 'off' as const },
        client: { id: 'broker-client-id', placeholder: 'Client ID / User ID', autoComplete: 'username' as const },
        secret: { id: 'broker-secret', placeholder: 'Access Secret / Secret Key / JWT 2', autoComplete: 'current-password' as const },
      };
    }
    if (isBearStreet) {
      return {
        key: { id: 'broker-access-key', placeholder: 'API Key', autoComplete: 'off' as const },
        client: { id: 'broker-client-id', placeholder: 'User ID', autoComplete: 'username' as const },
        secret: { id: 'broker-secret', placeholder: 'Password', autoComplete: 'current-password' as const },
      };
    }
    return {
      key: { id: 'broker-access-key', placeholder: 'API Key', autoComplete: 'off' as const },
      client: { id: 'broker-client-id', placeholder: 'Client Code', autoComplete: 'username' as const },
      secret: { id: 'broker-secret', placeholder: 'Password / PIN', autoComplete: 'current-password' as const },
    };
  }, [isTradex, isBearStreet]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user?.broker) {
      setError('No broker is linked to your Mintzy account. Contact support or re-login with your API key.');
      return;
    }

    const accessKey = isTradex ? sanitizeTokenLike(form.accessKey) : form.accessKey.trim();
    const clientId = form.clientId.trim();
    const secret = isTradex ? sanitizeTokenLike(form.secret) : form.secret.trim();
    const secondAuth = form.secondAuth.trim();

    if (!accessKey || !clientId || !secret) {
      setError('Fill in all fields');
      return;
    }
    if (isBearStreet && !secondAuth) {
      setError('Registered mobile number is required for Bear Street');
      return;
    }

    let payload: CredentialsPayload;
    if (isTradex) {
      payload = {
        userId: clientId,
        access_key: accessKey,
        access_secret: secret,
        base_url: TRADEX_BASE_URL,
      };
    } else if (isBearStreet) {
      payload = {
        api_key: accessKey,
        userId: user.id,
        client_code: clientId,
        password: secret,
        second_auth: secondAuth,
        source: 'WEBAPI',
        base_url: BEAR_STREET_BASE_URL,
      };
    } else {
      payload = {
        api_key: accessKey,
        client_code: clientId,
        password: secret,
      };
    }

    setLoading(true);
    try {
      const res = await pluginApi.submitCredentials(payload);
      if (res.data?.success) {
        const status = String((res.data as any).status || '').toLowerCase();
        const requiresTotp = SKIP_TOTP_BROKERS.has(broker)
          ? false
          : (res.data.requires_totp === true
            || status === 'awaiting_totp'
            || status === 'credentials_received'
            || res.data.requires_totp !== false);
        onSuccess(res.data.session_id, requiresTotp);
      } else {
        setError('Broker rejected the credentials. Please check them and try again.');
      }
    } catch (err: unknown) {
      setError(pluginErrorMessage(err, 'Could not verify your credentials. Please try again.'));
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
          <p className="mt-1 text-sm text-slate-500">Enter your {brokerLabel(broker)} credentials</p>
          {user?.broker && (
            <p className="mt-3 inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              {brokerLabel(broker)}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
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

          {isBearStreet && (
            <>
              <div className="relative">
                <label htmlFor="broker-second-auth" className="sr-only">Registered Mobile Number</label>
                <input
                  id="broker-second-auth"
                  type={showSecondAuth ? 'text' : 'password'}
                  placeholder="Registered Mobile Number"
                  required
                  value={form.secondAuth}
                  autoComplete="one-time-code"
                  disabled={loading}
                  onChange={e => setForm(f => ({ ...f, secondAuth: e.target.value }))}
                  className={`${inputClass} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowSecondAuth(s => !s)}
                  aria-label={showSecondAuth ? 'Hide registered mobile number' : 'Show registered mobile number'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                >
                  {showSecondAuth ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
              <p className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] leading-5 text-blue-800">
                Bear Street authenticates in one step — enter your registered mobile number here. No separate TOTP screen is required.
              </p>
            </>
          )}

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
