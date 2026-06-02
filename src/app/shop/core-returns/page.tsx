'use client';
import { useState, useEffect } from 'react';
import { FaRecycle, FaPlus } from 'react-icons/fa';
import useRequireAuth from '@/lib/useRequireAuth';

interface CoreReturn { id: string; partName: string; partNumber?: string; vendor?: string; coreValue: number; creditReceived?: number; status: string; workOrderId?: string; notes?: string; createdAt: string; returnedAt?: string; }
const statusColor: Record<string, string> = { pending: '#f59e0b', returned: '#ff6b64', credited: '#22c55e', waived: '#6b7280' };

export default function CoreReturnsPage() {
  const { user, isLoading } = useRequireAuth(['shop']);
  const [items, setItems] = useState<CoreReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Partial<CoreReturn>>({});
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');
  const [formError, setFormError] = useState('');
  const [creditModal, setCreditModal] = useState<{ id: string; defaultAmt: number } | null>(null);
  const [creditAmt, setCreditAmt] = useState('');

  const load = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const r = await fetch('/api/core-returns', { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setItems(await r.json());
    setLoading(false);
  };

  useEffect(() => { if (!user) return; load(); }, [user]);

  const save = async () => {
    setFormError('');
    if (!form.partName?.trim()) { setFormError('Part name is required.'); return; }
    const coreVal = parseFloat(String(form.coreValue || ''));
    if (isNaN(coreVal) || coreVal <= 0) { setFormError('Valid core value (> 0) is required.'); return; }
    setSaving(true);
    const token = localStorage.getItem('token');
    await fetch('/api/core-returns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...form, coreValue: coreVal }),
    });
    setSaving(false); setShowAdd(false); setForm({}); load();
  };

  const updateStatus = async (id: string, status: string, extra = {}) => {
    const token = localStorage.getItem('token');
    await fetch(`/api/core-returns/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status, ...extra, ...(status === 'returned' ? { returnedAt: new Date().toISOString() } : {}) }),
    });
    load();
  };

  if (isLoading) return <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  const filtered = filter === 'all' ? items : items.filter(i => i.status === filter);
  const pendingValue = items.filter(i => i.status === 'pending').reduce((s, i) => s + i.coreValue, 0);
  const recoveredValue = items.filter(i => i.status === 'credited').reduce((s, i) => s + (i.creditReceived || i.coreValue), 0);

  return (
    <div className="centered-app-page" style={{ minHeight: '100vh', background: 'transparent', color: '#e5e7eb', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}><FaRecycle style={{fontSize:26}} /> Core Returns</h1>
          <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: 14 }}>
            ${pendingValue.toFixed(2)} pending recovery  ${recoveredValue.toFixed(2)} credited
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {['all', 'pending', 'returned', 'credited', 'waived'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              style={{ background: filter === s ? '#e5332a' : 'rgba(255,255,255,0.05)', color: filter === s ? '#fff' : '#9ca3af', border: `1px solid ${filter === s ? '#e5332a' : 'rgba(255,255,255,0.1)'}`, borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
              {s}
            </button>
          ))}
          <button onClick={() => { setShowAdd(true); setForm({}); }} style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><FaPlus /> Add Core</button>
        </div>
      </div>

      <div style={{ padding: 32 }}>
        {loading ? <div style={{ textAlign: 'center', color: '#6b7280', padding: 64 }}>Loading...</div> :
          filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 80 }}>
              <div style={{ fontSize: 64 }}><FaRecycle /></div>
              <div style={{ fontSize: 20, fontWeight: 600, margin: '16px 0 8px' }}>No cores tracked</div>
              <div style={{ color: '#9ca3af', marginBottom: 24 }}>Track alternators, starters, and other rebuildable cores to recover value</div>
              <button onClick={() => { setShowAdd(true); setForm({}); }} style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 28px', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><FaPlus /> Track First Core</button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    {['Part Name', 'Part #', 'Vendor', 'Core Value', 'Credit', 'Status', 'WO Ref', 'Actions'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#9ca3af', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>{item.partName}</td>
                      <td style={{ padding: '12px 14px', color: '#9ca3af' }}>{item.partNumber || ' - '}</td>
                      <td style={{ padding: '12px 14px', color: '#9ca3af' }}>{item.vendor || ' - '}</td>
                      <td style={{ padding: '12px 14px', color: '#f59e0b', fontWeight: 600 }}>${item.coreValue.toFixed(2)}</td>
                      <td style={{ padding: '12px 14px', color: '#22c55e' }}>{item.creditReceived ? `$${item.creditReceived.toFixed(2)}` : ' - '}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ background: statusColor[item.status] + '22', color: statusColor[item.status], border: `1px solid ${statusColor[item.status]}`, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>{item.status}</span>
                      </td>
                      <td style={{ padding: '12px 14px', color: '#ff6b64' }}>{item.workOrderId ? `#${item.workOrderId.slice(-6).toUpperCase()}` : ' - '}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {item.status === 'pending' && <button onClick={() => updateStatus(item.id, 'returned')} style={{ background: 'rgba(96,165,250,0.2)', color: '#ff6b64', border: '1px solid #ff6b64', borderRadius: 5, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>Returned</button>}
                          {item.status === 'returned' && <button onClick={() => { setCreditAmt(String(item.coreValue)); setCreditModal({ id: item.id, defaultAmt: item.coreValue }); }} style={{ background: 'rgba(34,197,94,0.2)', color: '#22c55e', border: '1px solid #22c55e', borderRadius: 5, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>Credited</button>}
                          {item.status === 'pending' && <button onClick={() => updateStatus(item.id, 'waived')} style={{ background: 'rgba(107,114,128,0.2)', color: '#9ca3af', border: '1px solid #6b7280', borderRadius: 5, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>Waive</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 28, width: 420, maxWidth: '90%' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18 }}>Track Core Return</h3>
            {formError && <div style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>{formError}</div>}
            {[['partName', 'Part Name'], ['partNumber', 'Part Number (optional)'], ['vendor', 'Vendor'], ['coreValue', 'Core Value ($)'], ['workOrderId', 'Work Order ID (optional)'], ['notes', 'Notes']].map(([k, label]) => (
              <div key={k} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>{label}</label>
                <input value={String((form as any)[k] || '')} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={save} disabled={saving} style={{ flex: 1, background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{saving ? 'Saving...' : 'Add Core'}</button>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, background: 'transparent', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '11px 0', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {creditModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 28, width: 360, maxWidth: '90%' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>Credit Amount Received</h3>
            <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Amount ($)</label>
            <input
              type="number"
              value={creditAmt}
              onChange={e => setCreditAmt(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box', marginBottom: 20 }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => {
                  const parsed = parseFloat(creditAmt);
                  if (!isNaN(parsed)) updateStatus(creditModal.id, 'credited', { creditReceived: parsed });
                  setCreditModal(null);
                }}
                style={{ flex: 1, background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                Confirm
              </button>
              <button onClick={() => setCreditModal(null)} style={{ flex: 1, background: 'transparent', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '11px 0', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

