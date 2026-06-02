'use client';
import { useState, useEffect } from 'react';
import { FaCamera, FaKey, FaCar, FaExclamationTriangle } from 'react-icons/fa';
import useRequireAuth from '@/lib/useRequireAuth';

interface ConditionReport {
  id: string;
  reportType: string;
  vehicleDesc?: string;
  mileageIn?: number;
  mileageOut?: number;
  fuelLevelIn?: number;
  fuelLevelOut?: number;
  damageNotes?: string;
  photos: string[];
  createdAt: string;
  workOrderId?: string;
  customerId?: string;
  checkedInBy?: string;
  checkedOutBy?: string;
}

export default function ConditionReportsPage() {
  const { user, isLoading } = useRequireAuth(['shop', 'manager', 'admin']);
  const [reports, setReports] = useState<ConditionReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [_selected, setSelected] = useState<ConditionReport | null>(null);
  const [filter, setFilter] = useState<'all' | 'check_in' | 'check_out'>('all');
  const [form, setForm] = useState({ reportType: 'check_in', vehicleDesc: '', mileageIn: '', fuelLevelIn: '50', damageNotes: '', workOrderId: '', photos: [] as string[] });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const r = await fetch('/api/condition-reports', { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setReports(await r.json());
    setLoading(false);
  };

  useEffect(() => { if (!user) return; load(); }, [user]);

  const create = async () => {
    setFormError('');
    if (!form.vehicleDesc.trim()) { setFormError('Vehicle description is required.'); return; }
    setSaving(true);
    const token = localStorage.getItem('token');
    const r = await fetch('/api/condition-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...form, mileageIn: form.mileageIn ? Number(form.mileageIn) : null, fuelLevelIn: Number(form.fuelLevelIn) }),
    });
    if (r.ok) { setShowNew(false); load(); setForm({ reportType: 'check_in', vehicleDesc: '', mileageIn: '', fuelLevelIn: '50', damageNotes: '', workOrderId: '', photos: [] }); }
    setSaving(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      const token = localStorage.getItem('token');
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
      if (r.ok) { const d = await r.json(); setForm(p => ({ ...p, photos: [...p.photos, d.url] })); }
      else { setFormError('Photo upload failed.'); }
    } catch { setFormError('Photo upload failed.'); }
    setPhotoUploading(false);
  };

  const filtered = filter === 'all' ? reports : reports.filter(r => r.reportType === filter);

  const fuelBar = (pct: number) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 80, height: 10, background: '#374151', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: pct > 50 ? '#22c55e' : pct > 25 ? '#f59e0b' : '#e5332a', borderRadius: 5 }} />
      </div>
      <span style={{ fontSize: 12, color: '#9ca3af' }}>{pct}%</span>
    </div>
  );

  if (isLoading) return <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  return (
    <div className="centered-app-page" style={{ minHeight: '100vh', background: 'transparent', color: '#e5e7eb', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}><FaCamera style={{fontSize:26}} /> Condition Reports</h1>
          <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: 14 }}>Vehicle check-in/out condition logs with damage notes  -  protect your shop from liability</p>
        </div>
        <button onClick={() => setShowNew(true)} style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>+ New Report</button>
      </div>

      <div style={{ padding: '20px 32px 0', display: 'flex', gap: 8 }}>
        {([['all', 'All Reports'], ['check_in', <><FaKey style={{marginRight:4}} />Check-In</>], ['check_out', <><FaCar style={{marginRight:4}} />Check-Out</>]] as [string, React.ReactNode][]).map(([v, label]) => (
          <button key={v} onClick={() => setFilter(v as any)}
            style={{ background: filter === v ? '#e5332a' : 'rgba(255,255,255,0.06)', color: filter === v ? '#fff' : '#e5e7eb', border: `1px solid ${filter === v ? '#e5332a' : 'rgba(255,255,255,0.12)'}`, borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ padding: 32 }}>
        {loading ? <div style={{ color: '#6b7280' }}>Loading...</div> :
          filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 80 }}>
              <div style={{ fontSize: 64 }}><FaCamera /></div>
              <div style={{ fontSize: 18, fontWeight: 600, margin: '16px 0 8px' }}>No condition reports yet</div>
              <div style={{ color: '#9ca3af', marginBottom: 24 }}>Log vehicle condition at check-in and check-out to protect against damage disputes</div>
              <button onClick={() => setShowNew(true)} style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 28px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>+ Create First Report</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {filtered.map(r => (
                <div key={r.id} onClick={() => setSelected(r)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 18, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{r.vehicleDesc || 'Vehicle'}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{new Date(r.createdAt).toLocaleDateString()}</div>
                    </div>
                    <span style={{ background: r.reportType === 'check_in' ? 'rgba(96,165,250,0.2)' : 'rgba(34,197,94,0.2)', color: r.reportType === 'check_in' ? '#ff6b64' : '#22c55e', border: `1px solid ${r.reportType === 'check_in' ? '#e5332a' : '#22c55e'}`, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
                      {r.reportType === 'check_in' ? <><FaKey style={{marginRight:4}} />Check-In</> : <><FaCar style={{marginRight:4}} />Check-Out</>}
                    </span>
                  </div>
                  {r.mileageIn && <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 6 }}>Mileage: {r.mileageIn.toLocaleString()}</div>}
                  {r.fuelLevelIn !== undefined && r.fuelLevelIn !== null && (
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>Fuel Level</div>
                      {fuelBar(r.fuelLevelIn)}
                    </div>
                  )}
                  {r.damageNotes && (
                    <div style={{ background: 'rgba(229,51,42,0.1)', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 7, padding: '7px 10px', fontSize: 12, color: '#fca5a5', marginTop: 8 }}>
                      <FaExclamationTriangle style={{marginRight:4}} />{r.damageNotes.slice(0, 60)}{r.damageNotes.length > 60 ? '...' : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
      </div>

      {/* New Report Modal */}
      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20 }}>
          <div style={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 28, width: 450, maxWidth: '100%' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18 }}>New Condition Report</h3>
            {formError && <div style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>{formError}</div>}

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Report Type</label>
              <select value={form.reportType} onChange={e => setForm(p => ({ ...p, reportType: e.target.value }))}
                style={{ width: '100%', background: '#374151', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 12px', color: '#e5e7eb', fontSize: 14 }}>
                <option value="check_in">Check-In</option>
                <option value="check_out">Check-Out</option>
              </select>
            </div>

            {[['vehicleDesc', 'Vehicle Description', '2022 Honda Civic'], ['mileageIn', 'Mileage', '42500'], ['workOrderId', 'Work Order ID', 'WO-101']].map(([k, label, ph]) => (
              <div key={k} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>{label}</label>
                <input value={(form as any)[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} placeholder={ph}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            ))}

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Fuel Level: {form.fuelLevelIn}%</label>
              <input type="range" min="0" max="100" step="5" value={form.fuelLevelIn} onChange={e => setForm(p => ({ ...p, fuelLevelIn: e.target.value }))} style={{ width: '100%', accentColor: '#e5332a' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280' }}><span>Empty</span><span>Half</span><span>Full</span></div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Damage Notes</label>
              <textarea value={form.damageNotes} onChange={e => setForm(p => ({ ...p, damageNotes: e.target.value }))} rows={3}
                placeholder="Note any existing dents, scratches, or damage..."
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Photos</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                {form.photos.map((url, idx) => (
                  <img key={idx} src={url} alt="photo" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)' }} />
                ))}
              </div>
              <label style={{ display: 'inline-block', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 16px', fontSize: 13, color: '#e5e7eb', cursor: 'pointer' }}>
                {photoUploading ? 'Uploading...' : <><FaCamera style={{marginRight:4}} />Add Photo</>}
                <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} disabled={photoUploading} />
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={create} disabled={saving} style={{ flex: 1, background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{saving ? 'Saving...' : 'Save Report'}</button>
              <button onClick={() => setShowNew(false)} style={{ flex: 1, background: 'transparent', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '11px 0', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

