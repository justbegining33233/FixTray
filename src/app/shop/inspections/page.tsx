'use client';
import { usePhrase } from '@/lib/usePhrase';
import { useState, useEffect, ReactNode } from 'react';
import useRequireAuth from '@/lib/useRequireAuth';
import { FaCar, FaCheckCircle, FaExclamationTriangle, FaHourglassHalf, FaTag, FaTimesCircle } from 'react-icons/fa';
import { validateInspectionRecord } from '@/lib/shopFormValidation';

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
  const say = usePhrase();
  const { user, isLoading } = useRequireAuth(['shop', 'manager', 'admin']);
  const [inspections, setInspections] = useState<StateInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [form, setForm] = useState({ vehicleDesc: '', vin: '', inspectionType: 'safety', result: 'pass', stickerId: '', expiryDate: '', odometer: '', fee: '', notes: '', workOrderId: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const inspectionReady = validateInspectionRecord(form).ok;

  const load = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const r = await fetch('/api/state-inspections', { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) {
      const data = await r.json();
      setInspections(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  };

  useEffect(() => { if (!user) return; load(); }, [user]);

  const blankInspection = { vehicleDesc: '', vin: '', inspectionType: 'safety', result: 'pass', stickerId: '', expiryDate: '', odometer: '', fee: '', notes: '', workOrderId: '' };

  const create = async () => {
    const check = validateInspectionRecord(form);
    if (!check.ok) { setFormError(check.error); return; }
    setFormError('');
    setSaving(true);
    const token = localStorage.getItem('token');
    const r = await fetch('/api/state-inspections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...form, odometer: form.odometer ? Number(form.odometer) : null, fee: form.fee ? Number(form.fee) : null }),
    });
    if (r.ok) {
      setShowNew(false);
      load();
      setForm(blankInspection);
    } else {
      const err = await r.json().catch(() => ({}));
      setFormError(err.error || 'Could not record the inspection.');
    }
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

  if (isLoading) return <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>{say("Loading...")}</div>;
  if (!user) return null;

  const passRate = inspections.length ? Math.round(inspections.filter(i => i.result === 'pass').length / inspections.length * 100) : 0;

  return (
    <div className="centered-app-page" style={{ minHeight: '100vh', background: 'transparent', color: '#e5e7eb', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}><FaCar style={{marginRight:4}} /> {say("State Inspections")}</h1>
          <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: 14 }}>{say("Safety & emissions inspection records  -  track sticker numbers and expiry dates")}</p>
        </div>
        <button onClick={() => setShowNew(true)} style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{say("+ Record Inspection")}</button>
      </div>

      <div style={{ padding: '24px 32px 0', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {[{ label: say("Total"), value: inspections.length, icon: '' }, { label: say("Passed"), value: inspections.filter(i => i.result === 'pass').length, icon: '' }, { label: say("Failed"), value: inspections.filter(i => i.result === 'fail').length, icon: '' }, { label: say("Pass Rate"), value: `${passRate}%`, icon: '' }].map(s => (
          <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 20px', minWidth: 110 }}>
            <div style={{ fontSize: 22 }}>{say(s.icon)}</div>
            <div style={{ fontSize: 26, fontWeight: 800, margin: '4px 0 2px' }}>{say(s.value)}</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>{say(s.label)}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: 32 }}>
        {loading ? <div style={{ color: '#6b7280' }}>{say("Loading...")}</div> :
          inspections.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 80 }}>
              <div style={{ fontSize: 64 }}><FaCar style={{marginRight:4}} /></div>
              <div style={{ fontSize: 18, fontWeight: 600, margin: '16px 0 8px' }}>{say("No inspections recorded")}</div>
              <div style={{ color: '#9ca3af', marginBottom: 24 }}>{say("Start recording state safety and emissions inspections")}</div>
              <button onClick={() => setShowNew(true)} style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 28px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>{say("+ Record First Inspection")}</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
              {inspections.map(insp => {
                const rs = RESULT_STYLE[insp.result] || RESULT_STYLE.pending;
                return (
                  <div key={insp.id} style={{ background: rs.bg, border: `1px solid ${rs.color}30`, borderRadius: 12, padding: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{insp.vehicle ? `${insp.vehicle.year} ${insp.vehicle.make} ${insp.vehicle.model}` : (insp as { vehicleDesc?: string }).vehicleDesc || say("Vehicle")}</div>
                        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{new Date(insp.createdAt).toLocaleDateString()}  {insp.inspectionType.replace('_', ' ')}</div>
                      </div>
                      <span style={{ fontSize: 20 }}>{say(rs.icon)}</span>
                    </div>
                    {insp.stickerId && <div style={{ fontSize: 13, marginBottom: 4 }}><FaTag style={{marginRight:4}} /> {say("Sticker #")}{say(insp.stickerId)}</div>}
                    {insp.expiryDate && <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 4 }}>{say("Expires:")}{' '}{new Date(insp.expiryDate).toLocaleDateString()}</div>}
                    {insp.fee && <div style={{ fontSize: 13, color: '#22c55e' }}>{say("Fee charged: $")}{say(insp.fee)}</div>}
                    {insp.notes && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>{say(insp.notes)}</div>}
                  </div>
                );
              })}
            </div>
          )}
      </div>

      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20 }}>
          <div style={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 28, width: 460, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18 }}>{say("Record State Inspection")}</h3>
            {formError && <div style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 13 }}>{say(formError)}</div>}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 5 }}>{say("Vehicle (year / make / model) *")}</label>
              <input value={form.vehicleDesc} onChange={e => setForm(p => ({ ...p, vehicleDesc: e.target.value }))} placeholder={say("2020 Ford F-150")}
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '9px 12px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 5 }}>{say("VIN")}</label>
              <input value={form.vin} onChange={e => setForm(p => ({ ...p, vin: e.target.value }))} placeholder={say("Optional if vehicle or work order is set")}
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '9px 12px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>{say("Inspection Template")}</label>
              <select
                value={selectedTemplateId}
                onChange={(e) => applyTemplate(e.target.value)}
                style={{ width: '100%', background: '#374151', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 12px', color: '#e5e7eb', fontSize: 14 }}
              >
                <option value="">{say("Choose a template (optional)")}</option>
                {INSPECTION_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>{say(t.label)}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>{say("Inspection Type")}</label>
                <select value={form.inspectionType} onChange={e => setForm(p => ({ ...p, inspectionType: e.target.value }))}
                  style={{ width: '100%', background: '#374151', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 12px', color: '#e5e7eb', fontSize: 14 }}>
                  <option value="safety">{say("Safety")}</option>
                  <option value="emissions">{say("Emissions")}</option>
                  <option value="safety_emissions">{say("Safety + Emissions")}</option>
                  <option value="commercial">{say("Commercial")}</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>{say("Result")}</label>
                <select value={form.result} onChange={e => setForm(p => ({ ...p, result: e.target.value }))}
                  style={{ width: '100%', background: '#374151', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 12px', color: '#e5e7eb', fontSize: 14 }}>
                  <option value="pass"><FaCheckCircle style={{marginRight:4}} /> {say("Pass")}</option>
                  <option value="fail"><FaTimesCircle style={{marginRight:4}} /> {say("Fail")}</option>
                  <option value="waiver"><FaExclamationTriangle style={{marginRight:4}} /> {say("Waiver")}</option>
                  <option value="pending"><FaHourglassHalf style={{marginRight:4}} /> {say("Pending")}</option>
                </select>
              </div>
            </div>
            {[["stickerId", say("Sticker/Certificate #"), say("INS-123456")], ["expiryDate", say("Expiry Date"), ''], ['odometer', say("Odometer Reading"), '85000'], ['fee', say("Fee Charged ($)"), '37.00'], ["workOrderId", say("Work Order ID"), say("WO-101")]].map(([k, label, ph]) => (
              <div key={k} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 5 }}>{say(label)}</label>
                <input type={k === 'expiryDate' ? 'date' : 'text'} value={(form as any)[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} placeholder={say(ph)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '9px 12px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            ))}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 5 }}>{say("Notes")}</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '9px 12px', color: '#e5e7eb', fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={create} disabled={saving || !inspectionReady} style={{ flex: 1, background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: saving || !inspectionReady ? 'not-allowed' : 'pointer', opacity: saving || !inspectionReady ? 0.5 : 1 }}>{saving ? say("Saving...") : say("Record Inspection")}</button>
              <button onClick={() => setShowNew(false)} style={{ flex: 1, background: 'transparent', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '11px 0', fontSize: 14, cursor: 'pointer' }}>{say("Cancel")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

