'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useEffect, useState, type FormEvent } from 'react';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import Breadcrumbs from '@/components/Breadcrumbs';
import { useRequireAuth } from '@/contexts/AuthContext';
import { validateWorkOrderTemplate } from '@/lib/shopFormValidation';
import { FaClipboardList, FaDollarSign, FaStopwatch, FaWrench } from 'react-icons/fa';

interface WorkOrderTemplate {
  id: string;
  name: string;
  serviceType: string;
  description: string;
  estimatedCost: number;
  laborHours: number;
  createdAt: string;
}

export default function ManagerTemplatesPage() {
  const say = usePhrase();
  const { user, isLoading } = useRequireAuth(['manager']);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [templates, setTemplates] = useState<WorkOrderTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [services, setServices] = useState<string[]>([]);
  const [form, setForm] = useState({ name: '', serviceType: '', description: '' });

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    const shopId = user.shopId || '';
    const [templatesRes, servicesRes] = await Promise.all([
      fetch('/api/shop/templates', { headers }),
      fetch(`/api/services?shopId=${encodeURIComponent(shopId)}`, { headers }),
    ]);
    if (templatesRes.ok) {
      const d = await templatesRes.json();
      setTemplates(Array.isArray(d.templates) ? d.templates : Array.isArray(d) ? d : []);
    }
    if (servicesRes.ok) {
      const data = await servicesRes.json().catch(() => ({}));
      const names = Array.from(new Set<string>((data.services || []).map((svc: { serviceName?: string; name?: string }) => String(svc.serviceName || svc.name || '').trim()).filter(Boolean)));
      setServices(names);
      setForm((current) => ({ ...current, serviceType: current.serviceType || names[0] || '' }));
    }
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const createTemplate = async (event: FormEvent) => {
    event.preventDefault();
    const check = validateWorkOrderTemplate(form);
    if (!check.ok) { setFormError(check.error); return; }
    setSaving(true);
    setFormError('');
    const token = localStorage.getItem('token');
    const res = await fetch('/api/shop/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setFormError(data.error || 'Could not create template'); return; }
    setShowForm(false);
    setForm({ name: '', serviceType: services[0] || '', description: '' });
    load();
  };

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>{say("Loading...")}</div>;
  if (!user) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#000000' }}>
      <Sidebar role="manager" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopNavBar onMenuToggle={() => setSidebarOpen(o => !o)} showMenuButton />
        <main style={{ flex: 1, padding: 24, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
          <Breadcrumbs />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 24px' }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', margin: 0 }}>{say("Work Order Templates")}</h1>
            <button type="button" onClick={() => { setShowForm((open) => !open); setFormError(''); }} style={{ padding: '10px 16px', background: '#e5332a', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>{showForm ? say("Close") : say("Create Template")}</button>
          </div>
          {showForm && (
            <form onSubmit={createTemplate} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 20, marginBottom: 20, display: 'grid', gap: 12 }}>
              <p style={{ margin: 0, color: '#9aa3b2', fontSize: 13 }}>{say("Managers can create templates for this shop. Name and service type are required.")}</p>
              <input required aria-label={say("Template name")} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={say("Template name")} style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#e5e7eb' }} />
              {services.length > 0 ? (
                <select required aria-label={say("Service type")} value={form.serviceType} onChange={(e) => setForm((f) => ({ ...f, serviceType: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: '#111', color: '#e5e7eb' }}>
                  {services.map((name) => <option key={name} value={name}>{say(name)}</option>)}
                </select>
              ) : (
                <input required aria-label={say("Service type")} value={form.serviceType} onChange={(e) => setForm((f) => ({ ...f, serviceType: e.target.value }))} placeholder={say("Service type")} style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#e5e7eb' }} />
              )}
              <textarea aria-label={say("Description")} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder={say("Description")} style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#e5e7eb' }} />
              {formError && <div style={{ color: '#fca5a5', fontSize: 13 }}>{say(formError)}</div>}
              <button type="submit" disabled={saving} style={{ padding: '10px 16px', background: '#e5332a', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>{saving ? say("Saving...") : say("Save Template")}</button>
            </form>
          )}
          {loading ? (
            <div style={{ textAlign: 'center', color: '#9aa3b2', padding: 40 }}>{say("Loading...")}</div>
          ) : templates.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9aa3b2', padding: 60, background: 'rgba(0,0,0,0.3)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
              <FaClipboardList style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }} />
              <p>{say("No templates created yet. Use Create Template to add one for this shop.")}</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {templates.map(t => (
                <div key={t.id} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 20 }}>
                  <h3 style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 16, marginBottom: 8 }}><FaWrench style={{ marginRight: 6, color: '#e5332a' }} />{say(t.name)}</h3>
                  <p style={{ color: '#9aa3b2', fontSize: 13, marginBottom: 8 }}>{t.description || t.serviceType}</p>
                  <div style={{ display: 'flex', gap: 16, color: '#6b7280', fontSize: 13 }}>
                    <span><FaDollarSign /> ${t.estimatedCost?.toFixed(2) || '0.00'}</span>
                    <span><FaStopwatch /> {t.laborHours || 0}h</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}


