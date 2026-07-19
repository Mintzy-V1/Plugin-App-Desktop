import { useEffect, useState } from 'react';
import { useToast } from '../components/ui/Toast';

interface MintzyBridge {
  app?: { getVersion: () => Promise<string> };
  system?: {
    getAutoLaunch: () => Promise<boolean>;
    setAutoLaunch: (enable: boolean) => Promise<{ success: boolean }>;
    getMinimizeToTray: () => Promise<boolean>;
    setMinimizeToTray: (enable: boolean) => Promise<{ success: boolean }>;
  };
}

const bridge = (window as unknown as { mintzy?: MintzyBridge }).mintzy;

export default function SettingsPage() {
  const toast = useToast();
  const [autoLaunch, setAutoLaunch] = useState<boolean | null>(null);
  const [minimizeToTray, setMinimizeToTray] = useState<boolean | null>(null);
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    bridge?.system?.getAutoLaunch().then(setAutoLaunch).catch(() => setAutoLaunch(false));
    bridge?.system?.getMinimizeToTray().then(setMinimizeToTray).catch(() => setMinimizeToTray(true));
    bridge?.app?.getVersion().then(setVersion).catch(() => {});
  }, []);

  const toggleAutoLaunch = async () => {
    if (autoLaunch === null || !bridge?.system) return;
    const next = !autoLaunch;
    setAutoLaunch(next);
    try {
      await bridge.system.setAutoLaunch(next);
      toast.success(next ? 'Mintzy will open at startup' : 'Auto-launch disabled');
    } catch {
      setAutoLaunch(!next);
      toast.error('Could not update the startup setting');
    }
  };

  const toggleMinimizeToTray = async () => {
    if (minimizeToTray === null || !bridge?.system) return;
    const next = !minimizeToTray;
    setMinimizeToTray(next);
    try {
      await bridge.system.setMinimizeToTray(next);
      toast.success(next ? 'Closing will minimize to the tray' : 'Closing will quit the app');
    } catch {
      setMinimizeToTray(!next);
      toast.error('Could not update the tray setting');
    }
  };

  const desktopUnavailable = !bridge?.system;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">App preferences</p>
      </div>

      {desktopUnavailable && (
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50 p-4 text-sm text-amber-700">
          Desktop settings are only available in the installed app.
        </div>
      )}

      <div className="space-y-3">
        <SettingRow label="Auto-launch on startup" description="Open Mintzy when you log into Windows"
          checked={autoLaunch} disabled={desktopUnavailable} onToggle={toggleAutoLaunch} />
        <SettingRow label="Minimize to tray" description="Close button hides to system tray instead of quitting"
          checked={minimizeToTray} disabled={desktopUnavailable} onToggle={toggleMinimizeToTray} />
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">About</p>
        <div className="mt-3 space-y-1.5 text-xs text-slate-500">
          <p>Mintzy Plugin Desktop{version ? ` · v${version}` : ''}</p>
          <p>
            Need to change your plan or manage billing? Visit{' '}
            <a href="https://mintzy.in" target="_blank" rel="noreferrer"
              className="font-medium text-blue-600 underline underline-offset-2 transition-colors hover:text-blue-700">
              the Mintzy website
            </a>.
          </p>
        </div>
      </div>
    </div>
  );
}

function SettingRow({ label, description, checked, disabled, onToggle }: {
  label: string;
  description: string;
  checked: boolean | null;
  disabled?: boolean;
  onToggle: () => void;
}) {
  const isOn = checked === true;
  const isLoading = checked === null;
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div>
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>
      <button type="button" role="switch" aria-checked={isOn} aria-label={label}
        disabled={disabled || isLoading} onClick={onToggle}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-50 ${
          isOn ? 'bg-blue-600' : 'bg-slate-200'
        }`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-slate-200/50 transition-transform ${
          isOn ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`} style={{ left: 0 }} />
      </button>
    </div>
  );
}
