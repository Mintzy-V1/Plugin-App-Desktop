import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import LoginPage from './pages/LoginPage';
import Navbar from './components/ui/Navbar';
import Sidebar, { type NavItem } from './components/ui/Sidebar';
import PluginPage from './pages/PluginPage';
import DashboardPage from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';

const VIEW_TITLES: Record<NavItem, string> = {
  dashboard: 'Dashboard',
  plugin: 'Plugin Framework',
  settings: 'System Settings',
};

function AppContent() {
  const { user, loading } = useAuth();
  const [activeView, setActiveView] = useState<NavItem>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50">
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

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar active={activeView} onNavigate={setActiveView} collapsed={sidebarCollapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar onToggleSidebar={() => setSidebarCollapsed(c => !c)} sidebarCollapsed={sidebarCollapsed}
          title={VIEW_TITLES[activeView]} />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div key={activeView} className="animate-fade-in px-4 py-6 sm:px-6 lg:px-8">
            {activeView === 'plugin' ? (
              <PluginPage />
            ) : (
              <div className="mx-auto w-full max-w-[900px]">
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
