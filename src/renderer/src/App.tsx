import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import Navbar from './components/ui/Navbar';
import Sidebar, { type NavItem } from './components/ui/Sidebar';
import PluginPage from './pages/PluginPage';
import DashboardPage from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';

function AppContent() {
  const { user, loading } = useAuth();
  const [activeView, setActiveView] = useState<NavItem>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (loading) return <div className="min-h-screen bg-slate-50" />;
  if (!user) return <LoginPage />;

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50">
      <Navbar onToggleSidebar={() => setSidebarCollapsed(c => !c)} />
      <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:gap-8 lg:px-8 lg:py-8">
        <div className={sidebarCollapsed ? 'w-16 shrink-0' : 'w-64 shrink-0'}>
          <div className="sticky top-24">
            <Sidebar active={activeView} onNavigate={setActiveView} collapsed={sidebarCollapsed} />
          </div>
        </div>
        <main className="min-w-0 flex-1 pb-8">
          {activeView === 'plugin' ? (
            <PluginPage />
          ) : (
            <div className="mx-auto w-full max-w-[900px]">
              {activeView === 'dashboard' && <DashboardPage />}
              {activeView === 'settings' && <SettingsPage />}
            </div>
          )}
        </main>
      </div>
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
