import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import LoginPage from './pages/LoginPage';
import Navbar from './components/ui/Navbar';
import Sidebar, { type NavItem } from './components/ui/Sidebar';
import PluginPage from './pages/PluginPage';
import DashboardPage from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';

const VIEW_META: Record<NavItem, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Account overview and session history' },
  plugin:    { title: 'Launch Terminal', subtitle: 'Broker sessions and live trading' },
  settings:  { title: 'Settings',  subtitle: 'Desktop preferences' },
};

const SIDEBAR_KEY = 'mintzy.sidebar.pinned';

function AppContent() {
  const { user, loading } = useAuth();
  const [activeView, setActiveView] = useState<NavItem>('dashboard');
  const [sidebarPinned, setSidebarPinned] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === '1'; } catch { return false; }
  });

  const toggleSidebar = () => {
    setSidebarPinned(prev => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f7f8fa]">
        <img src="./Mintzy%20Bars%20Full%20Lockup%20Green.png" alt="Mintzy" className="h-9 w-auto animate-pulse object-contain" />
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading your workspace…
        </div>
      </div>
    );
  }
  if (!user) return <LoginPage />;

  const meta = VIEW_META[activeView];

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f8fa]">
      <Sidebar
        active={activeView}
        onNavigate={setActiveView}
        collapsed={!sidebarPinned}
        onToggleCollapse={toggleSidebar}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar title={meta.title} subtitle={meta.subtitle} />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div key={activeView} className="animate-fade-in h-full">
            {activeView === 'plugin' ? (
              <PluginPage />
            ) : (
              <div className="page-pad mx-auto w-full max-w-5xl">
                {activeView === 'dashboard' && <DashboardPage />}
                {activeView === 'settings' && <SettingsPage />}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
}
