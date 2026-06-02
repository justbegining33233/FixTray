'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';

export default function SystemSettings() {
  const { user, isLoading } = useRequireAuth(['admin', 'superadmin']);
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);

  useEffect(() => {
    if (user) loadSettings();
  }, [user]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  const loadSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setSettings(data.settings);
    } catch { showToast('error', 'Failed to load settings'); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (res.ok) { setSettings(data.settings); showToast('success', 'Settings saved successfully!'); }
      else showToast('error', data.error || 'Failed to save');
    } catch { showToast('error', 'Failed to save settings'); }
    finally { setSaving(false); }
  };

  const handleReset = async () => {
    setResetConfirm(false);
    setResetting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/settings', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) { setSettings(data.settings); showToast('success', 'Settings reset to defaults'); }
    } catch { showToast('error', 'Reset failed'); }
    finally { setResetting(false); }
  };

  const set = (key: string, value: any) => setSettings((prev: any) => ({ ...prev, [key]: value }));

  const fieldStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#e5e7eb', fontSize: 14 };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, color: '#9aa3b2', marginBottom: 6, fontWeight: 500 };
  const cardStyle: React.CSSProperties = { background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 24, marginBottom: 24 };

  const toggleRow = (label: string, key: string, description?: string) => (
    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, marginBottom: 10 }}>
      <div>
        <div style={{ color: '#e5e7eb', fontSize: 14, fontWeight: 500 }}>{label}</div>
        {description && <div style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>{description}</div>}
      </div>
      <div onClick={() => set(key, !settings[key])} style={{ width: 44, height: 24, borderRadius: 12, cursor: 'pointer', transition: 'background 0.2s', background: settings?.[key] ? '#22c55e' : '#4b5563', position: 'relative', flexShrink: 0 }}>
        <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, transition: 'left 0.2s', left: settings?.[key] ? 23 : 3 }} />
      </div>
    </div>
  );

  if (isLoading || !settings) {
    return (
      <div style={{ minHeight: "100vh", background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb', fontSize: 18 }}>
        {isLoading ? 'Loading...' : 'Loading settings...'}
      </div>
    );
  }
  if (!user) return null;

  return (
    <div style={{ minHeight: "100vh", background: 'transparent' }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '12px 20px', borderRadius: 8, fontWeight: 600, fontSize: 14, background: toast.type === 'success' ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)', color: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
          {toast.type === 'success' ? '? ' : '? '}{toast.text}
        </div>
      )}
      <div style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(107,114,128,0.3)', padding: '20px 32px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <Link href="/admin/home" style={{ color: '#e5332a', textDecoration: 'none', fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'inline-block' }}>? Back to Dashboard</Link>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', marginBottom: 4 }}>?? System Settings</h1>
          <p style={{ fontSize: 13, color: '#9aa3b2' }}>Configure platform-wide settings and feature flags</p>
        </div>
      </div>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 32px' }}>
        <div style={cardStyle}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e5e7eb', marginBottom: 20 }}>General</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>Platform Name</label>
              <input style={fieldStyle} value={settings.platformName || ''} onChange={e => set('platformName', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Support Email</label>
              <input style={fieldStyle} type="email" value={settings.supportEmail || ''} onChange={e => set('supportEmail', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Timezone</label>
              <select style={fieldStyle} value={settings.timezone || 'America/New_York'} onChange={e => set('timezone', e.target.value)}>
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="America/Phoenix">Arizona (MST, no DST)</option>
                <option value="America/Anchorage">Alaska (AKT)</option>
                <option value="Pacific/Honolulu">Hawaii (HST)</option>
              </select>
            </div>
            
            <div>
              <label style={labelStyle}>Service Fee (cents per work order)</label>
              <input style={fieldStyle} type="number" min={0} value={settings.serviceFee ?? 500} onChange={e => set('serviceFee', Number(e.target.value))} />
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>= ${((settings.serviceFee ?? 500) / 100).toFixed(2)} per work order</div>
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e5e7eb', marginBottom: 16 }}>Feature Flags</h2>
          {toggleRow('Maintenance Mode', 'maintenanceMode', 'Blocks all non-admin logins when enabled')}
          {toggleRow('Shop Registration', 'enableShopRegistration', 'Allow new shops to register on the platform')}
          {toggleRow('Customer Portal', 'enableCustomerPortal', 'Customer-facing portal for tracking orders')}
          {toggleRow('Email Notifications', 'enableEmailNotifications', 'System emails for approvals, order updates, etc.')}
          {toggleRow('SMS Notifications', 'enableSmsNotifications', 'Text message alerts (requires Twilio setup)')}
        </div>

        {settings.maintenanceMode && (
          <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 10, padding: '14px 18px', marginBottom: 24, color: '#fca5a5', fontSize: 14 }}>
            ?? <strong>Maintenance mode is ON.</strong> Non-admin users will be blocked from logging in.
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => setResetConfirm(true)} disabled={resetting} style={{ padding: '11px 22px', background: 'transparent', color: '#9aa3b2', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: resetting ? 'not-allowed' : 'pointer' }}>
            {resetting ? 'Resetting...' : 'Reset to Defaults'}
          </button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '11px 28px', background: saving ? '#16a34a80' : '#22c55e', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving...' : '?? Save Changes'}
          </button>
        </div>
      </div>
      {resetConfirm && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
          <div style={{background:'#1e2533',borderRadius:14,padding:32,minWidth:320,maxWidth:420,boxShadow:'0 8px 32px rgba(0,0,0,0.5)'}}>
            <h3 style={{fontSize:18,fontWeight:700,color:'#e5e7eb',marginBottom:12}}>Reset to Defaults?</h3>
            <p style={{fontSize:14,color:'#9aa3b2',marginBottom:24}}>This will reset all settings to their default values. This action cannot be undone.</p>
            <div style={{display:'flex',gap:12}}>
              <button onClick={handleReset} style={{flex:1,padding:'10px 0',background:'#ef4444',color:'#fff',border:'none',borderRadius:8,fontSize:14,fontWeight:700,cursor:'pointer'}}>Reset</button>
              <button onClick={()=>setResetConfirm(false)} style={{flex:1,padding:'10px 0',background:'transparent',color:'#9aa3b2',border:'1px solid rgba(255,255,255,0.15)',borderRadius:8,fontSize:14,cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

