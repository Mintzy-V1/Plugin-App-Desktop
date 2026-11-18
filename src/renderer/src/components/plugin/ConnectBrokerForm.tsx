import { useMemo, useState } from 'react';
import { ArrowRight, Lock, ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react';
import { pluginApi } from '../../lib/pluginApi';
import type { CredentialsPayload } from '../../lib/pluginApi';
import { pluginErrorMessage } from '../../lib/pluginErrors';
import { useAuth } from '../../context/AuthContext';

export type BrokerType = 'angel' | 'tradex' | 'bear_street' | 'firstock';

interface Props {
  onSuccess: (sessionId: string, requiresTotp: boolean) => void;
  onBack: () => void;
}

const TRADEX_BASE_URL = 'https://tradex.markethubonline.com:30001/TradeXApi/v1';
const BEAR_STREET_BASE_URL = 'https://connectorservices.odinconnector.co.in/interactive';

/** Brokers that authenticate in one credentials call (no separate TOTP step). */
const SKIP_TOTP_BROKERS: ReadonlySet<BrokerType> = new Set(['tradex', 'bear_street']);

const inputClass =
  'w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-muted outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15 disabled:opacity-60';

/** JWTs / keys often get spaces when pasted — strip them for TradeX. */
const sanitizeTokenLike = (value: string) => value.replace(/\s+/g, '');

/** Broker is fixed at Mintzy API-key onboard — never chosen in this form. */
export function brokerFromProfile(broker?: string | null): BrokerType {
  const normalized = String(broker || '').toLowerCase().replace(/[\s_-]+/g, '');
  if (normalized === 'tradex') return 'tradex';
  if (normalized === 'bearstreet' || normalized.includes('bear')) return 'bear_street';
  if (normalized === 'firstock') return 'firstock';
  return 'angel';
}

export function brokerLabel(broker: BrokerType): string {
  if (broker === 'tradex') return 'TradeX';
  if (broker === 'bear_street') return 'GLOBE CAPITALS';
  if (broker === 'firstock') return 'Firstock';
  return 'Angel One';
}

export default function ConnectBrokerForm({ onSuccess, onBack }: Props) {
  const { user } = useAuth();
  const broker = brokerFromProfile(user?.broker);
  const isTradex = broker === 'tradex';
  const isBearStreet = broker === 'bear_street';
  const isFirstock = broker === 'firstock';

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ accessKey: '', clientId: '', secret: '', secondAuth: '', vendorCode: '' });
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
  }, [isTradex, isBearStreet, isFirstock]);

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
    const vendorCode = form.vendorCode.trim();

    if (!accessKey || !clientId || !secret) {
      setError('Fill in all fields');
      return;
    }
    if (isBearStreet && !secondAuth) {
      setError('Registered mobile number is required for GLOBE CAPITALS');
      return;
    }
    if (isFirstock && !vendorCode) {
      setError('Vendor code is required for Firstock');
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
    } else if (isFirstock) {
      payload = {
        userId: user.id,
        api_key: accessKey,
        client_code: clientId,
        password: secret,
        vendor_code: vendorCode,
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
    <div className="mx-auto w-full max-w-[440px]">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 flex items-center gap-1 text-sm text-muted transition-colors hover:text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Cancel
      </button>

      <div className="rounded-xl border border-line/80 bg-surface p-7 ">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-info-soft text-info">
            <Lock className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </div>
          <h2 className="font-serif text-3xl tracking-tight text-ink">Connect Broker</h2>
          <p className="mt-1 text-sm text-muted">Enter your {brokerLabel(broker)} credentials</p>
          {user?.broker && (
            <p className="mt-3 inline-flex items-center rounded-full bg-subtle px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-secondary">
              {brokerLabel(broker)}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label htmlFor={fields.key.id} className="mb-2 block text-xs font-medium text-secondary">{fields.key.placeholder}</label>
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
            <label htmlFor={fields.client.id} className="mb-2 block text-xs font-medium text-secondary">{fields.client.placeholder}</label>
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
            <label htmlFor={fields.secret.id} className="mb-2 block text-xs font-medium text-secondary">{fields.secret.placeholder}</label>
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
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted transition-colors hover:text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              {showSecret ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>

          {isBearStreet && (
            <>
              <div className="relative">
                <label htmlFor="broker-second-auth" className="mb-2 block text-xs font-medium text-secondary">Registered Mobile Number</label>
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
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted transition-colors hover:text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                >
                  {showSecondAuth ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
              <p className="rounded-xl border border-brand/25 bg-info-soft px-3 py-2 text-[11px] leading-5 text-info">
                GLOBE CAPITALS authenticates in one step — enter your registered mobile number here. No separate TOTP screen is required.
              </p>
            </>
          )}

          {isFirstock && (
            <>
              <div className="relative">
                <label htmlFor="broker-vendor-code" className="mb-2 block text-xs font-medium text-secondary">Vendor Code</label>
                <input
                  id="broker-vendor-code"
                  type="text"
                  placeholder="Vendor Code"
                  required
                  value={form.vendorCode}
                  autoComplete="off"
                  disabled={loading}
                  onChange={e => setForm(f => ({ ...f, vendorCode: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <p className="rounded-xl border border-brand/25 bg-info-soft px-3 py-2 text-[11px] leading-5 text-info">
                Firstock authenticates in two steps — enter your vendor code here, then the TOTP from your authenticator on the next screen.
              </p>
            </>
          )}

          {error && (
            <div role="alert" className="rounded-xl border border-loss/25 bg-loss-soft px-3.5 py-2.5 text-center text-[13px] font-medium text-loss">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary transition-colors hover:bg-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-50"
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
