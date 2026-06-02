'use client';
import { useState, useEffect } from 'react';
import useRequireAuth from '@/lib/useRequireAuth';
import { FaBriefcase, FaCalendarAlt, FaCar, FaChartBar, FaCircle, FaCog, FaCreditCard, FaEnvelope, FaMobileAlt, FaPlug, FaRegCircle, FaWrench } from 'react-icons/fa';

interface IntegrationConfig {
  id: string;
  provider: string;
  isEnabled: boolean;
  lastSync?: string;
  settings?: Record<string, string>;
}

const PROVIDERS = [
  { key: 'quickbooks', name: 'QuickBooks Online', icon: <FaChartBar style={{marginRight:4}} />, description: 'Sync invoices, payments, and customers bidirectionally', color: '#2CA01C', fields: [{ k: 'clientId', label: 'Client ID' }, { k: 'clientSecret', label: 'Client Secret', type: 'password' }, { k: 'realmId', label: 'Realm ID' }] },
  { key: 'xero', name: 'Xero', icon: <FaBriefcase style={{marginRight:4}} />, description: 'Export invoices and contacts to Xero accounting', color: '#1AB4D7', fields: [{ k: 'clientId', label: 'Client ID' }, { k: 'clientSecret', label: 'Client Secret', type: 'password' }] },
  { key: 'google_calendar', name: 'Google Calendar', icon: <FaCalendarAlt style={{marginRight:4}} />, description: 'Sync appointments with Google Calendar', color: '#4285F4', fields: [{ k: 'calendarId', label: 'Calendar ID' }, { k: 'serviceAccountJson', label: 'Service Account JSON', type: 'password' }] },
  { key: 'stripe', name: 'Stripe', icon: <FaCreditCard style={{marginRight:4}} />, description: 'Accept online payments via Stripe', color: '#635BFF', fields: [{ k: 'publishableKey', label: 'Publishable Key' }, { k: 'secretKey', label: 'Secret Key', type: 'password' }, { k: 'webhookSecret', label: 'Webhook Secret', type: 'password' }] },
  { key: 'twilio', name: 'Twilio', icon: <FaMobileAlt style={{marginRight:4}} />, description: 'Send SMS notifications and reminders', color: '#F22F46', fields: [{ k: 'accountSid', label: 'Account SID' }, { k: 'authToken', label: 'Auth Token', type: 'password' }, { k: 'fromNumber', label: 'From Number' }] },
  { key: 'sendgrid', name: 'SendGrid', icon: <FaEnvelope style={{marginRight:4}} />, description: 'Send transactional emails and campaigns', color: '#1A82E2', fields: [{ k: 'apiKey', label: 'API Key', type: 'password' }, { k: 'fromEmail', label: 'From Email' }, { k: 'fromName', label: 'From Name' }] },
  { key: 'carfax', name: 'CARFAX', icon: <FaCar style={{marginRight:4}} />, description: 'Pull vehicle history reports automatically', color: '#E31837', fields: [{ k: 'dealerCode', label: 'Dealer Code' }, { k: 'username', label: 'Username' }, { k: 'password', label: 'Password', type: 'password' }] },
  { key: 'alldata', name: 'ALLDATA', icon: <FaWrench style={{marginRight:4}} />, description: 'Access repair procedures and labor times', color: '#FF6600', fields: [{ k: 'username', label: 'Username' }, { k: 'password', label: 'Password', type: 'password' }] },
];

export default function IntegrationsPage() {
  const { user, isLoading } = useRequireAuth(['shop']);
  const [configs, setConfigs] = useState<IntegrationConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [formFields, setFormFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const r = await fetch('/api/integrations', { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setConfigs(await r.json());
    setLoading(false);
  };

  useEffect(() => { if (!user) return; load(); }, [user]);

  const openEdit = (key: string) => {
    const existing = configs.find(c => c.provider === key);
    setFormFields(existing?.settings || {});
    setEditing(key);
  };

  const save = async (provider: string, isEnabled: boolean) => {
    setSaving(true);
    const token = localStorage.getItem('token');
    const r = await fetch('/api/integrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ provider, isEnabled, settings: formFields }),
    });
    if (!r.ok) {
      setSaving(false);
      return;
    }
    setEditing(null);
    load();
    setSaving(false);
  };

  const toggle = async (provider: string) => {
    const existing = configs.find(c => c.provider === provider);
    const token = localStorage.getItem('token');
    await fetch('/api/integrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ provider, isEnabled: !existing?.isEnabled }),
    });
    load();
  };

  if (isLoading) return <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  return (
    <div className="centered-app-page" style={{ minHeight: '100vh', background: 'transparent', color: '#e5e7eb', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}><FaPlug style={{marginRight:4}} /> Integrations</h1>
        <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: 14 }}>Connect your shop with accounting, payments, communications, and data services</p>
      </div>

      <div style={{ padding: 32 }}>
        {loading ? <div style={{ color: '#6b7280' }}>Loading...</div> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
            {PROVIDERS.map(prov => {
              const config = configs.find(c => c.provider === prov.key);
              const isEnabled = config?.isEnabled || false;
              const isEditing = editing === prov.key;

              return (
                <div key={prov.key} style={{ background: 'rgba(255,255,255,0.04)', border: `2px solid ${isEnabled ? prov.color + '50' : 'rgba(255,255,255,0.08)'}`, borderRadius: 14, padding: 20, transition: 'border-color 0.2s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ width: 44, height: 44, background: `${prov.color}20`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, border: `1px solid ${prov.color}30` }}>{prov.icon}</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{prov.name}</div>
                        {config?.lastSync && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Last sync: {new Date(config.lastSync).toLocaleDateString()}</div>}
                      </div>
                    </div>
                    <button onClick={() => toggle(prov.key)}
                      style={{ background: isEnabled ? `${prov.color}25` : 'rgba(107,114,128,0.2)', color: isEnabled ? prov.color : '#9ca3af', border: `1px solid ${isEnabled ? prov.color : '#6b7280'}`, borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      {isEnabled ? <><FaCircle style={{marginRight:4}} /> Connected</> : <><FaRegCircle style={{marginRight:4}} /> Disabled</>}
                    </button>
                  </div>

                  <p style={{ color: '#9ca3af', fontSize: 13, margin: '0 0 12px', lineHeight: 1.5 }}>{prov.description}</p>

                  {isEditing ? (
                    <div>
                      {prov.fields.map(f => (
                        <div key={f.k} style={{ marginBottom: 10 }}>
                          <label style={{ fontSize: 12, color: '#9ca3af', display: 'block', marginBottom: 4 }}>{f.label}</label>
                          <input type={f.type || 'text'} value={formFields[f.k] || ''} onChange={e => setFormFields(p => ({ ...p, [f.k]: e.target.value }))} placeholder={f.type === 'password' ? '--------' : ''}
                            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 7, padding: '8px 12px', color: '#e5e7eb', fontSize: 13, boxSizing: 'border-box' }} />
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button onClick={() => save(prov.key, true)} disabled={saving} style={{ flex: 1, background: prov.color, color: '#fff', border: 'none', borderRadius: 7, padding: '8px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{saving ? '...' : 'Save & Connect'}</button>
                        <button onClick={() => setEditing(null)} style={{ background: 'transparent', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 7, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => openEdit(prov.key)} style={{ width: '100%', background: 'rgba(255,255,255,0.06)', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      {config ? <><FaCog style={{marginRight:4}} /> Configure</> : '+ Connect'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
