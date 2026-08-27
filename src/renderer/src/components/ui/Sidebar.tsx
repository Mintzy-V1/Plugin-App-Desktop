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

  // Peek labels on hover when collapsed. Icons stay pinned to the same x/y so items never jump.
  const expanded = !collapsed || hovered;
  const railWidth = collapsed ? 68 : 220;

  return (
    <div className="relative z-30 h-full shrink-0" style={{ width: railWidth }}>
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`absolute inset-y-0 left-0 flex h-full flex-col overflow-hidden border-r border-slate-200/70 bg-[#fbfcfd] transition-[width,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          expanded ? 'w-[220px]' : 'w-[68px]'
        } ${collapsed && hovered ? 'shadow-[8px_0_24px_rgba(15,23,42,0.06)]' : ''}`}
      >
        <div className="flex h-14 shrink-0 items-center border-b border-slate-200/60">
          {expanded ? (
            <div className="flex w-full items-center gap-2 px-3">
              <img
                src="./Mintzy%20Bars%20Full%20Lockup%20Green.png"
                alt="Mintzy"
                className="h-8 w-auto min-w-0 max-w-[152px] object-contain object-left"
              />
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className="ml-auto shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
              >
                {collapsed
                  ? <IconLayoutSidebarLeftExpand className="h-4 w-4" stroke={1.75} aria-hidden="true" />
                  : <IconLayoutSidebarLeftCollapse className="h-4 w-4" stroke={1.75} aria-hidden="true" />}
              </button>
            </div>
          ) : (
            <div className="flex w-full items-center justify-center">
              <div className="h-9 w-9 overflow-hidden">
                <img
                  src="./Mintzy%20Bars%20Full%20Lockup%20Green.png"
                  alt="Mintzy"
                  className="h-9 w-auto max-w-none"
                />
              </div>
            </div>
          )}
        </div>

        <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-2">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onNavigate(id)}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                title={!expanded ? label : undefined}
                className={`relative flex h-10 w-full shrink-0 items-center gap-3 rounded-lg px-2.5 text-left transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 ${
                  isActive
                    ? 'bg-emerald-50/90 font-semibold text-emerald-800'
                    : 'font-medium text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-emerald-600" aria-hidden="true" />
                )}
                <Icon
                  className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-emerald-600' : 'text-slate-500'}`}
                  stroke={1.75}
                  aria-hidden="true"
                />
                <span
                  className={`min-w-0 flex-1 truncate text-[13px] transition-opacity duration-200 ${
                    expanded ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  {label}
                </span>
                {id === 'plugin' && hasLive && (
                  expanded ? (
                    <span className="shrink-0 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
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

        <div className="shrink-0 border-t border-slate-200/70 px-2 py-2">
          <div className="flex h-12 items-center gap-2.5 px-1">
            <UserAvatar name={user?.name || 'U'} size="sm" />
            <div
              className={`min-w-0 flex-1 transition-opacity duration-200 ${
                expanded ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              <p className="truncate text-[13px] font-semibold text-slate-900">{user?.name}</p>
              <p className="truncate text-[11px] text-slate-500">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              aria-label="Log out"
              title="Log out"
              className={`shrink-0 rounded-md p-1.5 text-slate-400 transition-all duration-200 hover:bg-red-50 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 ${
                expanded ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              <IconLogout className="h-4 w-4" stroke={1.75} aria-hidden="true" />
            </button>
          </div>
          {!expanded && (
            <button
              type="button"
              onClick={logout}
              aria-label="Log out"
              title="Log out"
              className="mt-0.5 flex h-10 w-full items-center justify-start rounded-lg px-2.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
            >
              <IconLogout className="h-[18px] w-[18px]" stroke={1.75} aria-hidden="true" />
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
