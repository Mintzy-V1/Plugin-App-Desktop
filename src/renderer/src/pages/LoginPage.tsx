import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = apiKey.trim();
    if (!key) { setError('Please enter your API key'); return; }
    setLoading(true);
    setError('');
    const result = await login(key);
    setLoading(false);
    if (!result.success) setError(result.error || 'Authentication failed');
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <nav className="w-full border-b border-gray-100/50 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center px-4 py-4 sm:px-6 lg:px-8">
          <img src="./Mintzy%20Bars%20Full%20Lockup%20Green.png" alt="Mintzy" className="h-8 w-auto object-contain" />
        </div>
      </nav>

      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
            <p className="mt-2 text-sm text-slate-500">Enter your API key to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium text-slate-700">API Key</label>
              <div className="relative mt-1.5">
                <input id="apiKey" type={showKey ? 'text' : 'password'} placeholder="Paste your API key" value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setError(''); }} disabled={loading} autoFocus autoComplete="off"
                  className="block w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-4 pr-11 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60" />
                <button type="button" onClick={() => setShowKey(s => !s)}
                  aria-label={showKey ? 'Hide API key' : 'Show API key'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40">
                  {showKey ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/20 disabled:opacity-60">
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Verifying...
                </span>
              ) : 'Continue'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            Don't have an API key?{' '}
            <a href="https://mintzy.in" target="_blank" rel="noreferrer"
              className="font-medium text-blue-600 underline underline-offset-2 transition-colors hover:text-blue-700">
              Get one from your Mintzy account
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
