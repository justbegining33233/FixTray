'use client';
import { useState, useEffect, ReactNode } from 'react';
import useRequireAuth from '@/lib/useRequireAuth';
import { FaBatteryFull, FaLightbulb, FaOilCan, FaRecycle, FaSnowflake, FaSyncAlt, FaTint } from 'react-icons/fa';

interface EnvFee {
  id: string;
  name: string;
  amount: number;
  feeType: string;
  description?: string;
  isActive: boolean;
  unit?: string;
}

const FEE_ICONS: Record<string, ReactNode> = { oil: <FaOilCan style={{marginRight:4}} />, tire: <FaSyncAlt style={{marginRight:4}} />, refrigerant: <FaSnowflake style={{marginRight:4}} />, battery: <FaBatteryFull style={{marginRight:4}} />, coolant: <FaTint style={{marginRight:4}} />, other: <FaRecycle style={{marginRight:4}} /> };

export default function EnvironmentalFeesPage() {
  const { user, isLoading } = useRequireAuth(['shop', 'manager', 'admin']);
  const [fees, setFees] = useState<EnvFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', amount: '', feeType: 'oil', description: '', unit: 'per service', isActive: true });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [editFee, setEditFee] = useState<EnvFee | null>(null);
  const [editForm, setEditForm] = useState({ name: '', amount: '', feeType: 'oil', description: '', unit: 'per service', isActive: true });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const r = await fetch('/api/environmental-fees', { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setFees(await r.json());
    setLoading(false);
  };

  useEffect(() => { if (!user) return; load(); }, [user]);

  const save = async () => {
    setFormError('');
    if (!form.name.trim()) { setFormError('Name is required.'); return; }
    if (!form.amount || isNaN(Number(form.amount))) { setFormError('Valid amount is required.'); return; }
    setSaving(true);
    const token = localStorage.getItem('token');
    const r = await fetch('/api/environmental-fees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...form, amount: Number(form.amount) }),
    });
    if (r.ok) { setShowNew(false); setForm({ name: '', amount: '', feeType: 'oil', description: '', unit: 'per service', isActive: true }); load(); }
    setSaving(false);
  };

  const updateFee = async () => {
    if (!editFee) return;
    const token = localStorage.getItem('token');
    const r = await fetch(`/api/environmental-fees/${editFee.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...editForm, amount: Number(editForm.amount) }),
    });
    if (r.ok) { setEditFee(null); load(); }
  };

  const deleteFee = async (id: string) => {
    const token = localStorage.getItem('token');
    await fetch(`/api/environmental-fees/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setDeleteConfirmId(null); load();
  };

  if (isLoading) return <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  return (
    <div className="centered-app-page" style={{ minHeight: '100vh', background: 'transparent', color: '#e5e7eb', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}><FaRecycle style={{marginRight:4}} /> Environmental Fees</h1>
          <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: 14 }}>Configure disposal fees for oil, tires, batteries, and refrigerants</p>
        </div>
        <button onClick={() => setShowNew(true)} style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>+ Add Fee</button>
      </div>

      <div style={{ padding: 32 }}>
        <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 24, fontSize: 13, color: '#86efac' }}>
          <FaLightbulb style={{marginRight:4}} /> Environmental fees are added to invoices as separate line items when you service certain vehicle components. They help cover your disposal costs and keep you compliant.
        </div>

        {loading ? <div style={{ color: '#6b7280' }}>Loading...</div> :
          fees.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 80 }}>
              <div style={{ fontSize: 64 }}><FaRecycle style={{marginRight:4}} /></div>
              <div style={{ fontSize: 18, fontWeight: 600, margin: '16px 0 8px' }}>No fees configured</div>
              <div style={{ color: '#9ca3af', marginBottom: 24 }}>Set up environmental disposal fees to automatically add them to relevant invoices</div>
              <button onClick={() => setShowNew(true)} style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 28px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>+ Add First Fee</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
              {fees.map(fee => (
                <div key={fee.id} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${fee.isActive ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 12, padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ fontSize: 28 }}>{FEE_ICONS[fee.feeType] || <FaRecycle style={{marginRight:4}} />}</div>
                    <span style={{ background: fee.isActive ? 'rgba(34,197,94,0.2)' : 'rgba(107,114,128,0.2)', color: fee.isActive ? '#22c55e' : '#9ca3af', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{fee.isActive ? 'Active' : 'Disabled'}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{fee.name}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2, textTransform: 'capitalize' }}>{fee.feeType} disposal · {fee.unit}</div>
                  {fee.description && <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6 }}>{fee.description}</div>}
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#22c55e', marginTop: 10 }}>${fee.amount.toFixed(2)}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button onClick={() => { setEditFee(fee); setEditForm({ name: fee.name, amount: String(fee.amount), feeType: fee.feeType, description: fee.description || '', unit: fee.unit || 'per service', isActive: fee.isActive }); }}
                      style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, padding: '6px 0', fontSize: 12, color: '#e5e7eb', cursor: 'pointer' }}>Edit</button>
                    <button onClick={() => setDeleteConfirmId(fee.id)}
                      style={{ background: 'rgba(229,51,42,0.15)', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 7, padding: '6px 12px', fontSize: 12, color: '#e5332a', cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20 }}>
          <div style={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 28, width: 420, maxWidth: '100%' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18 }}>Add Environmental Fee</h3>
            {formError && <div style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>{formError}</div>}
            <div style={{ marginBottom: 14 }}>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Oil Disposal Fee"
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Fee Type</label>
                <select value={form.feeType} onChange={e => setForm(p => ({ ...p, feeType: e.target.value }))}
                  style={{ width: '100%', background: '#374151', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 12px', color: '#e5e7eb', fontSize: 14 }}>
                  {Object.entries(FEE_ICONS).map(([k, icon]) => <option key={k} value={k}>{icon} {k.charAt(0).toUpperCase() + k.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Amount ($) *</label>
                <input value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} type="number" step="0.01" placeholder="4.99"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 12px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Unit</label>
              <input value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} placeholder="per quart / per tire / per service"
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Description</label>
              <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="EPA motor oil recycling fee"
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={save} disabled={saving} style={{ flex: 1, background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{saving ? 'Saving...' : 'Add Fee'}</button>
              <button onClick={() => setShowNew(false)} style={{ flex: 1, background: 'transparent', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '11px 0', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Fee Modal */}
      {editFee && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20 }}>
          <div style={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 28, width: 420, maxWidth: '100%' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18 }}>Edit Fee</h3>
            {(['name', 'amount', 'description', 'unit'] as const).map(k => (
              <div key={k} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>{k.charAt(0).toUpperCase() + k.slice(1)}</label>
                <input value={(editForm as any)[k]} onChange={e => setEditForm(p => ({ ...p, [k]: e.target.value }))}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={updateFee} style={{ flex: 1, background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Save</button>
              <button onClick={() => setEditFee(null)} style={{ flex: 1, background: 'transparent', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '11px 0', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirmId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 28, maxWidth: 360, width: '90%', textAlign: 'center' }}>
            <h3 style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Delete Fee?</h3>
            <p style={{ color: '#9ca3af', marginBottom: 24 }}>This environmental fee will be permanently deleted.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => deleteFee(deleteConfirmId)} style={{ background: '#ef4444', border: 'none', color: '#fff', padding: '10px 24px', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
              <button onClick={() => setDeleteConfirmId(null)} style={{ background: '#374151', border: 'none', color: '#9ca3af', padding: '10px 24px', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
