import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
const STORAGE_KEY = 'mintzy.theme';
const isPreference = (value: unknown): value is ThemePreference =>
  value === 'system' || value === 'light' || value === 'dark';

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isPreference(value) ? value : 'system';
  } catch { return 'system'; }
}

function applyPreference(preference: ThemePreference) {
  document.documentElement.dataset.theme = preference === 'system'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : preference;
  try { localStorage.setItem(STORAGE_KEY, preference); } catch { /* Settings file remains authoritative. */ }
}

const ThemeContext = createContext<{
  preference: ThemePreference;
  saving: boolean;
  setPreference: (value: ThemePreference) => Promise<void>;
} | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);
  const [saving, setSaving] = useState(false);
  const revision = useRef(0);
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const initialRevision = revision.current;
    window.mintzy?.system?.getTheme?.().then(value => {
      if (!cancelled && revision.current === initialRevision && isPreference(value)) {
        applyPreference(value);
        setPreferenceState(value);
      }
    }).catch(() => { /* Retain cached preference if IPC is unavailable. */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    applyPreference(preference);
    const media = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => { if (preference === 'system') applyPreference('system'); };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [preference]);

  const setPreference = async (next: ThemePreference) => {
    if (inFlight.current || !isPreference(next)) return;
    revision.current += 1;
    inFlight.current = true;
    setSaving(true);
    const previous = preference;
    applyPreference(next);
    setPreferenceState(next);
    try {
      const result = await window.mintzy?.system?.setTheme?.(next);
      if (result && !result.success) throw new Error('Could not save appearance');
    } catch (error) {
      applyPreference(previous);
      setPreferenceState(previous);
      throw error;
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  return <ThemeContext.Provider value={{ preference, saving, setPreference }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme requires ThemeProvider');
  return context;
}
