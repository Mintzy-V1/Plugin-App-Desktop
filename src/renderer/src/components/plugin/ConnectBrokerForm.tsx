import { useState, useRef, useEffect } from 'react';
import { ArrowRight, Lock, ArrowLeft, Loader2, ChevronDown, Check } from 'lucide-react';
import { pluginApi } from '../../lib/pluginApi';

export type BrokerType = 'angel' | 'tradex';

interface Props {
  onSuccess: (sessionId: string, requiresTotp: boolean, brokerType: BrokerType) => void;
  onBack: () => void;
}

const BROKER_OPTIONS: { value: BrokerType; label: string }[] = [
  { value: 'angel', label: 'Angel One' },
  { value: 'tradex', label: 'TradeX' },
];

export default function ConnectBrokerForm({ onSuccess, onBack }: Props) {
  const [loading, setLoading] = useState(false);
  const [brokerType, setBrokerType] = useState<BrokerType>('angel');
  const [menuOpen, setMenuOpen] = useState(false);
  const [form, setForm] = useState({ api_key: '', client_code: '', password: '', token: '' });
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isTradeX = brokerType === 'tradex';

  useEffect(() => {
    const close = (e: MouseEvent | KeyboardEvent) => {
      if ('key' in e && e.key === 'Escape') setMenuOpen(false);
      if ('target' in e && menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, []);

  const sanitize = (v: string) => (isTradeX ? v.replace(/\s+/g, '') : v);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.api_key || !form.client_code || !form.password) { setError('Fill in all fields'); return; }
    setLoading(true);
    try {
      const res = await pluginApi.submitCredentials({
        api_key: sanitize(form.api_key),
        client_code: form.client_code.trim(),
        password: sanitize(form.password),
      });
      if (res.data?.success) {
        onSuccess(res.data.session_id, Boolean(res.data.requires_totp), brokerType);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to verify credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4">
      <button onClick={onBack} className="mb-4 flex items-center text-sm text-slate-400 transition-colors hover:text-slate-600">
        <ArrowLeft className="mr-1 h-4 w-4" /> Cancel
      </button>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8">
        <div className="mb-6 text-center sm:mb-8">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 sm:mb-4 sm:h-14 sm:w-14">
            <Lock className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Connect Broker</h2>
          <p className="mt-1 text-sm text-slate-500">Enter your broker API details</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Broker</label>
            <div ref={menuRef} className="relative">
              <button type="button" onClick={() => setMenuOpen(!menuOpen)}
                className={`flex w-full items-center justify-between rounded-xl border bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-900 outline-none transition ${
                  menuOpen ? 'border-blue-500 ring-2 ring-blue-500/15' : 'border-slate-200 hover:border-slate-300'
                }`}>
                <span>{BROKER_OPTIONS.find(o => o.value === brokerType)?.label}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
              </button>
              {menuOpen && (
                <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_20px_40px_rgba(15,23,42,0.16)]">
                  {BROKER_OPTIONS.map(o => (
                    <button key={o.value} type="button" onClick={() => { setBrokerType(o.value); setError(null); setMenuOpen(false); }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                        o.value === brokerType ? 'bg-blue-50 font-semibold text-blue-700' : 'font-medium text-slate-700 hover:bg-slate-50'
                      }`}>
                      <span>{o.label}</span>
                      {o.value === brokerType && <Check className="h-4 w-4" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <input type="text" placeholder={isTradeX ? 'App Key / JWT 1' : 'API Key'} required value={form.api_key}
            onChange={e => setForm(f => ({ ...f, api_key: sanitize(e.target.value) }))}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" />
          <input type="text" placeholder={isTradeX ? 'Client ID (e.g. HO9999)' : 'Client Code'} required value={form.client_code}
            onChange={e => setForm(f => ({ ...f, client_code: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" />
          <input type="password" placeholder={isTradeX ? 'Secret Key / JWT 2' : 'Password / PIN'} required value={form.password}
            onChange={e => setForm(f => ({ ...f, password: sanitize(e.target.value) }))}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" />

          {isTradeX && (
            <>
              <input type="text" placeholder="Direct Token Bypass (Optional)" value={form.token}
                onChange={e => setForm(f => ({ ...f, token: sanitize(e.target.value) }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" />
              <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                TradeX JWT fields are sanitized to remove copied whitespace
              </p>
            </>
          )}

          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-600">{error}</div>
          )}

          <button type="submit" disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Continue <ArrowRight className="h-5 w-5" /></>}
          </button>
        </form>
      </div>
    </div>
  );
}
