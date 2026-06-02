'use client';
import { useState, useEffect, ReactNode } from 'react';
import useRequireAuth from '@/lib/useRequireAuth';
import { FaBolt, FaCalendarAlt, FaCog, FaDollarSign, FaEnvelope, FaMobileAlt, FaStar, FaSyncAlt } from 'react-icons/fa';

interface AutomationRule {
  id: string;
  name: string;
  type: string;
  trigger: string;
  triggerValue?: string;
  channel: string;
  messageTemplate: string;
  isActive: boolean;
  createdAt: string;
  executions?: Array<{
    id: string;
    channel: string;
    status: string;
    sentAt: string;
  }>;
  _count?: { executions: number };
}

const TYPE_LABELS: Record<string, ReactNode> = {
  appointment_reminder: <><FaCalendarAlt style={{marginRight:4}} /> Appointment Reminder</>,
  follow_up: <><FaSyncAlt style={{marginRight:4}} /> Follow-Up</>,
  review_request: <><FaStar style={{marginRight:4}} /> Review Request</>,
  overdue_invoice: <><FaDollarSign style={{marginRight:4}} /> Overdue Invoice</>,
  custom: <><FaCog style={{marginRight:4}} /> Custom</>,
};

const TRIGGER_OPTIONS = [
  { value: 'days_before_appointment', label: 'Days before appointment' },
  { value: 'hours_before_appointment', label: 'Hours before appointment' },
  { value: 'days_after_completion', label: 'Days after job completion' },
  { value: 'days_after_invoice', label: 'Days after invoice sent' },
  { value: 'invoice_overdue_days', label: 'Days invoice is overdue' },
];

const VARIABLE_HINTS = ['{customer_name}', '{vehicle}', '{shop_name}', '{tech_name}', '{appointment_date}', '{appointment_time}', '{amount_due}', '{next_service_date}', '{review_link}'];

