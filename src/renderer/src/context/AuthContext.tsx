import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { onboard } from '../lib/gateway';

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

  useEffect(() => {
    const saved = localStorage.getItem('mintzy_token');
    const devBypass = localStorage.getItem('dev_bypass');

    if (devBypass === 'true') {
      setUser({ id: 'dev_id', name: 'Dev User', email: 'dev@mintzy.in', broker: 'angle one' });
      setToken('dev_token');
    } else if (saved) {
      setToken(saved);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!token || token === 'dev_token' || user) return;
    const parts = token.split('.');
    if (parts.length === 3) {
      try {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.userId && payload.email) {
          setUser({ id: payload.userId, name: payload.name, email: payload.email, broker: payload.broker });
          return;
        }
      } catch {}
    }
    // Token can't be hydrated into a user; clear it so we don't get stuck
    // showing the login page with a stale token in storage.
    localStorage.removeItem('mintzy_token');
    setToken(null);
  }, [token, user]);

  const login = useCallback(async (apiKey: string) => {
    try {
      const res = await onboard(apiKey);
      if (res.success && res.jwt) {
        localStorage.setItem('mintzy_token', res.jwt);
        setToken(res.jwt);
        if (res.user) {
          setUser({ id: res.user.id, name: res.user.name, email: res.user.email, broker: res.broker });
        }
        return { success: true };
      }
      return { success: false, error: res.message || 'Invalid API key' };
    } catch (err: any) {
      return { success: false, error: err?.response?.data?.message || 'Connection error' };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('mintzy_token');
    localStorage.removeItem('dev_bypass');
    setToken(null);
    setUser(null);
  }, []);

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
