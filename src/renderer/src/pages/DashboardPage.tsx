import { useAuth } from '../context/AuthContext';
import UserAvatar from '../components/ui/UserAvatar';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Welcome back, {user?.name}</p>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <UserAvatar name={user?.name || 'U'} size="lg" />
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{user?.name}</h2>
            <p className="text-sm text-slate-500">{user?.email}</p>
            {user?.broker && (
              <span className="mt-1 inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{user.broker}</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Account</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{user?.email}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Broker</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{user?.broker || 'Not set'}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
          <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
          </svg>
        </div>
        <h3 className="mt-4 text-sm font-semibold text-slate-900">Plugin Summary</h3>
        <p className="mt-1 text-xs text-slate-500">Session history and trading summary coming soon</p>
      </div>
    </div>
  );
}
