import { useEffect, useState } from 'react';
import { Eye, EyeOff, ShieldCheck, Loader2 } from 'lucide-react';
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
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <header className="flex h-16 items-center border-b border-line px-8">
        <img src="./Mintzy%20Bars%20Full%20Lockup%20Green.png" alt="Mintzy" className="h-9 w-auto object-contain" />
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-[420px]">
          <p className="mb-5 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">{adminMode ? 'Mintzy administration' : 'Your Mintzy workspace'}</p>
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
          <p className="mt-6 text-center text-xs leading-relaxed text-muted">
            {adminMode ? <>Every admin view and action is logged. <button type="button" onClick={() => { setAdminMode(false); setApiKey(''); setError(''); }} className="text-gain underline underline-offset-4">Back to user login</button></> : <>Need an API key? <a href="https://mintzy.in" target="_blank" rel="noreferrer" className="text-gain underline underline-offset-4">Get one from your Mintzy account</a></>}
          </p>
        </div>
      </main>
    </div>
  );
}
