import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { onboard } from '../lib/gateway';
import { pluginErrorMessage } from '../lib/pluginErrors';
import { clearAccountClientState } from '../lib/accountReset';

interface User {
  id: string;
  name: string;
  email: string;
  broker?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (apiKey: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const accountIdRef = useRef<string | null>(null);

  const resetAccountState = useCallback(() => {
    clearAccountClientState();
    accountIdRef.current = null;
  }, []);

  const adoptUser = useCallback((next: User) => {
    if (accountIdRef.current && accountIdRef.current !== next.id) {
      clearAccountClientState();
    }
    accountIdRef.current = next.id;
    setUser(next);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('mintzy_token');

    if (saved) {
      setToken(saved);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!token || user) return;
    const parts = token.split('.');
    if (parts.length === 3) {
      try {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.userId && payload.email) {
          adoptUser({
            id: payload.userId,
            name: payload.name,
            email: payload.email,
            broker: payload.broker ? String(payload.broker).toLowerCase() : undefined,
          });
          return;
        }
      } catch {}
    }
    // Token can't be hydrated into a user; clear it so we don't get stuck
    // showing the login page with a stale token in storage.
    localStorage.removeItem('mintzy_token');
    setToken(null);
    setUser(null);
  }, [token, user, adoptUser]);

  const login = useCallback(async (apiKey: string) => {
    try {
      const res = await onboard(apiKey);
      if (res.success && res.jwt) {
        localStorage.setItem('mintzy_token', res.jwt);
        setToken(res.jwt);
        if (res.user) {
          adoptUser({
            id: res.user.id,
            name: res.user.name,
            email: res.user.email,
            broker: res.broker ? String(res.broker).toLowerCase() : undefined,
          });
        }
        return { success: true };
      }
      return { success: false, error: pluginErrorMessage({ response: { data: { message: res.message } } }, 'Invalid API key. Check your key and try again.') };
    } catch (err: any) {
      return { success: false, error: pluginErrorMessage(err, 'Could not reach Mintzy. Check your internet connection and try again.') };
    }
  }, [adoptUser]);

  const logout = useCallback(() => {
    resetAccountState();
    localStorage.removeItem('mintzy_token');
    setToken(null);
    setUser(null);
    void window.mintzy?.auth?.logout?.();
  }, [resetAccountState]);

  useEffect(() => {
    const onExpired = () => logout();
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, [logout]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
