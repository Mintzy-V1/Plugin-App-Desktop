import { useEffect, useState } from 'react';
import { IconCode, IconCpu, IconSettings, IconUser, IconKey, IconReceipt, IconLogout } from '@tabler/icons-react';
import { useAuth } from '../../context/AuthContext';
import { pluginApi } from '../../lib/pluginApi';
import UserAvatar from './UserAvatar';

export type NavItem = 'plugin' | 'dashboard' | 'settings';

interface SidebarProps {
  active: NavItem;
  onNavigate: (item: NavItem) => void;
  collapsed?: boolean;
}

const NAV_ITEMS: { id: NavItem; label: string; icon: typeof IconCpu }[] = [
  { id: 'dashboard', label: 'Dashboard',        icon: IconUser },
  { id: 'plugin',    label: 'Plugin Framework', icon: IconCpu },
  { id: 'settings',  label: 'System Settings',  icon: IconSettings },
];

const EXTRA_ITEMS: { label: string; icon: typeof IconCode }[] = [
  { label: 'Plugin Keys',     icon: IconKey },
  { label: 'API Access',      icon: IconCode },
  { label: 'Recent Payments', icon: IconReceipt },
];

/** Show the LIVE badge only when a trading session is actually active. */
function useHasLiveSession() {
  const [hasLive, setHasLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      pluginApi.getSessions()
        .then(res => {
          if (!cancelled) setHasLive((res.data.sessions || []).some(s => s.status === 'trading_active'));
        })
        .catch(() => {});
    };
    check();
    const id = setInterval(check, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return hasLive;
}

export default function Sidebar({ active, onNavigate, collapsed }: SidebarProps) {
  const { user, logout } = useAuth();
  const hasLive = useHasLiveSession();

  return (
    <aside className={`flex h-full shrink-0 flex-col border-r border-slate-200/80 bg-white transition-[width] duration-200 ease-out ${collapsed ? 'w-16' : 'w-64'}`}>
      <div className={`flex h-16 shrink-0 items-center border-b border-slate-100 ${collapsed ? 'justify-center px-2' : 'px-5'}`}>
        {collapsed ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#0B4195] to-[#126DFB] text-sm font-bold text-white" aria-hidden="true">
            M
          </div>
        ) : (
          <img src="./Mintzy%20Bars%20Full%20Lockup%20Green.png" alt="Mintzy" className="h-7 w-auto object-contain" />
        )}
      </div>

      <nav aria-label="Main navigation"
        className={`flex flex-1 flex-col gap-1 overflow-y-auto py-3 ${collapsed ? 'items-center px-2' : 'px-3'}`}>
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          if (collapsed) {
            return (
              <button key={id} type="button" onClick={() => onNavigate(id)}
                aria-label={label} aria-current={isActive ? 'page' : undefined} title={label}
                className={`relative flex items-center justify-center rounded-xl p-2.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
                  isActive ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                }`}>
                <Icon className="h-5 w-5" stroke={1.75} aria-hidden="true" />
                {id === 'plugin' && hasLive && (
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" aria-hidden="true" />
                )}
              </button>
            );
          }
          return (
            <button key={id} type="button" onClick={() => onNavigate(id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
                isActive
                  ? 'border-l-[3px] border-blue-600 bg-blue-50 pl-[9px] font-semibold text-blue-700'
                  : 'border-l-[3px] border-transparent font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-3">
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} stroke={1.75} aria-hidden="true" />
                {label}
              </span>
              {id === 'plugin' && hasLive && (
                <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">LIVE</span>
              )}
            </button>
          );
        })}

        {!collapsed && (
          <>
            <div className="my-2 border-t border-slate-100" role="separator" />
            {EXTRA_ITEMS.map(({ label, icon: Icon }) => (
              <div key={label}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-400 cursor-not-allowed opacity-70"
                title="Coming soon"
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0" stroke={1.75} aria-hidden="true" />
                  {label}
                </span>
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400">Soon</span>
              </div>
            ))}
          </>
        )}
      </nav>

      <div className={`shrink-0 border-t border-slate-100 ${collapsed ? 'flex flex-col items-center gap-1 px-2 py-3' : 'p-3'}`}>
        {collapsed ? (
          <>
            <div title={user?.name}><UserAvatar name={user?.name || 'U'} size="md" /></div>
            <button onClick={logout} aria-label="Log out" title="Log out"
              className="rounded-xl p-2.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30">
              <IconLogout className="h-5 w-5" stroke={1.75} aria-hidden="true" />
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 px-2 pb-3 pt-1">
              <UserAvatar name={user?.name || 'U'} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{user?.name}</p>
                <p className="truncate text-xs text-slate-500">{user?.email}</p>
              </div>
            </div>
            <button type="button" onClick={logout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
            >
              <IconLogout className="h-4 w-4" stroke={1.75} aria-hidden="true" />
              Log out
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
