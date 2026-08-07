import { useEffect, useState } from 'react';
import {
  IconLayoutDashboard,
  IconCpu,
  IconSettings,
  IconLogout,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
} from '@tabler/icons-react';
import { useAuth } from '../../context/AuthContext';
import { pluginApi } from '../../lib/pluginApi';
import UserAvatar from './UserAvatar';

export type NavItem = 'plugin' | 'dashboard' | 'settings';

interface SidebarProps {
  active: NavItem;
  onNavigate: (item: NavItem) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const NAV_ITEMS: { id: NavItem; label: string; icon: typeof IconCpu }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: IconLayoutDashboard },
  { id: 'plugin',    label: 'Launch Terminal', icon: IconCpu },
  { id: 'settings',  label: 'Settings',  icon: IconSettings },
];

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

export default function Sidebar({ active, onNavigate, collapsed, onToggleCollapse }: SidebarProps) {
  const { user, logout } = useAuth();
  const hasLive = useHasLiveSession();
  const [hovered, setHovered] = useState(false);

  // Peek labels on hover when collapsed, but never invent extra nav items.
  const showLabels = !collapsed || hovered;
  const railWidth = collapsed ? 68 : 220;

  return (
    <div className="relative z-30 h-full shrink-0" style={{ width: railWidth }}>
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`absolute inset-y-0 left-0 flex h-full flex-col border-r border-slate-200/70 bg-[#fbfcfd] transition-[width,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          showLabels ? 'w-[220px]' : 'w-[68px]'
        } ${collapsed && hovered ? 'shadow-[8px_0_24px_rgba(15,23,42,0.06)]' : ''}`}
      >
        <div className={`flex shrink-0 border-b border-slate-200/60 ${
          showLabels ? 'h-14 items-center justify-between px-4' : 'flex-col items-center gap-1 px-2 py-2'
        }`}>
          {showLabels ? (
            <img src="./Mintzy%20Bars%20Full%20Lockup%20Green.png" alt="Mintzy" className="h-6 w-auto object-contain" />
          ) : (
            <img src="./Mintzy%20Bars%20Iconic%20Mark%20Green.jpg" alt="Mintzy" className="h-8 w-8 rounded-lg object-contain" />
          )}
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
          >
            {collapsed
              ? <IconLayoutSidebarLeftExpand className="h-4 w-4" stroke={1.75} aria-hidden="true" />
              : <IconLayoutSidebarLeftCollapse className="h-4 w-4" stroke={1.75} aria-hidden="true" />}
          </button>
        </div>

        <nav
          aria-label="Main navigation"
          className={`flex flex-1 flex-col gap-0.5 overflow-y-auto py-2 ${showLabels ? 'px-2.5' : 'items-center px-2'}`}
        >
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onNavigate(id)}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                title={!showLabels ? label : undefined}
                className={`relative flex items-center transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 ${
                  showLabels
                    ? `w-full gap-3 rounded-lg px-3 py-2 text-[13px] ${
                        isActive
                          ? 'bg-emerald-50/90 font-semibold text-emerald-800'
                          : 'font-medium text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                      }`
                    : `justify-center rounded-lg p-2.5 ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                      }`
                }`}
              >
                {isActive && showLabels && (
                  <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-emerald-600" aria-hidden="true" />
                )}
                <Icon
                  className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-emerald-600' : ''}`}
                  stroke={1.75}
                  aria-hidden="true"
                />
                {showLabels && <span className="truncate">{label}</span>}
                {id === 'plugin' && hasLive && (
                  showLabels ? (
                    <span className="ml-auto rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
                      Live
                    </span>
                  ) : (
                    <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 ring-2 ring-[#fbfcfd]" aria-hidden="true" />
                  )
                )}
              </button>
            );
          })}
        </nav>

        <div className={`shrink-0 border-t border-slate-200/70 ${showLabels ? 'p-2.5' : 'flex flex-col items-center gap-1 px-2 py-2.5'}`}>
          {showLabels ? (
            <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
              <UserAvatar name={user?.name || 'U'} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-slate-900">{user?.name}</p>
                <p className="truncate text-[11px] text-slate-500">{user?.email}</p>
              </div>
              <button
                type="button"
                onClick={logout}
                aria-label="Log out"
                title="Log out"
                className="shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
              >
                <IconLogout className="h-4 w-4" stroke={1.75} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <>
              <div title={user?.name}><UserAvatar name={user?.name || 'U'} size="sm" /></div>
              <button
                type="button"
                onClick={logout}
                aria-label="Log out"
                title="Log out"
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
              >
                <IconLogout className="h-4 w-4" stroke={1.75} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
