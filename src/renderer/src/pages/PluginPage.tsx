import { useState } from 'react';
import { Code2, Plus } from 'lucide-react';
import ConnectBrokerForm, { type BrokerType } from '../components/plugin/ConnectBrokerForm';
import TwoFactorAuth from '../components/plugin/TwoFactorAuth';

type PluginView = 'empty' | 'broker' | '2fa' | 'config' | 'dashboard';

export default function PluginPage() {
  const [view, setView] = useState<PluginView>('empty');
  const [sessionId, setSessionId] = useState<string | null>(null);

  const handleBrokerSuccess = (sid: string, requiresTotp: boolean, _brokerType: BrokerType) => {
    setSessionId(sid);
    setView(requiresTotp ? '2fa' : 'config');
  };

  const handle2FASuccess = () => setView('config');

  if (view === 'broker') {
    return (
      <div className="flex min-h-[600px] items-center justify-center">
        <ConnectBrokerForm onSuccess={handleBrokerSuccess} onBack={() => setView('empty')} />
      </div>
    );
  }

  if (view === '2fa' && sessionId) {
    return (
      <div className="flex min-h-[600px] items-center justify-center">
        <TwoFactorAuth sessionId={sessionId} onSuccess={handle2FASuccess} onBack={() => setView('broker')} />
      </div>
    );
  }

  return (
    <div className="flex min-h-[600px] flex-col items-center justify-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20">
        <Code2 className="h-8 w-8 text-white" />
      </div>
      <h2 className="mt-6 text-xl font-bold text-slate-900">Plugin Terminal</h2>
      <p className="mt-2 text-sm text-slate-500">Connect your broker credentials to start automated trading</p>
      <button onClick={() => setView('broker')}
        className="mt-8 flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition-all hover:bg-slate-800">
        <Plus className="h-4 w-4" /> New Session
      </button>
    </div>
  );
}
