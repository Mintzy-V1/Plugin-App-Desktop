import { useState } from 'react';
import { ArrowRight, Lock, ArrowLeft, Loader2 } from 'lucide-react';
import { pluginApi } from '../../lib/pluginApi';

export type BrokerType = 'angel' | 'tradex';

interface Props {
  onSuccess: (sessionId: string, requiresTotp: boolean, brokerType: BrokerType) => void;
  onBack: () => void;
}

export default function ConnectBrokerForm({ onSuccess, onBack }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ api_key: '', client_code: '', password: '' });
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
        onSuccess(res.data.session_id, Boolean(res.data.requires_totp), 'angel');
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
          <p className="mt-1 text-sm text-slate-500">Enter your broker credentials to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" placeholder="API Key" required value={form.api_key}
            onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" />
          <input type="text" placeholder="Client Code" required value={form.client_code}
            onChange={e => setForm(f => ({ ...f, client_code: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" />
          <input type="password" placeholder="Password / PIN" required value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" />

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
