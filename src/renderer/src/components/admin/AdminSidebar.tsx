import { Activity, Users, KeyRound, ListChecks, LogOut, ShieldCheck } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';

export type AdminNavItem = 'live' | 'accounts' | 'keys' | 'audit';

const NAV_ITEMS: { id: AdminNavItem; label: string; icon: typeof Activity; masterOnly?: boolean }[] = [
  { id: 'live', label: 'Live sessions', icon: Activity },
  { id: 'accounts', label: 'Accounts', icon: Users },
  { id: 'keys', label: 'Admin keys', icon: KeyRound, masterOnly: true },
  { id: 'audit', label: 'Audit log', icon: ListChecks, masterOnly: true },
];

export default function AdminSidebar({ active, onNavigate }: { active: AdminNavItem; onNavigate: (item: AdminNavItem) => void }) {
  const { admin, adminLogout } = useAdmin();
  const isMaster = admin?.role === 'master';

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col border-r border-slate-200/70 bg-[#fbfcfd]">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200/60 px-3">
        <img src="./Mintzy%20Bars%20Full%20Lockup%20Green.png" alt="Mintzy" className="h-8 w-auto min-w-0 max-w-[120px] object-contain object-left" />
        <span className="ml-auto rounded-md bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">Admin</span>
      </div>

      <nav aria-label="Admin navigation" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-2">
        {NAV_ITEMS.filter((item) => !item.masterOnly || isMaster).map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex h-10 w-full items-center gap-3 rounded-lg px-2.5 text-left text-[13px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 ${
                isActive ? 'bg-emerald-50/90 font-semibold text-emerald-800' : 'font-medium text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
              }`}
            >
              {isActive && <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-emerald-600" aria-hidden="true" />}
              <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-emerald-600' : 'text-slate-500'}`} strokeWidth={1.75} aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-slate-200/70 px-2 py-2">
        <div className="flex h-12 items-center gap-2.5 px-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white">
            <ShieldCheck className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-slate-900">{admin?.name}</p>
            <p className="truncate text-[11px] text-slate-500">{isMaster ? 'Master key' : 'Admin · read-only'}</p>
          </div>
          <button
            type="button"
            onClick={adminLogout}
            aria-label="Sign out of admin"
            title="Sign out"
            className="shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}
