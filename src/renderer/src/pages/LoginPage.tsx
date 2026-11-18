import { useEffect, useState } from 'react';
import { Activity, Eye, EyeOff, Layers, LineChart, Loader2, ShieldCheck } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button, IconButton } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';
import { useAuth } from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';

export default function LoginPage() {
  const { login } = useAuth();
  const { adminLogin } = useAdmin();
  // Hidden admin mode: Ctrl+Shift+A switches the form to take an admin or master key.
  // The gateway enforces all admin access; this only changes which login is called.
  const [adminMode, setAdminMode] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setAdminMode((m) => !m);
        setApiKey('');
        setShowKey(false);
        setError('');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const keyLabel = adminMode ? 'Admin key' : 'API Key';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = apiKey.trim();
    if (!key) { setError(adminMode ? 'Please enter your admin key' : 'Please enter your API key'); return; }
    setLoading(true);
    setError('');
    const result = adminMode ? await adminLogin(key) : await login(key);
    setLoading(false);
    if (!result.success) setError(result.error || 'Authentication failed');
  };

  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      <BrandPanel />
      <main className="flex min-w-0 flex-1 flex-col px-6 py-8 sm:px-12">
        <img src="./Mintzy%20Bars%20Full%20Lockup%20Green.png" alt="Mintzy" className="h-9 w-auto self-start object-contain" />
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">
          <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">{adminMode ? 'Mintzy administration' : 'Your Mintzy workspace'}</p>
          <Card className="px-8 py-9">
            {adminMode && <ShieldCheck className="mb-5 h-6 w-6 text-brand" aria-hidden="true" />}
            <h1 className="font-serif text-3xl tracking-tight">{adminMode ? 'Admin access' : 'Welcome back'}</h1>
            <p className="mb-8 mt-3 text-sm leading-relaxed text-secondary">{adminMode ? 'Enter your admin key or the master key.' : 'Enter your API key to open your trading workspace.'}</p>
            <form onSubmit={handleSubmit} className="space-y-5">
              <Field id="apiKey" label={keyLabel}>
                <div className="relative">
                  <Input id="apiKey" type={showKey ? 'text' : 'password'} placeholder={adminMode ? 'Paste your admin key' : 'Paste your API key'} value={apiKey}
                    onChange={(e) => { setApiKey(e.target.value); setError(''); }} disabled={loading} autoFocus autoComplete="off" spellCheck={false}
                    aria-invalid={!!error} aria-describedby={error ? 'login-error' : undefined} className="pr-12" />
                  <IconButton onClick={() => setShowKey(s => !s)} aria-label={showKey ? `Hide ${keyLabel}` : `Show ${keyLabel}`} className="absolute right-1 top-1/2 -translate-y-1/2">
                    {showKey ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </IconButton>
                </div>
              </Field>
              {error && <p id="login-error" role="alert" className="rounded-lg bg-loss-soft px-4 py-3 text-sm text-loss">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full">{loading ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Verifying…</> : 'Continue'}</Button>
            </form>
          </Card>
          <p className="mt-6 text-xs leading-relaxed text-muted">
            {adminMode ? <>Every admin view and action is logged. <button type="button" onClick={() => { setAdminMode(false); setApiKey(''); setError(''); }} className="text-gain underline underline-offset-4">Back to user login</button></> : <>Need an API key? <a href="https://mintzy.in" target="_blank" rel="noreferrer" className="text-gain underline underline-offset-4">Get one from your Mintzy account</a></>}
          </p>
        </div>
        <p className="text-[11px] text-muted">Your API key is only sent to Mintzy to sign you in.</p>
      </main>
    </div>
  );
}

const FEATURES = [
  { icon: Activity, title: 'Live P&L and trade log', body: 'Every position, signal and exit as it happens.' },
  { icon: Layers, title: 'Saved strategies', body: 'Symbols, capital, stop-loss and leverage — reusable in one click.' },
  { icon: LineChart, title: 'Performance analytics', body: 'Equity curve, drawdown, win rate and monthly comparison.' },
];

/** Decorative brand side: value statement over a faint, rising equity curve. */
function BrandPanel() {
  return (
    <aside aria-hidden="true" className="relative hidden w-[44%] max-w-[620px] shrink-0 flex-col overflow-hidden bg-[#183527] p-12 text-[#e8efe9] lg:flex">
      <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-[34%] w-full" viewBox="0 0 600 320" preserveAspectRatio="none">
        <defs>
          <linearGradient id="loginCurve" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7fc29b" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#7fc29b" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[64, 128, 192, 256].map((y) => <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="#ffffff" strokeOpacity="0.06" />)}
        <path d="M0 280 L40 268 L80 274 L120 246 L160 252 L200 222 L240 230 L280 196 L320 204 L360 170 L400 178 L440 138 L480 150 L520 104 L560 92 L600 60 L600 320 L0 320 Z" fill="url(#loginCurve)" />
        <path d="M0 280 L40 268 L80 274 L120 246 L160 252 L200 222 L240 230 L280 196 L320 204 L360 170 L400 178 L440 138 L480 150 L520 104 L560 92 L600 60" fill="none" stroke="#7fc29b" strokeWidth="2" />
      </svg>
      <div className="relative">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9cc7ad]">Mintzy Plugin</p>
        <h2 className="mt-5 max-w-sm font-serif text-[2.6rem] leading-[1.1] tracking-tight text-white">Automated equity trading, run from your desk.</h2>
      </div>
      <ul className="relative mt-14 space-y-5">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-3.5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10"><Icon className="h-4 w-4 text-[#9cc7ad]" /></span>
            <div><p className="text-sm font-semibold text-white">{title}</p><p className="mt-0.5 text-[13px] text-[#b9cfc1]">{body}</p></div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
