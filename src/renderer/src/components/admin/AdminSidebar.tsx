import { useState } from 'react';
import { Activity, Users, KeyRound, ListChecks, Settings, LogOut, ShieldCheck, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';

export type AdminNavItem = 'live' | 'accounts' | 'keys' | 'audit' | 'settings';

const NAV_ITEMS: { id: AdminNavItem; label: string; icon: typeof Activity; masterOnly?: boolean }[] = [
  { id: 'live', label: 'Live sessions', icon: Activity },
  { id: 'accounts', label: 'Accounts', icon: Users },
  { id: 'keys', label: 'Admin keys', icon: KeyRound, masterOnly: true },
  { id: 'audit', label: 'Audit log', icon: ListChecks, masterOnly: true },
  { id: 'settings', label: 'Settings', icon: Settings },
];

interface Props {
  active: AdminNavItem;
  onNavigate: (item: AdminNavItem) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function AdminSidebar({ active, onNavigate, collapsed, onToggleCollapse }: Props) {
  const { admin, adminLogout } = useAdmin();
  const isMaster = admin?.role === 'master';
  const [hovered, setHovered] = useState(false);
  const expanded = !collapsed || hovered;
  const toggle = () => { setHovered(false); onToggleCollapse(); };

  return (
    <div className="relative z-30 h-full shrink-0" style={{ width: collapsed ? 68 : 240 }}>
      <aside
        aria-label="Admin sidebar"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`absolute inset-y-0 left-0 flex h-full flex-col overflow-hidden border-r border-line bg-surface transition-[width,box-shadow] duration-200 ${expanded ? 'w-[240px]' : 'w-[68px]'} ${collapsed && hovered ? 'shadow-lg shadow-overlay/10' : ''}`}
      >
        <div className="flex h-14 shrink-0 items-center border-b border-line">
          {expanded ? (
            <div className="flex w-full items-center gap-2 px-3">
              <img src="./Mintzy%20Bars%20Full%20Lockup%20Green.png" alt="Mintzy" className="h-8 w-auto min-w-0 max-w-[112px] object-contain object-left" />
              <button type="button" onClick={toggle} aria-label={collapsed ? 'Expand admin sidebar' : 'Collapse admin sidebar'} title={collapsed ? 'Expand admin sidebar' : 'Collapse admin sidebar'} aria-expanded={!collapsed} aria-controls="admin-navigation"
                className="ml-auto shrink-0 rounded-md p-1.5 text-muted hover:bg-subtle hover:text-ink focus-visible:ring-2 focus-visible:ring-brand">
                {collapsed ? <PanelLeftOpen className="h-4 w-4" aria-hidden="true" /> : <PanelLeftClose className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          ) : (
            <button type="button" onClick={toggle} aria-label="Expand admin sidebar" title="Expand admin sidebar" aria-expanded={false} aria-controls="admin-navigation" className="flex h-12 w-full items-center justify-center rounded-lg focus-visible:ring-2 focus-visible:ring-brand">
              <span className="h-9 w-9 overflow-hidden"><img src="./Mintzy%20Bars%20Full%20Lockup%20Green.png" alt="Mintzy" className="h-9 w-auto max-w-none" /></span>
            </button>
          )}
        </div>

        <nav id="admin-navigation" aria-label="Admin navigation" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.filter(item => !item.masterOnly || isMaster).map(({ id, label, icon: Icon }) => {
            const isActive = active === id;
            return (
              <button key={id} type="button" onClick={() => onNavigate(id)} aria-label={label} title={!expanded ? label : undefined} aria-current={isActive ? 'page' : undefined}
                className={`relative flex h-10 w-full shrink-0 items-center gap-3 rounded-lg px-2.5 text-left text-[13px] transition-colors focus-visible:ring-2 focus-visible:ring-brand ${isActive ? 'bg-gain-soft font-semibold text-gain' : 'font-medium text-secondary hover:bg-subtle hover:text-ink'}`}>
                {isActive && <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-brand" aria-hidden="true" />}
                <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-brand' : 'text-muted'}`} strokeWidth={1.75} aria-hidden="true" />
                {expanded && <span className="truncate">{label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-line px-3 py-4">
          <div className={`flex items-center ${expanded ? 'h-12 gap-2.5 px-1' : 'justify-center'}`}>
            {expanded && <>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary"><ShieldCheck className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /></div>
              <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-semibold text-ink">{admin?.name}</p><p className="truncate text-[11px] text-muted">Admin</p></div>
            </>}
            <button type="button" onClick={adminLogout} aria-label="Sign out of admin" title="Sign out of admin" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted hover:bg-loss-soft hover:text-loss focus-visible:ring-2 focus-visible:ring-loss">
              <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
