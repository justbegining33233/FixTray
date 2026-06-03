'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaClipboardList, FaDollarSign, FaStopwatch, FaTools, FaTrash, FaWrench } from 'react-icons/fa';

interface WorkOrderTemplate {
  id: string;
  name: string;
  serviceType: string;
  description: string;
  repairs: string[];
  maintenance: string[];
  estimatedCost: number;
  laborHours: number;
  notes: string;
  createdAt: string;
}

const createBlankForm = (serviceType = '') => ({
  name: '', serviceType, description: '',
  repairs: '', maintenance: '', estimatedCost: '', laborHours: '', notes: '',
});

export default function WorkOrderTemplatesPage() {
  const { user, isLoading } = useRequireAuth(['shop']);
  const [templates, setTemplates] = useState<WorkOrderTemplate[]>([]);
  const [serviceOptions, setServiceOptions] = useState<string[]>([]);
  const [servicesLoaded, setServicesLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(createBlankForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const load = async () => {
    try {
      const shopId = user?.shopId || user?.id;
      const [templatesRes, servicesRes] = await Promise.all([
        fetch('/api/shop/templates', { headers }),
        fetch(`/api/services?shopId=${encodeURIComponent(shopId || '')}`, { headers }),
      ]);

      const templatesData = await templatesRes.json().catch(() => ({}));
      setTemplates(templatesData.templates ?? []);

      if (servicesRes.ok) {
        const servicesData = await servicesRes.json().catch(() => ({}));
        const services = Array.isArray(servicesData?.services) ? servicesData.services : [];
        const names = Array.from(
          new Set(
            services
              .map((svc: any) => String(svc?.serviceName || svc?.name || '').trim())
              .filter(Boolean)
          )
        );
        setServiceOptions(names);
        setForm((prev) => ({
          ...prev,
          serviceType: names.includes(prev.serviceType) ? prev.serviceType : (prev.serviceType || names[0] || ''),
        }));
      } else {
        setServiceOptions([]);
      }
    } catch {
      setError('Failed to load templates');
      setServiceOptions([]);
    } finally {
      setLoading(false);
      setServicesLoaded(true);
    }
  };

  useEffect(() => { if (user) load(); }, [user]);

  const openCreate = () => { setEditId(null); setForm(createBlankForm(serviceOptions[0] || '')); setShowForm(true); };
  const openEdit = (t: WorkOrderTemplate) => {
    setEditId(t.id);
    setForm({
      name: t.name, serviceType: t.serviceType, description: t.description,
      repairs: t.repairs.join('\n'), maintenance: t.maintenance.join('\n'),
      estimatedCost: String(t.estimatedCost), laborHours: String(t.laborHours), notes: t.notes,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.serviceType) { setError('Name and service type are required'); return; }
    setSaving(true); setError(null);
    try {
      const body = {
        name: form.name, serviceType: form.serviceType, description: form.description,
        repairs: form.repairs.split('\n').map(s => s.trim()).filter(Boolean),
        maintenance: form.maintenance.split('\n').map(s => s.trim()).filter(Boolean),
        estimatedCost: parseFloat(form.estimatedCost) || 0,
        laborHours: parseFloat(form.laborHours) || 0,
        notes: form.notes,
      };
      const url = editId ? `/api/shop/templates/${editId}` : '/api/shop/templates';
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSuccess(editId ? 'Template updated!' : 'Template created!');
      setShowForm(false);
      load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string, _name: string) => {
    try {
      await fetch(`/api/shop/templates/${id}`, { method: 'DELETE', headers });
      setSuccess('Template deleted');
      setDeleteConfirmId(null);
      load();
    } catch { setError('Delete failed'); setDeleteConfirmId(null); }
  };

  const bg = 'transparent';
  const serviceSelectOptions = form.serviceType && !serviceOptions.includes(form.serviceType)
    ? [form.serviceType, ...serviceOptions]
    : serviceOptions;

  if (isLoading || loading) {
    return <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  }
  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: bg, padding: '24px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <Link href="/shop/admin" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 13 }}><FaArrowLeft style={{marginRight:4}} /> Admin</Link>
            <h1 style={{ color: '#f1f5f9', fontSize: 26, fontWeight: 700, margin: '4px 0 4px' }}><FaClipboardList style={{marginRight:4}} /> Work Order Templates</h1>
            <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Save common job configurations for quick work order creation</p>
          </div>
          <button onClick={openCreate} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: '#3b82f6', color: 'white', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            + New Template
          </button>
        </div>

        {/* Feedback */}
        {success && <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#86efac', fontSize: 14 }}>{success}</div>}
        {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#fca5a5', fontSize: 14 }}>{error}</div>}

        {/* Template Cards */}
        {templates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#475569' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}><FaClipboardList style={{marginRight:4}} /></div>
            <p style={{ fontSize: 18, marginBottom: 8 }}>No templates yet</p>
            <p style={{ fontSize: 14 }}>Create your first template to speed up work order creation</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {templates.map((t) => (
              <div key={t.id} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 20, border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <h3 style={{ color: '#f1f5f9', fontWeight: 600, margin: '0 0 4px', fontSize: 15 }}>{t.name}</h3>
                    <span style={{ fontSize: 11, background: 'rgba(59,130,246,0.2)', color: '#93c5fd', padding: '2px 8px', borderRadius: 12 }}>{t.serviceType}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => openEdit(t)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}>Edit</button>
                    <button onClick={() => { setDeleteConfirmId(t.id); setDeleteConfirmName(t.name); }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: '#fca5a5', cursor: 'pointer', fontSize: 12 }}>Del</button>
                  </div>
                </div>
                {t.description && <p style={{ color: '#64748b', fontSize: 13, marginBottom: 10 }}>{t.description}</p>}
                <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#94a3b8' }}>
                  <span><FaDollarSign style={{marginRight:4}} /> ${t.estimatedCost.toFixed(2)}</span>
                  <span><FaStopwatch style={{marginRight:4}} /> {t.laborHours}h</span>
                </div>
                {(t.repairs.length > 0 || t.maintenance.length > 0) && (
                  <div style={{ marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
                    {t.repairs.length > 0 && <p style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 4px' }}><FaWrench style={{marginRight:4}} /> {t.repairs.join(', ')}</p>}
                    {t.maintenance.length > 0 && <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}><FaTools style={{marginRight:4}} /> {t.maintenance.join(', ')}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Create / Edit Modal */}
        {showForm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
            <div style={{ background: '#1e293b', borderRadius: 16, padding: 28, width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto', border: '1px solid rgba(255,255,255,0.1)' }}>
              <h2 style={{ color: '#f1f5f9', fontSize: 20, fontWeight: 700, marginBottom: 20 }}>
                {editId ? 'Edit Template' : 'New Work Order Template'}
              </h2>
              {[
                { label: 'Template Name *', key: 'name', type: 'text', placeholder: 'e.g. Standard Oil Change' },
                { label: 'Estimated Cost ($)', key: 'estimatedCost', type: 'number', placeholder: '0.00' },
                { label: 'Labor Hours', key: 'laborHours', type: 'number', placeholder: '0.0' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key} style={{ marginBottom: 14 }}>
                  <label style={{ color: '#94a3b8', fontSize: 13, display: 'block', marginBottom: 4 }}>{label}</label>
                  <input
                    type={type} value={(form as any)[key]} placeholder={placeholder}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#f1f5f9', fontSize: 14, boxSizing: 'border-box' }}
                  />
                </div>
              ))}
              <div style={{ marginBottom: 14 }}>
                <label style={{ color: '#94a3b8', fontSize: 13, display: 'block', marginBottom: 4 }}>Service Type *</label>
                <select value={form.serviceType} onChange={(e) => setForm({ ...form, serviceType: e.target.value })}
                  disabled={!servicesLoaded || serviceSelectOptions.length === 0}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: '#1e293b', color: '#f1f5f9', fontSize: 14 }}>
                  {!servicesLoaded && <option value="">Loading services...</option>}
                  {servicesLoaded && serviceSelectOptions.length === 0 && <option value="">No live services configured</option>}
                  {serviceSelectOptions.map((serviceName) => <option key={serviceName} value={serviceName}>{serviceName}</option>)}
                </select>
                {servicesLoaded && serviceSelectOptions.length === 0 && (
                  <p style={{ color: '#f59e0b', fontSize: 12, marginTop: 6, marginBottom: 0 }}>
                    Add services in Shop Services before saving templates.
                  </p>
                )}
              </div>
              {[
                { label: 'Description', key: 'description', placeholder: 'Brief description...' },
                { label: 'Repairs (one per line)', key: 'repairs', placeholder: 'Brake Pad Replacement\nRotor Resurfacing' },
                { label: 'Maintenance (one per line)', key: 'maintenance', placeholder: 'Oil Filter Replacement\nAir Filter Check' },
                { label: 'Notes', key: 'notes', placeholder: 'Internal notes for technicians...' },
              ].map(({ label, key, placeholder }) => (
                <div key={key} style={{ marginBottom: 14 }}>
                  <label style={{ color: '#94a3b8', fontSize: 13, display: 'block', marginBottom: 4 }}>{label}</label>
                  <textarea value={(form as any)[key]} placeholder={placeholder}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })} rows={3}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#f1f5f9', fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }} />
                </div>
              ))}
              {error && <p style={{ color: '#fca5a5', fontSize: 13, marginBottom: 12 }}>{error}</p>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '11px', borderRadius: 8, border: 'none', background: '#3b82f6', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
                  {saving ? 'Saving...' : editId ? 'Update Template' : 'Create Template'}
                </button>
                <button onClick={() => { setShowForm(false); setError(null); }} style={{ padding: '11px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete template confirm modal */}
      {deleteConfirmId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 32, maxWidth: 420, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}><FaTrash style={{marginRight:4}} /></div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>Delete Template?</h3>
            <p style={{ color: '#94a3b8', marginBottom: 24, fontSize: 14 }}>Delete template "{deleteConfirmName}"? This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setDeleteConfirmId(null)} style={{ flex: 1, padding: '10px', background: '#334155', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', color: '#e2e8f0' }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirmId, deleteConfirmName)} style={{ flex: 1, padding: '10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