export default function AutomationsPage() {
  const { user, isLoading } = useRequireAuth(['shop', 'manager', 'admin']);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AutomationRule | null>(null);
  const [form, setForm] = useState({ name: '', type: 'appointment_reminder', trigger: 'days_before_appointment', triggerValue: '1', channel: 'sms', messageTemplate: '', isActive: true });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [_saveError, _setSaveError] = useState('');

  useEffect(() => { if (!user) return; load(); }, [user]);

  const load = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const r = await fetch('/api/automations', { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) {
      const rows = await r.json();
      const normalized = (Array.isArray(rows) ? rows : []).map((row: any) => ({
        ...row,
        isActive: row.isActive ?? row.active ?? false,
      }));
      setRules(normalized);
    }
    setLoading(false);
  };

  const openEdit = (rule: AutomationRule) => {
    setEditing(rule);
    setForm({ name: rule.name, type: rule.type, trigger: rule.trigger, triggerValue: rule.triggerValue || '1', channel: rule.channel, messageTemplate: rule.messageTemplate, isActive: rule.isActive });
    setShowForm(true);
  };

  const save = async () => {
    setFormError('');
    if (!form.name.trim()) { setFormError('Rule name is required.'); return; }
    if (!form.messageTemplate.trim()) { setFormError('Message template is required.'); return; }
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const method = editing ? 'PUT' : 'POST';
      const url = editing ? `/api/automations/${editing.id}` : '/api/automations';
      const payload = {
        ...form,
        active: form.isActive,
      };
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setFormError(d.error || 'Failed to save automation.'); }
      else { setShowForm(false); setEditing(null); load(); }
    } catch (err: any) {
      setFormError(err?.message || 'Network error.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (rule: AutomationRule) => {
    const token = localStorage.getItem('token');
    await fetch(`/api/automations/${rule.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ isActive: !rule.isActive, active: !rule.isActive }) });
    load();
  };

  const deleteRule = async (id: string) => {
    const token = localStorage.getItem('token');
    await fetch(`/api/automations/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setDeleteConfirmId(null);
    load();
  };

  const insertVar = (v: string) => setForm(p => ({ ...p, messageTemplate: p.messageTemplate + v }));

  if (isLoading) return <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  return (
    <div className="centered-app-page" style={{ minHeight: '100vh', background: 'transparent', color: '#e5e7eb', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}><FaBolt style={{marginRight:4}} /> Automations</h1>
          <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: 14 }}>Automated SMS/email reminders for appointments, follow-ups, and review requests</p>
        </div>
        <button onClick={() => { setEditing(null); setForm({ name: '', type: 'appointment_reminder', trigger: 'days_before_appointment', triggerValue: '1', channel: 'sms', messageTemplate: '', isActive: true }); setShowForm(true); }}
          style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>+ New Rule</button>
      </div>

      <div style={{ padding: 32 }}>
        {loading ? <div style={{ color: '#6b7280' }}>Loading...</div> :
          rules.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 80 }}>
              <div style={{ fontSize: 64 }}><FaBolt style={{marginRight:4}} /></div>
              <div style={{ fontSize: 18, fontWeight: 600, margin: '16px 0 8px' }}>No automation rules yet</div>
              <div style={{ color: '#9ca3af', marginBottom: 24 }}>Set up automated reminders and follow-ups to save time and increase repeat business</div>
              <button onClick={() => setShowForm(true)} style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 28px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>+ Create First Automation</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
              {rules.map(rule => (
                <div key={rule.id} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${rule.isActive ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 12, padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{rule.name}</div>
                      <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>{TYPE_LABELS[rule.type] || rule.type}</div>
                    </div>
                    <button onClick={() => toggleActive(rule)} style={{ background: rule.isActive ? 'rgba(34,197,94,0.2)' : 'rgba(107,114,128,0.2)', color: rule.isActive ? '#22c55e' : '#6b7280', border: `1px solid ${rule.isActive ? '#22c55e' : '#6b7280'}`, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      {rule.isActive ? 'Active' : 'Paused'}
                    </button>
                  </div>
                  <div style={{ fontSize: 13, background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '10px 14px', marginBottom: 10, color: '#d1d5db', fontStyle: 'italic' }}>
                    &ldquo;{rule.messageTemplate.slice(0, 100)}{rule.messageTemplate.length > 100 ? '...' : ''}&rdquo;
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 10 }}>
                     {rule.channel.toUpperCase()}  Trigger: {TRIGGER_OPTIONS.find(t => t.value === rule.trigger)?.label || rule.trigger} {rule.triggerValue ? `(${rule.triggerValue})` : ''}
                    {rule._count && <span style={{ marginLeft: 12 }}> {rule._count.executions} sent</span>}
                  </div>
                  {!!rule.executions?.length && (
                    <div style={{ marginBottom: 10, background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6 }}>Recent Executions</div>
                      <div style={{ display: 'grid', gap: 5 }}>
                        {rule.executions.slice(0, 3).map((exec) => (
                          <div key={exec.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                            <span style={{ color: '#cbd5e1' }}>{exec.channel.toUpperCase()}</span>
                            <span style={{ color: exec.status === 'sent' ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{exec.status.toUpperCase()}</span>
                            <span style={{ color: '#9ca3af' }}>{new Date(exec.sentAt).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => openEdit(rule)} style={{ flex: 1, background: 'rgba(255,255,255,0.08)', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, padding: '6px 0', fontSize: 13, cursor: 'pointer' }}>Edit</button>
                    <button onClick={() => setDeleteConfirmId(rule.id)} style={{ background: 'rgba(229,51,42,0.15)', color: '#e5332a', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 7, padding: '6px 14px', fontSize: 13, cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, overflowY: 'auto', padding: 20 }}>
          <div style={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 28, width: 520, maxWidth: '100%' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18 }}>{editing ? 'Edit Automation' : 'New Automation Rule'}</h3>

            {[{ k: 'name', label: 'Rule Name *', ph: 'Appointment Reminder 1 Day Before' }].map(({ k, label, ph }) => (
              <div key={k} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>{label}</label>
                <input value={(form as any)[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} placeholder={ph}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            ))}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Type</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                  style={{ width: '100%', background: '#374151', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 12px', color: '#e5e7eb', fontSize: 14 }}>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Channel</label>
                <select value={form.channel} onChange={e => setForm(p => ({ ...p, channel: e.target.value }))}
                  style={{ width: '100%', background: '#374151', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 12px', color: '#e5e7eb', fontSize: 14 }}>
                  <option value="sms"><FaMobileAlt style={{marginRight:4}} /> SMS</option>
                  <option value="email"><FaEnvelope style={{marginRight:4}} /> Email</option>
                  <option value="both"><FaMobileAlt style={{marginRight:4}} /><FaEnvelope style={{marginRight:4}} /> Both</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Trigger</label>
                <select value={form.trigger} onChange={e => setForm(p => ({ ...p, trigger: e.target.value }))}
                  style={{ width: '100%', background: '#374151', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 12px', color: '#e5e7eb', fontSize: 14 }}>
                  {TRIGGER_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Value</label>
                <input value={form.triggerValue} onChange={e => setForm(p => ({ ...p, triggerValue: e.target.value }))} type="number" min="1"
                  style={{ width: 80, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 12px', color: '#e5e7eb', fontSize: 14 }} />
              </div>
            </div>

            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 13, color: '#9ca3af' }}>Message Template *</label>
                <span style={{ fontSize: 11, color: '#6b7280' }}>Click to insert variable</span>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                {VARIABLE_HINTS.map(v => (
                  <button key={v} onClick={() => insertVar(v)} style={{ background: 'rgba(229,51,42,0.15)', color: '#ff6b64', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 5, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>{v}</button>
                ))}
              </div>
              <textarea value={form.messageTemplate} onChange={e => setForm(p => ({ ...p, messageTemplate: e.target.value }))} rows={4}
                placeholder="Hi {customer_name}, your appointment for your {vehicle} is tomorrow at {appointment_time}. Reply CONFIRM or call us at (555) 123-4567."
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }} />
            </div>

            {formError && <div style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>{formError}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={save} disabled={saving} style={{ flex: 1, background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Rule'}</button>
              <button onClick={() => { setShowForm(false); setEditing(null); setFormError(''); }} style={{ flex: 1, background: 'transparent', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '11px 0', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 28, maxWidth: 360, width: '90%', textAlign: 'center' }}>
            <h3 style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Delete Rule?</h3>
            <p style={{ color: '#9ca3af', marginBottom: 24 }}>This automation rule will be permanently deleted.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => deleteRule(deleteConfirmId)} style={{ background: '#e5332a', border: 'none', color: '#fff', padding: '10px 24px', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
              <button onClick={() => setDeleteConfirmId(null)} style={{ background: '#374151', border: 'none', color: '#9ca3af', padding: '10px 24px', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

