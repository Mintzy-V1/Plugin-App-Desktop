import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import Sidebar, { type NavItem } from './components/ui/Sidebar';
import PluginPage from './pages/PluginPage';
import DashboardPage from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';

function AppContent() {
  const { user, loading } = useAuth();
  const [activeView, setActiveView] = useState<NavItem>('plugin');

  if (loading) {
    return <div style={{ background: '#0d1117', minHeight: '100vh' }} />;
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active={activeView} onNavigate={setActiveView} />
      <main style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
        {activeView === 'plugin' && <PluginPage />}
        {activeView === 'dashboard' && <DashboardPage />}
        {activeView === 'settings' && <SettingsPage />}
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
