import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px' }}>Dashboard</h1>
      <p style={{ color: '#64748b', margin: 0 }}>Welcome back, {user?.name}</p>

      <div style={{ display: 'flex', gap: 16, marginTop: 24, flexWrap: 'wrap' }}>
        <Card title="Account" value={user?.email || ''} />
        <Card title="Broker" value={user?.broker || 'Not set'} />
      </div>

      <div style={{
        marginTop: 24, padding: 32, borderRadius: 12, border: '1px solid #e2e8f0',
        background: '#fff', textAlign: 'center', color: '#94a3b8',
      }}>
        <p style={{ margin: 0, fontSize: 14 }}>Plugin summary and session history coming in Phase 3</p>
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 200, padding: 20, borderRadius: 12,
      border: '1px solid #e2e8f0', background: '#fff',
    }}>
      <p style={{ margin: 0, fontSize: 12, color: '#64748b', fontWeight: 500 }}>{title}</p>
      <p style={{ margin: '8px 0 0', fontSize: 15, fontWeight: 600 }}>{value}</p>
    </div>
  );
}
