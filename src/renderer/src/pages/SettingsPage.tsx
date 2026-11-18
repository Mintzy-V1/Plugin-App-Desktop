import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, Download } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Section } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Toggle } from '../components/ui/Field';
import { ThemeToggle } from '../components/ui/ThemeToggle';
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

export default function SettingsPage({ showBilling = true }: { showBilling?: boolean }) {
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
      <PageHeader title="Workspace preferences" subtitle="Appearance, desktop preferences and app updates." />
      <Section title="Appearance" description="Choose a theme, or follow your operating system.">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <p className="text-sm text-secondary">Color theme</p><ThemeToggle />
        </div>
      </Section>
      {desktopUnavailable && <p className="rounded-lg bg-attention-soft px-4 py-3 text-sm text-attention">Desktop settings are only available in the installed app.</p>}
      <Section title="Desktop preferences" description="Control how Mintzy works on your computer.">
        <div className="divide-y divide-line">
          <SettingRow label="Auto-launch on startup" description="Open Mintzy when you log into Windows" checked={autoLaunch} disabled={desktopUnavailable} onToggle={toggleAutoLaunch} />
          <SettingRow label="Minimize to tray" description="Closing the window keeps Mintzy in the tray. Turn this off to quit the app when closing." checked={minimizeToTray} disabled={desktopUnavailable} onToggle={toggleMinimizeToTray} />
          <SettingRow label="Desktop notifications" description="Show system alerts for updates and important events" checked={notifications} disabled={desktopUnavailable} onToggle={toggleNotifications} />
        </div>
      </Section>
      <Section title="App updates" description="Keep your workspace up to date.">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div><p className="text-sm text-ink">Mintzy Plugin Desktop{version ? ` · v${version}` : ''}</p>
            {updateNote && <p role="status" className="mt-2 text-xs text-secondary">{updateNote}</p>}
          </div>
          <div className="flex gap-2">
            {updateReady && <Button onClick={installUpdate} disabled={installing} size="sm">
              {installing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}{installing ? 'Installing…' : 'Install now'}
            </Button>}
            <Button variant="secondary" size="sm" onClick={checkForUpdates} disabled={!bridge?.app?.checkForUpdates || checkingUpdate}>
              <RefreshCw className={`h-3.5 w-3.5 ${checkingUpdate ? 'animate-spin' : ''}`} />{checkingUpdate ? 'Checking…' : 'Check for updates'}
            </Button>
          </div>
        </div>
      </Section>
      {showBilling && <p className="px-1 text-xs text-muted">Manage billing on <a href="https://mintzy.in" target="_blank" rel="noreferrer" className="font-medium text-gain underline underline-offset-4">mintzy.in</a>.</p>}
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
  return <div className="flex items-center justify-between gap-6 px-6 py-5">
    <div><p className="text-sm font-medium text-ink">{label}</p><p className="mt-1 max-w-xl text-xs leading-relaxed text-secondary">{description}</p></div>
    <Toggle label={label} checked={checked === true} disabled={disabled || checked === null} onChange={onToggle} />
  </div>;
}
