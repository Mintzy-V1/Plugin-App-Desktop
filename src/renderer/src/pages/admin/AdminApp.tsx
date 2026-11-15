import { useState } from 'react';
import Navbar from '../../components/ui/Navbar';
import AdminSidebar, { type AdminNavItem } from '../../components/admin/AdminSidebar';
import { useAdmin } from '../../context/AdminContext';
import AdminLivePage from './AdminLivePage';
import AdminAccountsPage from './AdminAccountsPage';
import AdminSessionPage from './AdminSessionPage';
import AdminKeysPage from './AdminKeysPage';
import AdminAuditPage from './AdminAuditPage';

const VIEW_META: Record<AdminNavItem, { title: string; subtitle: string }> = {
  live: { title: 'Live sessions', subtitle: 'Every account trading, simulating or scheduled right now' },
  accounts: { title: 'Accounts', subtitle: 'All Mintzy accounts and their sessions' },
  keys: { title: 'Admin keys', subtitle: 'Create and revoke per-admin keys' },
  audit: { title: 'Audit log', subtitle: 'Who viewed what, and when' },
};

/** Admin shell. Remounted per admin identity so state never carries across sign-ins. */
export default function AdminApp() {
  const { admin } = useAdmin();
  const [view, setView] = useState<AdminNavItem>('live');
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  if (!admin) return null;
  const isMaster = admin.role === 'master';
  const activeView = !isMaster && (view === 'keys' || view === 'audit') ? 'live' : view;
  const meta = VIEW_META[activeView];

  const navigate = (item: AdminNavItem) => {
    setView(item);
    setUserId(null);
    setSessionId(null);
  };

  const openUser = (id: string) => {
    setView('accounts');
    setSessionId(null);
    setUserId(id);
  };

  let content: React.ReactNode;
  if (sessionId) {
    content = (
      <AdminSessionPage
        sessionId={sessionId}
        backLabel={activeView === 'accounts' && userId ? 'Account' : 'Live sessions'}
        onBack={() => setSessionId(null)}
        onOpenUser={openUser}
      />
    );
  } else if (activeView === 'live') {
    content = <AdminLivePage onOpenSession={setSessionId} />;
  } else if (activeView === 'accounts') {
    content = <AdminAccountsPage userId={userId} onOpenUser={setUserId} onBack={() => setUserId(null)} onOpenSession={setSessionId} />;
  } else if (activeView === 'keys') {
    content = <AdminKeysPage />;
  } else {
    content = <AdminAuditPage />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f8fa]">
      <AdminSidebar active={activeView} onNavigate={navigate} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Navbar
          title={sessionId ? 'Session' : meta.title}
          subtitle={sessionId ? 'Read-only view of this session' : meta.subtitle}
          trailing={
            <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
              Signed in as {admin.name}
            </span>
          }
        />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <div key={`${activeView}:${userId ?? ''}:${sessionId ?? ''}`} className="page-pad mx-auto w-full max-w-6xl">
            {content}
          </div>
        </main>
      </div>
    </div>
  );
}
