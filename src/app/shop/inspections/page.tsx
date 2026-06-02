'use client';
import { useState, useEffect, ReactNode } from 'react';
import useRequireAuth from '@/lib/useRequireAuth';
import { FaCar, FaCheckCircle, FaExclamationTriangle, FaHourglassHalf, FaTag, FaTimesCircle } from 'react-icons/fa';

interface StateInspection {
  id: string;
  inspectionType: string;
  result: string;
  stickerId?: string;
  expiryDate?: string;
  odometer?: number;
  notes?: string;
  fee?: number;
  createdAt: string;
  workOrderId?: string;
  technicianId?: string;
  vehicle?: { year?: number; make?: string; model?: string; vin?: string };
}

const INSPECTION_TEMPLATES = [
  {
    id: 'state-safety',
    label: 'State Safety Checklist',
    inspectionType: 'safety',
    fee: 37,
    checklist: [
      'Lights and signals',
      'Brake operation and pad wear',
      'Steering and suspension play',
      'Tire tread and pressure',
      'Windshield and wipers',
    ],
  },
  {
    id: 'state-emissions',
    label: 'State Emissions Checklist',
    inspectionType: 'emissions',
    fee: 29,
    checklist: [
      'OBD readiness monitors',
      'Catalyst and oxygen sensor checks',
      'Evap leak status',
      'Tailpipe visual inspection',
      'MIL status and fault codes',
    ],
  },
  {
    id: 'state-combined',
    label: 'Safety + Emissions Full',
    inspectionType: 'safety_emissions',
    fee: 59,
    checklist: [
      'Full safety checklist complete',
      'Full emissions checklist complete',
      'Sticker and certificate issued',
    ],
  },
] as const;

