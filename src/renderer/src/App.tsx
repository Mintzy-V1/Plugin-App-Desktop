import React, { useState } from 'react';

type View = 'login' | 'plugin' | 'dashboard' | 'settings';

export default function App() {
  const [view, setView] = useState<View>('login');

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 40, color: '#0f172a' }}>
      <h1>Mintzy Plugin</h1>
      <p style={{ color: '#64748b' }}>App shell — Phase 1.3</p>
      <nav style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        {(['login', 'plugin', 'dashboard', 'settings'] as View[]).map(v => (
          <button key={v} onClick={() => setView(v)}
            style={{
              padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0',
              background: view === v ? '#2563eb' : '#fff',
              color: view === v ? '#fff' : '#0f172a', cursor: 'pointer'
            }}>
            {v}
          </button>
        ))}
      </nav>
      <div style={{ marginTop: 24, padding: 24, border: '1px solid #e2e8f0', borderRadius: 12 }}>
        {view === 'login' && <p>Login view (API key → gateway onboard)</p>}
        {view === 'plugin' && <p>Plugin terminal (broker → 2FA → config → dashboard)</p>}
        {view === 'dashboard' && <p>User dashboard (profile + plugin summary)</p>}
        {view === 'settings' && <p>Settings (auto-launch, logout, about)</p>}
      </div>
    </div>
  );
}
