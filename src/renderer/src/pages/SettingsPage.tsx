export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">App preferences</p>
      </div>

      <div className="space-y-3">
        <SettingRow label="Auto-launch on startup" description="Open Mintzy when you log into Windows" />
        <SettingRow label="Minimize to tray" description="Close button hides to system tray instead of quitting" />
      </div>

      <div className="rounded-2xl border border-red-200/80 bg-red-50 p-4">
        <p className="text-sm text-red-600">
          Need to change your plan or manage billing?{' '}
          <span className="cursor-default font-medium underline underline-offset-2">Visit the Mintzy website</span>
        </p>
      </div>
    </div>
  );
}

function SettingRow({ label, description }: { label: string; description: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div>
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>
      <div className="relative h-6 w-11 cursor-pointer rounded-full bg-slate-200 transition-colors">
        <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-slate-200/50 transition-transform" />
      </div>
    </div>
  );
}
