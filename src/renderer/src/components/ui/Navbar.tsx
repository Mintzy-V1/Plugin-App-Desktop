import { IconMenu2 } from '@tabler/icons-react';

interface Props {
  onToggleSidebar?: () => void;
  sidebarCollapsed?: boolean;
  title?: string;
}

export default function Navbar({ onToggleSidebar, sidebarCollapsed, title }: Props) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-sm sm:px-6">
      {onToggleSidebar && (
        <button onClick={onToggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!sidebarCollapsed}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40">
          <IconMenu2 className="h-5 w-5" stroke={1.75} aria-hidden="true" />
        </button>
      )}
      {title && <h1 className="text-sm font-semibold text-slate-900">{title}</h1>}
    </header>
  );
}
