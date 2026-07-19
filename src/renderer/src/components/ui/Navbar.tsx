import { IconMenu2 } from '@tabler/icons-react';

interface Props {
  onToggleSidebar?: () => void;
}

export default function Navbar({ onToggleSidebar }: Props) {
  return (
    <nav className="w-full bg-white/90 sticky top-0 z-50 border-b border-gray-100/50 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
        {onToggleSidebar && (
          <button onClick={onToggleSidebar}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700">
            <IconMenu2 className="h-5 w-5" stroke={1.75} />
          </button>
        )}
        <img src="./Mintzy%20Bars%20Full%20Lockup%20Green.png" alt="Mintzy" className="h-8 w-auto object-contain" />
      </div>
    </nav>
  );
}
