import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, Download } from 'lucide-react';
import { useToast } from '../components/ui/Toast';

interface UpdateCheckResult {
  status: 'checking' | 'up-to-date' | 'available' | 'downloaded' | 'error';
  version?: string;
  message: string;
}

interface MintzyBridge {
  app?: {
    getVersion: () => Promise<string>;
    checkForUpdates: () => Promise<UpdateCheckResult>;
    installUpdate: () => Promise<{ success: boolean; message?: string }>;
  };
  system?: {
    getAutoLaunch: () => Promise<boolean>;
    setAutoLaunch: (enable: boolean) => Promise<{ success: boolean }>;
    getMinimizeToTray: () => Promise<boolean>;
    setMinimizeToTray: (enable: boolean) => Promise<{ success: boolean }>;
    getNotifications: () => Promise<boolean>;
    setNotifications: (enable: boolean) => Promise<{ success: boolean }>;
  };
}

const bridge = (window as unknown as { mintzy?: MintzyBridge }).mintzy;

export default function SettingsPage() {
  const toast = useToast();
  const [autoLaunch, setAutoLaunch] = useState<boolean | null>(null);
  const [minimizeToTray, setMinimizeToTray] = useState<boolean | null>(null);
  const [notifications, setNotifications] = useState<boolean | null>(null);
  const [version, setVersion] = useState<string>('');
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [updateNote, setUpdateNote] = useState<string | null>(null);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    bridge?.system?.getAutoLaunch().then(setAutoLaunch).catch(() => setAutoLaunch(false));
    bridge?.system?.getMinimizeToTray().then(setMinimizeToTray).catch(() => setMinimizeToTray(true));
    bridge?.system?.getNotifications().then(setNotifications).catch(() => setNotifications(true));
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
      toast.error('Could not update the startup setting. Please try again.');
    }
  };

  const toggleMinimizeToTray = async () => {
    if (minimizeToTray === null || !bridge?.system) return;
    const next = !minimizeToTray;
    setMinimizeToTray(next);
    try {
      await bridge.system.setMinimizeToTray(next);
      toast.success(next ? 'Closing will hide Mintzy in the tray — click the tray icon to reopen' : 'Closing will quit the app completely');
    } catch {
      setMinimizeToTray(!next);
      toast.error('Could not update the tray setting. Please try again.');
    }
  };

  const toggleNotifications = async () => {
    if (notifications === null || !bridge?.system) return;
    const next = !notifications;
    setNotifications(next);
    try {
      await bridge.system.setNotifications(next);
      toast.success(next ? 'Desktop notifications enabled' : 'Desktop notifications disabled');
    } catch {
      setNotifications(!next);
      toast.error('Could not update the notification setting. Please try again.');
    }
  };

  const checkForUpdates = async () => {
    if (!bridge?.app?.checkForUpdates || checkingUpdate) return;
    setCheckingUpdate(true);
    setUpdateNote(null);
    try {
      const result = await bridge.app.checkForUpdates();
      setUpdateNote(result.message);
      setUpdateReady(result.status === 'downloaded');

      if (result.status === 'up-to-date') toast.success(result.message);
      else if (
        result.status === 'available'
        || result.status === 'downloaded'
        || result.status === 'checking'
      ) {
        toast.info(result.message);
      } else {
        toast.error(result.message);
      }
    } catch {
      const msg = 'Could not check for updates. Check your connection and try again.';
      setUpdateNote(msg);
      setUpdateReady(false);
      toast.error(msg);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const installUpdate = async () => {
    if (!bridge?.app?.installUpdate || installing) return;
    setInstalling(true);
    try {
      const result = await bridge.app.installUpdate();
      if (!result.success) {
        toast.error(result.message || 'Could not install the update. Please try again.');
      }
    } catch {
      toast.error('Could not install the update. Please restart the app and try again.');
    } finally {
      setInstalling(false);
    }
  };

  const desktopUnavailable = !bridge?.system;

  return (
    <div className="page-stack">
      {desktopUnavailable && (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
          Desktop settings are only available in the installed app.
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white divide-y divide-slate-100">
        <SettingRow
          label="Auto-launch on startup"
          description="Open Mintzy when you log into Windows"
          checked={autoLaunch}
          disabled={desktopUnavailable}
          onToggle={toggleAutoLaunch}
        />
        <SettingRow
          label="Minimize to tray"
          description="Close (X) hides Mintzy in the system tray. Open it again from the tray icon, or turn this off so X fully quits the app."
          checked={minimizeToTray}
          disabled={desktopUnavailable}
          onToggle={toggleMinimizeToTray}
        />
        <SettingRow
          label="Desktop notifications"
          description="Show system alerts for updates and important events"
          checked={notifications}
          disabled={desktopUnavailable}
          onToggle={toggleNotifications}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white divide-y divide-slate-100">
        <div className="flex items-center justify-between gap-4 px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-slate-900">App updates</p>
            <p className="mt-0.5 text-[12px] text-slate-500">
              Check for a newer version if you missed a notification
            </p>
            {updateNote && (
              <p className="mt-1.5 text-[12px] text-slate-600">{updateNote}</p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {updateReady && (
              <button
                type="button"
                onClick={installUpdate}
                disabled={installing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {installing
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  : <Download className="h-3.5 w-3.5" aria-hidden="true" />}
                {installing ? 'Installing…' : 'Install now'}
              </button>
            )}
            <button
              type="button"
              onClick={checkForUpdates}
              disabled={!bridge?.app?.checkForUpdates || checkingUpdate}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {checkingUpdate
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                : <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
              {checkingUpdate ? 'Checking…' : 'Check for updates'}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3.5">
        <p className="text-[13px] font-semibold text-slate-900">About</p>
        <div className="mt-2 space-y-1 text-[12px] text-slate-500">
          <p>Mintzy Plugin Desktop{version ? ` · v${version}` : ''}</p>
          <p>
            Manage billing on{' '}
            <a href="https://mintzy.in" target="_blank" rel="noreferrer"
              className="font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-800">
              mintzy.in
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
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div>
        <p className="text-[13px] font-semibold text-slate-900">{label}</p>
        <p className="mt-0.5 text-[12px] text-slate-500">{description}</p>
      </div>
      <button type="button" role="switch" aria-checked={isOn} aria-label={label}
        disabled={disabled || isLoading} onClick={onToggle}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50 ${
          isOn ? 'bg-emerald-600' : 'bg-slate-200'
        }`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-slate-200/50 transition-transform ${
          isOn ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`} style={{ left: 0 }} />
      </button>
    </div>
  );
}
