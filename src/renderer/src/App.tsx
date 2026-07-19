import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ background: '#0d1117', minHeight: '100vh' }} />;
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div style={{
      display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, sans-serif',
      background: '#f8fafc', color: '#0f172a',
    }}>
      <nav style={{
        width: 220, background: '#fff', borderRight: '1px solid #e2e8f0',
        padding: 24, display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px' }}>Mintzy</h2>
        <p style={{ fontSize: 13, color: '#64748b' }}>Welcome, {user.name}</p>
      </nav>
      <main style={{ flex: 1, padding: 32 }}>
        <h1>Plugin Terminal</h1>
        <p style={{ color: '#64748b' }}>Coming in Phase 2</p>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
