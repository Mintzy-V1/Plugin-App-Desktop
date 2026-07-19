import React from 'react';
import { useAuth } from '../../context/AuthContext';

export type NavItem = 'plugin' | 'dashboard' | 'settings';

interface SidebarProps {
  active: NavItem;
  onNavigate: (item: NavItem) => void;
}

const navItems: { key: NavItem; label: string }[] = [
  { key: 'plugin', label: 'Plugin Terminal' },
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'settings', label: 'Settings' },
];

export default function Sidebar({ active, onNavigate }: SidebarProps) {
  const { user, logout } = useAuth();

  return (
    <div style={{
      width: 220, background: '#fff', borderRight: '1px solid #e2e8f0',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #e2e8f0' }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Mintzy</h1>
        <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
          {user?.email}
        </p>
      </div>

      <nav style={{ flex: 1, padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {navItems.map((item) => (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 8,
              border: 'none', textAlign: 'left', cursor: 'pointer',
              fontSize: 14, fontWeight: active === item.key ? 600 : 400,
              background: active === item.key ? '#eff6ff' : 'transparent',
              color: active === item.key ? '#1d4ed8' : '#334155',
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div style={{ padding: 12, borderTop: '1px solid #e2e8f0' }}>
        <button
          onClick={logout}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 8,
            border: '1px solid #e2e8f0', background: '#fff',
            cursor: 'pointer', fontSize: 13, color: '#dc2626',
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}
