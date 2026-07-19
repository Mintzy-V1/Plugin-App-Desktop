import { IconCode, IconCpu, IconSettings, IconUser, IconKey, IconReceipt, IconLogout } from '@tabler/icons-react';
import { useAuth } from '../../context/AuthContext';
import UserAvatar from './UserAvatar';

export type NavItem = 'plugin' | 'dashboard' | 'settings';

interface SidebarProps {
  active: NavItem;
  onNavigate: (item: NavItem) => void;
}

const NAV_ITEMS: { id: NavItem; label: string; icon: typeof IconCpu; badge?: string }[] = [
  { id: 'dashboard', label: 'Dashboard',   icon: IconUser },
  { id: 'plugin',    label: 'Plugin Framework', icon: IconCpu, badge: 'LIVE' },
  { id: 'settings',  label: 'System Settings',  icon: IconSettings },
];

const EXTRA_ITEMS: { label: string; icon: typeof IconCode }[] = [
  { label: 'Plugin Keys',     icon: IconKey },
  { label: 'API Access',      icon: IconCode },
  { label: 'Recent Payments', icon: IconReceipt },
];

export default function Sidebar({ active, onNavigate }: SidebarProps) {
  const { user, logout } = useAuth();

  return (
    <aside className="flex h-full w-full flex-col rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-5">
        <div className="flex items-center gap-3">
          <UserAvatar name={user?.name || 'U'} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{user?.name}</p>
            <p className="truncate text-xs text-slate-500">{user?.email}</p>
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {NAV_ITEMS.map(({ id, label, icon: Icon, badge }) => {
          const isActive = active === id;
          return (
            <button key={id} type="button" onClick={() => onNavigate(id)}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
                isActive
                  ? 'border-l-[3px] border-blue-600 bg-blue-50 pl-[9px] font-semibold text-blue-700'
                  : 'border-l-[3px] border-transparent font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-3">
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} stroke={1.75} />
                {label}
              </span>
              {badge === 'LIVE' && (
                <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">LIVE</span>
              )}
            </button>
          );
        })}

        <div className="my-2 border-t border-slate-100" />

        {EXTRA_ITEMS.map(({ label, icon: Icon }) => (
          <div key={label}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-400 cursor-not-allowed opacity-60"
            title="Coming soon"
          >
            <Icon className="h-4 w-4 shrink-0" stroke={1.75} />
            {label}
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-100 p-3">
        <button type="button" onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
        >
          <IconLogout className="h-4 w-4" stroke={1.75} />
          Log out
        </button>
      </div>
    </aside>
  );
}
