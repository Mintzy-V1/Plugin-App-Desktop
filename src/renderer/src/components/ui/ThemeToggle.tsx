import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemePreference } from '../../context/ThemeContext';
import { useToast } from './Toast';
const options = [{ value: 'system', label: 'System', icon: Monitor }, { value: 'light', label: 'Light', icon: Sun }, { value: 'dark', label: 'Dark', icon: Moon }] as const;
export function ThemeToggle() {
  const { preference, saving, setPreference } = useTheme();
  const toast = useToast();
  const change = (next: ThemePreference) => { void setPreference(next).catch(() => toast.error('Could not save appearance. Please try again.')); };
  return <div role="group" aria-label="Color theme" className="inline-flex gap-1 rounded-lg border border-line bg-subtle p-1">{options.map(({ value, label, icon: Icon }) =>
    <button key={value} type="button" aria-pressed={preference === value} disabled={saving} onClick={() => change(value)} className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${preference === value ? 'bg-surface text-ink' : 'text-secondary hover:text-ink'}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />{label}
    </button>)}</div>;
}
