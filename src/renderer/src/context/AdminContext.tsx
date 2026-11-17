import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ADMIN_EXPIRED_EVENT, adminApi, getAdminToken, setAdminToken, type AdminRole } from '../lib/adminApi';
import { pluginErrorMessage } from '../lib/pluginErrors';

export interface AdminIdentity {
  role: AdminRole;
  name: string;
}

interface AdminState {
  admin: AdminIdentity | null;
  /** True while a token from sessionStorage is being checked on startup. */
  checking: boolean;
  adminLogin: (key: string) => Promise<{ success: boolean; error?: string }>;
  adminLogout: () => void;
}

const AdminContext = createContext<AdminState | undefined>(undefined);

/**
 * Admin session, kept apart from the user's AuthContext: separate token,
 * separate API client, and nothing written to localStorage.
 */
export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminIdentity | null>(null);
  const [checking, setChecking] = useState(() => !!getAdminToken());

  // Restore an admin session after a reload (same window only).
  useEffect(() => {
    if (!getAdminToken()) return;
    adminApi.me()
      .then((res) => setAdmin({ role: res.data.role, name: res.data.name }))
      .catch(() => setAdminToken(null))
      .finally(() => setChecking(false));
  }, []);

  const adminLogout = useCallback(() => {
    setAdminToken(null);
    setAdmin(null);
  }, []);

  useEffect(() => {
    const onExpired = () => setAdmin(null);
    window.addEventListener(ADMIN_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(ADMIN_EXPIRED_EVENT, onExpired);
  }, []);

  const adminLogin = useCallback(async (key: string) => {
    try {
      const res = await adminApi.login(key);
      setAdminToken(res.data.token);
      setAdmin({ role: res.data.role, name: res.data.name });
      return { success: true };
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 429) return { success: false, error: 'Too many failed attempts. Try again in 15 minutes.' };
      if (status === 401) return { success: false, error: 'That admin key is not valid or has been revoked.' };
      if (status === 404) return { success: false, error: 'Admin access is not enabled on this server.' };
      return { success: false, error: pluginErrorMessage(err, 'Could not reach Mintzy. Check your internet connection and try again.') };
    }
  }, []);

  return (
    <AdminContext.Provider value={{ admin, checking, adminLogin, adminLogout }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be inside AdminProvider');
  return ctx;
}
