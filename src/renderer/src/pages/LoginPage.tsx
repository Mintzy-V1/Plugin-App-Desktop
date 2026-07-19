import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [apiKey, setApiKey] = useState('');
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
    if (!result.success) {
      setError(result.error || 'Authentication failed');
    }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: '#0d1117', color: '#e6edf3',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <form onSubmit={handleSubmit} style={{
        background: '#161b22', borderRadius: 12, padding: 40, width: 400,
        border: '1px solid #30363d',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Mintzy</h1>
          <p style={{ color: '#8b949e', marginTop: 8, fontSize: 14 }}>
            Enter your API key to continue
          </p>
        </div>

        <input
          type="password"
          placeholder="Paste your API key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          disabled={loading}
          style={{
            width: '100%', padding: '12px 16px', borderRadius: 8,
            border: '1px solid #30363d', background: '#0d1117',
            color: '#e6edf3', fontSize: 14, outline: 'none',
            boxSizing: 'border-box',
          }}
          autoFocus
        />

        {error && (
          <div style={{
            marginTop: 16, padding: '10px 14px', borderRadius: 8,
            background: '#3d1114', border: '1px solid #da3633',
            color: '#ff7b72', fontSize: 13,
          }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} style={{
          width: '100%', marginTop: 20, padding: '12px', borderRadius: 8,
          border: 'none', background: loading ? '#1f6feb66' : '#1f6feb',
          color: '#fff', fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
        }}>
          {loading ? 'Verifying...' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
