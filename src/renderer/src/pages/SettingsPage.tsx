import React from 'react';

export default function SettingsPage() {
  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px' }}>Settings</h1>
      <p style={{ color: '#64748b', margin: 0 }}>App preferences</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
        <SettingRow label="Auto-launch on startup" description="Open Mintzy when you log into Windows" />
        <SettingRow label="Minimize to tray" description="Close button hides to system tray instead of quitting" />
      </div>

      <div style={{
        marginTop: 32, padding: 16, borderRadius: 12,
        border: '1px solid #e2e8f0', background: '#fef2f2',
      }}>
        <p style={{ margin: 0, color: '#dc2626', fontSize: 13 }}>
          Need to change your plan or manage billing? Visit the Mintzy website.
        </p>
      </div>
    </div>
  );
}

function SettingRow({ label, description }: { label: string; description: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px 20px', borderRadius: 12, border: '1px solid #e2e8f0',
      background: '#fff',
    }}>
      <div>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{label}</p>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>{description}</p>
      </div>
      <div style={{
        width: 44, height: 24, borderRadius: 12, background: '#cbd5e1',
        position: 'relative', cursor: 'pointer',
      }}>
        <div style={{
          width: 20, height: 20, borderRadius: '50%', background: '#fff',
          position: 'absolute', top: 2, left: 2,
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        }} />
      </div>
    </div>
  );
}
