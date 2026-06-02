'use client';
import { useState, useEffect } from 'react';
import useRequireAuth from '@/lib/useRequireAuth';
import { FaCheckCircle, FaLink, FaSearch, FaTimes, FaUpload } from 'react-icons/fa';

interface DVIInspection {
  id: string;
  vehicleDesc?: string;
  mileage?: number;
  status: string;
  customerApproved: boolean;
  approvedAt?: string;
  approvalToken?: string;
  workOrderId?: string;
  notes?: string;
  createdAt: string;
  items: DVIItem[];
}
interface DVIItem { id: string; category: string; itemName: string; condition: string; notes?: string; estimatedCost?: number; approved: boolean; }

const conditionColor: Record<string, string> = { green: '#22c55e', yellow: '#f59e0b', red: '#e5332a' };
const conditionBg: Record<string, string> = { green: 'rgba(34,197,94,0.1)', yellow: 'rgba(245,158,11,0.1)', red: 'rgba(229,51,42,0.1)' };

export default function DVIPage() {
  const { user, isLoading } = useRequireAuth(['shop']);
  const [inspections, setInspections] = useState<DVIInspection[]>([]);
  const [workOrderOptions, setWorkOrderOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DVIInspection | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ vehicleDesc: '', mileage: '', workOrderId: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState('');
  const [_sentId, setSentId] = useState('');
  const [_sendError, setSendError] = useState('');

  const load = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const [dviRes, baysRes, workOrdersRes] = await Promise.all([
      fetch('/api/dvi', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/bays', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/workorders?limit=100', { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    if (dviRes.ok) setInspections(await dviRes.json());

    const bayIds = baysRes.ok
      ? ((await baysRes.json()) as any[])
          .filter((b) => b?.workOrderId)
          .map((b) => b.workOrderId)
      : [];

    let workOrders: any[] = [];
    if (workOrdersRes.ok) {
      const workOrdersData = await workOrdersRes.json();
      workOrders = Array.isArray(workOrdersData?.workOrders) ? workOrdersData.workOrders : [];
    }

    const options = (Array.isArray(workOrders) ? workOrders : []).filter((wo: any) => {
      const status = String(wo?.status || '').toLowerCase();
      return bayIds.includes(wo.id) || ['pending', 'in-progress', 'waiting'].includes(status);
    });
    setWorkOrderOptions(options);
    setLoading(false);
  };

  useEffect(() => { if (!user) return; load(); }, [user]);

  const createInspection = async () => {
    setSaving(true);
    const token = localStorage.getItem('token');
    const DEFAULT_ITEMS = [
      { category: 'Engine', itemName: 'Engine Oil Level & Condition', condition: 'green' },
      { category: 'Engine', itemName: 'Air Filter', condition: 'green' },
      { category: 'Engine', itemName: 'Serpentine Belt', condition: 'green' },
      { category: 'Cooling', itemName: 'Coolant Level & Condition', condition: 'green' },
      { category: 'Brakes', itemName: 'Front Brake Pads', condition: 'green' },
      { category: 'Brakes', itemName: 'Rear Brake Pads', condition: 'green' },
      { category: 'Brakes', itemName: 'Brake Fluid', condition: 'green' },
      { category: 'Tires', itemName: 'Front Left Tire', condition: 'green' },
      { category: 'Tires', itemName: 'Front Right Tire', condition: 'green' },
      { category: 'Tires', itemName: 'Rear Left Tire', condition: 'green' },
      { category: 'Tires', itemName: 'Rear Right Tire', condition: 'green' },
      { category: 'Fluids', itemName: 'Power Steering Fluid', condition: 'green' },
      { category: 'Fluids', itemName: 'Transmission Fluid', condition: 'green' },
      { category: 'Fluids', itemName: 'Battery & Terminals', condition: 'green' },
      { category: 'Lights', itemName: 'Headlights', condition: 'green' },
      { category: 'Lights', itemName: 'Brake Lights', condition: 'green' },
      { category: 'Suspension', itemName: 'Front Shocks/Struts', condition: 'green' },
      { category: 'Suspension', itemName: 'Rear Shocks/Struts', condition: 'green' },
      { category: 'Wipers', itemName: 'Wiper Blades', condition: 'green' },
    ];
    const r = await fetch('/api/dvi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...newForm, mileage: newForm.mileage ? Number(newForm.mileage) : null, items: DEFAULT_ITEMS }),
    });
    if (r.ok) {
      const inspection = await r.json();
      setShowNew(false);
      setSelected(inspection);
      load();
    }
    setSaving(false);
  };

  const updateItem = async (inspectionId: string, itemId: string, updates: Partial<DVIItem>) => {
    const token = localStorage.getItem('token');
    const r = await fetch(`/api/dvi/${inspectionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ items: [{ id: itemId, ...updates }] }),
    });
    if (r.ok) {
      const updated = await r.json();
      setSelected(updated);
      setInspections(prev => prev.map(i => i.id === inspectionId ? updated : i));
    }
  };

  const sendToCustomer = async (id: string) => {
    setSendError('');
    const token = localStorage.getItem('token');
    const r = await fetch(`/api/dvi/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ _action: 'send' }),
    });
    if (r.ok) { setSentId(id); setTimeout(() => setSentId(''), 3000); load(); }
    else { const d = await r.json().catch(() => ({})); setSendError(d.error || 'Failed to send to customer.'); }
  };

  const copyLink = (token: string | undefined) => {
    if (!token) return;
    const url = `${window.location.origin}/customer/dvi/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(''), 2000);
  };

  if (isLoading) return <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  const categories = selected ? [...new Set(selected.items.map(i => i.category))] : [];

  return (
    <div className="centered-app-page" style={{ minHeight: '100vh', background: 'transparent', color: '#e5e7eb', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}><FaSearch style={{marginRight:4}} /> Digital Vehicle Inspections</h1>
          <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: 14 }}>Multi-point inspections sent to customers for approval  -  average 35% upsell lift</p>
        </div>
        <button onClick={() => setShowNew(true)} style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>+ New DVI</button>
      </div>

      <div style={{ padding: 32, display: 'grid', gridTemplateColumns: selected ? '340px 1fr' : '1fr', gap: 24 }}>
        {/* List */}
        <div>
          {loading ? <div style={{ color: '#6b7280', padding: 32 }}>Loading...</div> :
            inspections.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 80 }}>
                <div style={{ fontSize: 64 }}><FaSearch style={{marginRight:4}} /></div>
                <div style={{ fontSize: 18, fontWeight: 600, margin: '16px 0 8px' }}>No inspections yet</div>
                <div style={{ color: '#9ca3af', marginBottom: 24 }}>Create your first DVI to start upselling approved work</div>
                <button onClick={() => setShowNew(true)} style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 28px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>+ Start First DVI</button>
              </div>
            ) : (
              inspections.map(insp => {
                const reds = insp.items.filter(i => i.condition === 'red').length;
                const yellows = insp.items.filter(i => i.condition === 'yellow').length;
                return (
                  <div key={insp.id} onClick={() => setSelected(insp)}
                    style={{ background: selected?.id === insp.id ? 'rgba(229,51,42,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${selected?.id === insp.id ? 'rgba(229,51,42,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 12, padding: '14px 18px', cursor: 'pointer', marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{insp.vehicleDesc || 'Vehicle'}</div>
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>{new Date(insp.createdAt).toLocaleDateString()}</div>
                      </div>
                      <span style={{
                        background: insp.status === 'approved' ? 'rgba(34,197,94,0.2)' : insp.status === 'sent' ? 'rgba(96,165,250,0.2)' : 'rgba(245,158,11,0.2)',
                        color: insp.status === 'approved' ? '#22c55e' : insp.status === 'sent' ? '#ff6b64' : '#f59e0b',
                        border: `1px solid ${insp.status === 'approved' ? '#22c55e' : insp.status === 'sent' ? '#ff6b64' : '#f59e0b'}`,
                        borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700, textTransform: 'capitalize',
                      }}>{insp.status}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                      {reds > 0 && <span style={{ color: '#e5332a' }}> {reds} urgent</span>}
                      {yellows > 0 && <span style={{ color: '#f59e0b' }}> {yellows} advisory</span>}
                      {insp.customerApproved && <span style={{ color: '#22c55e' }}><FaCheckCircle style={{marginRight:4}} /> Approved</span>}
                    </div>
                  </div>
                );
              })
            )}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20, overflowY: 'auto', maxHeight: '80vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18 }}>{selected.vehicleDesc || 'Vehicle Inspection'}</h3>
                <div style={{ fontSize: 13, color: '#9ca3af' }}>{selected.mileage ? `${selected.mileage.toLocaleString()} miles` : ''}  {new Date(selected.createdAt).toLocaleDateString()}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'transparent', color: '#6b7280', border: 'none', cursor: 'pointer', fontSize: 18 }}><FaTimes style={{marginRight:4}} /></button>
            </div>

            {/* Send / Copy Link */}
            {selected.status === 'in-progress' && (
              <button onClick={() => sendToCustomer(selected.id)}
                style={{ width: '100%', background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 16 }}>
                <FaUpload style={{marginRight:4}} /> Send to Customer for Approval
              </button>
            )}
            {selected.approvalToken && (
              <button onClick={() => copyLink(selected.approvalToken)}
                style={{ width: '100%', background: 'rgba(229,51,42,0.2)', color: '#ff6b64', border: '1px solid #e5332a', borderRadius: 8, padding: '10px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 16 }}>
                {copied === selected.approvalToken ? <><FaCheckCircle style={{marginRight:4}} /> Link Copied!</> : <><FaLink style={{marginRight:4}} /> Copy Customer Review Link</>}
              </button>
            )}

            {/* Items grouped by category */}
            {categories.map(cat => (
              <div key={cat} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{cat}</div>
                {selected.items.filter(i => i.category === cat).map(item => (
                  <div key={item.id} style={{ background: conditionBg[item.condition], border: `1px solid ${conditionColor[item.condition]}40`, borderRadius: 8, padding: '10px 14px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{item.itemName}</div>
                      {item.notes && <div style={{ fontSize: 12, color: '#9ca3af' }}>{item.notes}</div>}
                      {item.estimatedCost && <div style={{ fontSize: 12, color: '#f59e0b' }}>${item.estimatedCost}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {['green', 'yellow', 'red'].map(c => (
                        <button key={c} onClick={() => updateItem(selected.id, item.id, { condition: c })}
                          style={{ background: item.condition === c ? conditionColor[c] : 'transparent', border: `2px solid ${conditionColor[c]}`, borderRadius: '50%', width: 22, height: 22, cursor: 'pointer' }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {/* Summary */}
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 14, marginTop: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Inspection Summary</div>
              <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                <span style={{ color: '#22c55e' }}> {selected.items.filter(i => i.condition === 'green').length} Good</span>
                <span style={{ color: '#f59e0b' }}> {selected.items.filter(i => i.condition === 'yellow').length} Advisory</span>
                <span style={{ color: '#e5332a' }}> {selected.items.filter(i => i.condition === 'red').length} Urgent</span>
              </div>
              {selected.items.some(i => i.estimatedCost) && (
                <div style={{ marginTop: 8, fontSize: 14, fontWeight: 700, color: '#f59e0b' }}>
                  Upsell Opportunity: ${selected.items.reduce((s, i) => s + (i.estimatedCost || 0), 0).toFixed(2)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* New DVI Modal */}
      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 28, width: 420, maxWidth: '90%' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18 }}>Start New DVI</h3>
            <p style={{ color: '#9ca3af', fontSize: 13, marginTop: 0, marginBottom: 20 }}>A 19-point inspection template will be created. You can adjust each item&apos;s condition () after creation.</p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Work Order (from bays/waiting)</label>
              <select
                value={newForm.workOrderId}
                onChange={(e) => {
                  const selectedWo = workOrderOptions.find((wo) => wo.id === e.target.value);
                  setNewForm((p) => ({
                    ...p,
                    workOrderId: e.target.value,
                    vehicleDesc: selectedWo
                      ? `${selectedWo?.vehicle?.year ? `${selectedWo.vehicle.year} ` : ''}${selectedWo?.vehicle?.make || ''} ${selectedWo?.vehicle?.model || ''}`.trim() || p.vehicleDesc
                      : p.vehicleDesc,
                  }));
                }}
                style={{ width: '100%', background: '#374151', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 14 }}
              >
                <option value="">Select work order...</option>
                {workOrderOptions.map((wo) => (
                  <option key={wo.id} value={wo.id}>
                    #{wo.id.slice(-6).toUpperCase()}  {wo?.vehicle?.year || ''} {wo?.vehicle?.make || ''} {wo?.vehicle?.model || ''}
                  </option>
                ))}
              </select>
            </div>
            {[['vehicleDesc', 'Vehicle (Year/Make/Model)'], ['mileage', 'Current Mileage'], ['notes', 'Notes (optional)']].map(([k, label]) => (
              <div key={k} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>{label}</label>
                <input value={(newForm as any)[k]} onChange={e => setNewForm(p => ({ ...p, [k]: e.target.value }))}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={createInspection} disabled={saving} style={{ flex: 1, background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{saving ? 'Creating...' : 'Create DVI'}</button>
              <button onClick={() => setShowNew(false)} style={{ flex: 1, background: 'transparent', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '11px 0', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

