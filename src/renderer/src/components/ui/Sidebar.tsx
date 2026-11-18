import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Cpu,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { pluginApi } from '../../lib/pluginApi';
import UserAvatar from './UserAvatar';

export type NavItem = 'plugin' | 'dashboard' | 'docs' | 'settings';

interface SidebarProps {
  active: NavItem;
  onNavigate: (item: NavItem) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const NAV_ITEMS: { id: NavItem; label: string; icon: typeof Cpu }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'plugin',    label: 'Launch Terminal', icon: Cpu },
  { id: 'docs',      label: 'Documentation', icon: BookOpen },
  { id: 'settings',  label: 'Settings',  icon: Settings },
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
  const railWidth = collapsed ? 68 : 240;

  return (
    <div className="relative z-30 h-full shrink-0" style={{ width: railWidth }}>
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`absolute inset-y-0 left-0 flex h-full flex-col overflow-hidden border-r border-line bg-surface transition-[width,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          expanded ? 'w-[240px]' : 'w-[68px]'
        } ${collapsed && hovered ? 'shadow-[8px_0_24px_rgba(15,23,42,0.06)]' : ''}`}
      >
        <div className="flex h-16 shrink-0 items-center border-b border-line">
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
                className="ml-auto shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-subtle hover:text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {collapsed
                  ? <PanelLeftOpen className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  : <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />}
              </button>
            </div>
          ) : (
            <button type="button" onClick={onToggleCollapse} aria-label="Expand sidebar" title="Expand sidebar" className="flex w-full items-center justify-center rounded-lg">
              <div className="h-9 w-9 overflow-hidden">
                <img
                  src="./Mintzy%20Bars%20Full%20Lockup%20Green.png"
                  alt="Mintzy"
                  className="h-9 w-auto max-w-none"
                />
              </div>
            </button>
          )}
        </div>

        <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
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
                className={`relative flex h-10 w-full shrink-0 items-center gap-3 rounded-lg px-2.5 text-left transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  isActive
                    ? 'bg-gain-soft font-semibold text-gain'
                    : 'font-medium text-secondary hover:bg-subtle hover:text-ink'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-brand" aria-hidden="true" />
                )}
                <Icon
                  className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-brand' : 'text-muted'}`}
                  strokeWidth={1.75}
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
                    <span className="shrink-0 rounded-md bg-gain-soft px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-gain">
                      Live
                    </span>
                  ) : (
                    <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-brand ring-2 ring-surface" aria-hidden="true" />
                  )
                )}
              </button>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-line px-3 py-4">
          <div className="flex h-12 items-center gap-2.5 px-1">
            <UserAvatar name={user?.name || 'U'} size="sm" />
            <div
              className={`min-w-0 flex-1 transition-opacity duration-200 ${
                expanded ? 'opacity-100' : 'invisible opacity-0'
              }`}
            >
              <p className="truncate text-[13px] font-semibold text-ink">{user?.name}</p>
              <p className="truncate text-[11px] text-muted">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              aria-label="Log out"
              title="Log out"
              className={`shrink-0 rounded-md p-1.5 text-muted transition-all duration-200 hover:bg-loss-soft hover:text-loss focus:outline-none focus-visible:ring-2 focus-visible:ring-loss ${
                expanded ? 'opacity-100' : 'invisible opacity-0'
              }`}
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
          {!expanded && (
            <button
              type="button"
              onClick={logout}
              aria-label="Log out"
              title="Log out"
              className="mt-0.5 flex h-10 w-full items-center justify-start rounded-lg px-2.5 text-muted transition-colors hover:bg-loss-soft hover:text-loss focus:outline-none focus-visible:ring-2 focus-visible:ring-loss"
            >
              <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