const RESULT_STYLE: Record<string, { bg: string; color: string; icon: ReactNode }> = {
  pass:    { bg: 'rgba(34,197,94,0.15)',  color: '#22c55e', icon: <FaCheckCircle style={{marginRight:4}} /> },
  fail:    { bg: 'rgba(229,51,42,0.15)',  color: '#e5332a', icon: <FaTimesCircle style={{marginRight:4}} /> },
  waiver:  { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', icon: <FaExclamationTriangle style={{marginRight:4}} /> },
  pending: { bg: 'rgba(96,165,250,0.15)', color: '#ff6b64', icon: <FaHourglassHalf style={{marginRight:4}} /> },
};

export default function StateInspectionsPage() {
  const { user, isLoading } = useRequireAuth(['shop', 'manager', 'admin']);
  const [inspections, setInspections] = useState<StateInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [form, setForm] = useState({ inspectionType: 'safety', result: 'pass', stickerId: '', expiryDate: '', odometer: '', fee: '', notes: '', workOrderId: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const r = await fetch('/api/state-inspections', { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setInspections(await r.json());
    setLoading(false);
  };

  useEffect(() => { if (!user) return; load(); }, [user]);

  const create = async () => {
    setSaving(true);
    const token = localStorage.getItem('token');
    const r = await fetch('/api/state-inspections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...form, odometer: form.odometer ? Number(form.odometer) : null, fee: form.fee ? Number(form.fee) : null }),
    });
    if (r.ok) { setShowNew(false); load(); setForm({ inspectionType: 'safety', result: 'pass', stickerId: '', expiryDate: '', odometer: '', fee: '', notes: '', workOrderId: '' }); }
    setSaving(false);
  };

  const applyTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = INSPECTION_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;

    const checklistText = template.checklist.map((item, i) => `${i + 1}. ${item}`).join('\n');
    setForm((prev) => ({
      ...prev,
      inspectionType: template.inspectionType,
      fee: String(template.fee),
      notes: `Template: ${template.label}\n${checklistText}`,
    }));
  };

  if (isLoading) return <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  const passRate = inspections.length ? Math.round(inspections.filter(i => i.result === 'pass').length / inspections.length * 100) : 0;

  return (
    <div className="centered-app-page" style={{ minHeight: '100vh', background: 'transparent', color: '#e5e7eb', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}><FaCar style={{marginRight:4}} /> State Inspections</h1>
          <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: 14 }}>Safety & emissions inspection records  -  track sticker numbers and expiry dates</p>
        </div>
        <button onClick={() => setShowNew(true)} style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>+ Record Inspection</button>
      </div>

      <div style={{ padding: '24px 32px 0', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {[{ label: 'Total', value: inspections.length, icon: '' }, { label: 'Passed', value: inspections.filter(i => i.result === 'pass').length, icon: '' }, { label: 'Failed', value: inspections.filter(i => i.result === 'fail').length, icon: '' }, { label: 'Pass Rate', value: `${passRate}%`, icon: '' }].map(s => (
          <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 20px', minWidth: 110 }}>
            <div style={{ fontSize: 22 }}>{s.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 800, margin: '4px 0 2px' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: 32 }}>
        {loading ? <div style={{ color: '#6b7280' }}>Loading...</div> :
          inspections.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 80 }}>
              <div style={{ fontSize: 64 }}><FaCar style={{marginRight:4}} /></div>
              <div style={{ fontSize: 18, fontWeight: 600, margin: '16px 0 8px' }}>No inspections recorded</div>
              <div style={{ color: '#9ca3af', marginBottom: 24 }}>Start recording state safety and emissions inspections</div>
              <button onClick={() => setShowNew(true)} style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 28px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>+ Record First Inspection</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
              {inspections.map(insp => {
                const rs = RESULT_STYLE[insp.result] || RESULT_STYLE.pending;
                return (
                  <div key={insp.id} style={{ background: rs.bg, border: `1px solid ${rs.color}30`, borderRadius: 12, padding: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{insp.vehicle ? `${insp.vehicle.year} ${insp.vehicle.make} ${insp.vehicle.model}` : 'Vehicle'}</div>
                        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{new Date(insp.createdAt).toLocaleDateString()}  {insp.inspectionType.replace('_', ' ')}</div>
                      </div>
                      <span style={{ fontSize: 20 }}>{rs.icon}</span>
                    </div>
                    {insp.stickerId && <div style={{ fontSize: 13, marginBottom: 4 }}><FaTag style={{marginRight:4}} /> Sticker #{insp.stickerId}</div>}
                    {insp.expiryDate && <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 4 }}>Expires: {new Date(insp.expiryDate).toLocaleDateString()}</div>}
                    {insp.fee && <div style={{ fontSize: 13, color: '#22c55e' }}>Fee charged: ${insp.fee}</div>}
                    {insp.notes && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>{insp.notes}</div>}
                  </div>
                );
              })}
            </div>
          )}
      </div>

      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20 }}>
          <div style={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 28, width: 460, maxWidth: '100%' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18 }}>Record State Inspection</h3>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Inspection Template</label>
              <select
                value={selectedTemplateId}
                onChange={(e) => applyTemplate(e.target.value)}
                style={{ width: '100%', background: '#374151', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 12px', color: '#e5e7eb', fontSize: 14 }}
              >
                <option value="">Choose a template (optional)</option>
                {INSPECTION_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Inspection Type</label>
                <select value={form.inspectionType} onChange={e => setForm(p => ({ ...p, inspectionType: e.target.value }))}
                  style={{ width: '100%', background: '#374151', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 12px', color: '#e5e7eb', fontSize: 14 }}>
                  <option value="safety">Safety</option>
                  <option value="emissions">Emissions</option>
                  <option value="safety_emissions">Safety + Emissions</option>
                  <option value="commercial">Commercial</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Result</label>
                <select value={form.result} onChange={e => setForm(p => ({ ...p, result: e.target.value }))}
                  style={{ width: '100%', background: '#374151', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 12px', color: '#e5e7eb', fontSize: 14 }}>
                  <option value="pass"><FaCheckCircle style={{marginRight:4}} /> Pass</option>
                  <option value="fail"><FaTimesCircle style={{marginRight:4}} /> Fail</option>
                  <option value="waiver"><FaExclamationTriangle style={{marginRight:4}} /> Waiver</option>
                  <option value="pending"><FaHourglassHalf style={{marginRight:4}} /> Pending</option>
                </select>
              </div>
            </div>
            {[['stickerId', 'Sticker/Certificate #', 'INS-123456'], ['expiryDate', 'Expiry Date', ''], ['odometer', 'Odometer Reading', '85000'], ['fee', 'Fee Charged ($)', '37.00'], ['workOrderId', 'Work Order ID', 'WO-101']].map(([k, label, ph]) => (
              <div key={k} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 5 }}>{label}</label>
                <input type={k === 'expiryDate' ? 'date' : 'text'} value={(form as any)[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} placeholder={ph}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '9px 12px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            ))}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 5 }}>Notes</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '9px 12px', color: '#e5e7eb', fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={create} disabled={saving} style={{ flex: 1, background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{saving ? 'Saving...' : 'Record Inspection'}</button>
              <button onClick={() => setShowNew(false)} style={{ flex: 1, background: 'transparent', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '11px 0', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

