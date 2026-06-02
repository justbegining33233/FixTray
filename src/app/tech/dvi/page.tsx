'use client';
import { useState } from 'react';
import Link from 'next/link';
import useRequireAuth from '@/lib/useRequireAuth';
import { FaCheckCircle, FaClipboardList, FaWrench } from 'react-icons/fa';

const INSPECTION_TEMPLATE = [
  { category: 'Engine', itemName: 'Engine Oil Level & Condition' },
  { category: 'Engine', itemName: 'Air Filter' },
  { category: 'Engine', itemName: 'Serpentine Belt' },
  { category: 'Engine', itemName: 'PCV Valve' },
  { category: 'Cooling', itemName: 'Coolant Level & Condition' },
  { category: 'Cooling', itemName: 'Radiator Hoses' },
  { category: 'Brakes', itemName: 'Front Brake Pads' },
  { category: 'Brakes', itemName: 'Rear Brake Pads' },
  { category: 'Brakes', itemName: 'Brake Fluid' },
  { category: 'Brakes', itemName: 'Rotors' },
  { category: 'Tires', itemName: 'Front Left Tire (32nds)' },
  { category: 'Tires', itemName: 'Front Right Tire (32nds)' },
  { category: 'Tires', itemName: 'Rear Left Tire (32nds)' },
  { category: 'Tires', itemName: 'Rear Right Tire (32nds)' },
  { category: 'Fluids', itemName: 'Power Steering Fluid' },
  { category: 'Fluids', itemName: 'Transmission Fluid' },
  { category: 'Fluids', itemName: 'Differential Fluid' },
  { category: 'Electrical', itemName: 'Battery & Terminals' },
  { category: 'Electrical', itemName: 'Alternator' },
  { category: 'Lights', itemName: 'Headlights' },
  { category: 'Lights', itemName: 'Brake Lights' },
  { category: 'Lights', itemName: 'Turn Signals' },
  { category: 'Suspension', itemName: 'Front Shocks/Struts' },
  { category: 'Suspension', itemName: 'Rear Shocks/Struts' },
  { category: 'Suspension', itemName: 'CV Axles' },
  { category: 'Wipers', itemName: 'Wiper Blades' },
  { category: 'Exhaust', itemName: 'Exhaust System' },
];

type Condition = 'green' | 'yellow' | 'red';

interface InspectionItem {
  category: string;
  itemName: string;
  condition: Condition;
  notes: string;
  estimatedCost: string;
}

const conditionLabel: Record<Condition, string> = { green: ' OK', yellow: ' Advisory', red: ' Urgent' };
const conditionStyle: Record<Condition, { bg: string; border: string }> = {
  green: { bg: 'rgba(34,197,94,0.12)', border: '#22c55e40' },
  yellow: { bg: 'rgba(245,158,11,0.12)', border: '#f59e0b40' },
  red: { bg: 'rgba(229,51,42,0.12)', border: '#e5332a40' },
};

export default function TechDVIPage() {
  const { user, isLoading } = useRequireAuth(['tech']);
  const [vehicleDesc, setVehicleDesc] = useState('');
  const [mileage, setMileage] = useState('');
  const [workOrderId, setWorkOrderId] = useState('');
  const [items, setItems] = useState<InspectionItem[]>(
    INSPECTION_TEMPLATE.map(t => ({ ...t, condition: 'green', notes: '', estimatedCost: '' }))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [inspectionLink, setInspectionLink] = useState('');
  const [activeCategory, setActiveCategory] = useState('Engine');
  const [dviError, setDviError] = useState('');
  const categories = [...new Set(INSPECTION_TEMPLATE.map(t => t.category))];

  const updateItem = (idx: number, field: keyof InspectionItem, value: string) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const submit = async () => {
    if (!vehicleDesc) { setDviError('Please enter vehicle description.'); return; }
    setSaving(true);
    const token = localStorage.getItem('token');
    const r = await fetch('/api/dvi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        vehicleDesc,
        mileage: mileage ? Number(mileage) : null,
        workOrderId: workOrderId || null,
        items: items.map(i => ({ ...i, estimatedCost: i.estimatedCost ? Number(i.estimatedCost) : null })),
      }),
    });
    if (r.ok) {
      const data = await r.json();
      setSaved(true);
      if (data.approvalToken) setInspectionLink(`${window.location.origin}/customer/dvi/${data.approvalToken}`);
    }
    setSaving(false);
  };

  const _sendToCustomer = async (id: string) => {
    const token = localStorage.getItem('token');
    await fetch(`/api/dvi/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ _action: 'send' }),
    });
  };

  if (isLoading) return <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  if (saved) return (
    <div style={{ minHeight: '100vh', background: 'transparent', color: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <div style={{ fontSize: 72, marginBottom: 16 }}><FaCheckCircle style={{marginRight:4}} /></div>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px' }}>DVI Submitted!</h2>
        <p style={{ color: '#9ca3af', marginBottom: 24 }}>The inspection has been saved. Share the link below with the customer so they can review and approve recommended services.</p>
        {inspectionLink && (
          <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 14, marginBottom: 20, wordBreak: 'break-all', fontSize: 13 }}>{inspectionLink}</div>
        )}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          {inspectionLink && <button onClick={() => { navigator.clipboard.writeText(inspectionLink); }} style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}><FaClipboardList style={{marginRight:4}} /> Copy Link</button>}
          <button onClick={() => { setSaved(false); setVehicleDesc(''); setMileage(''); setWorkOrderId(''); setItems(INSPECTION_TEMPLATE.map(t => ({ ...t, condition: 'green', notes: '', estimatedCost: '' }))); }} style={{ background: 'rgba(255,255,255,0.08)', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer' }}>New Inspection</button>
          <Link href="/shop/dvi" style={{ background: '#e5332a', color: '#fff', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>View All DVIs</Link>
        </div>
      </div>
    </div>
  );

  const categorizedItems = items.reduce<Record<string, { item: InspectionItem; idx: number }[]>>((acc, item, idx) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push({ item, idx });
    return acc;
  }, {});

  return (
    <div className="centered-app-page" style={{ minHeight: '100vh', background: 'transparent', color: '#e5e7eb', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '20px 28px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}><FaWrench style={{marginRight:4}} /> Digital Vehicle Inspection</h1>
        <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: 13 }}>Rate each item green/yellow/red and add notes for any concerns</p>
      </div>

      <div style={{ padding: '24px 28px', maxWidth: 800 }}>
        {/* Vehicle Info */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Vehicle Information</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: '#9ca3af', display: 'block', marginBottom: 5 }}>Vehicle *</label>
              <input placeholder="2019 Toyota Camry" value={vehicleDesc} onChange={e => setVehicleDesc(e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '9px 12px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#9ca3af', display: 'block', marginBottom: 5 }}>Mileage</label>
              <input placeholder="85,000" value={mileage} onChange={e => setMileage(e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '9px 12px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#9ca3af', display: 'block', marginBottom: 5 }}>Work Order ID</label>
              <input placeholder="WO-001" value={workOrderId} onChange={e => setWorkOrderId(e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '9px 12px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
          </div>
        </div>

        {/* Progress Summary */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {(['green', 'yellow', 'red'] as Condition[]).map(c => (
            <div key={c} style={{ background: conditionStyle[c].bg, border: `1px solid ${conditionStyle[c].border}`, borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 600 }}>
              {conditionLabel[c]}  -  {items.filter(i => i.condition === c).length}
            </div>
          ))}
          {items.some(i => i.estimatedCost) && (
            <div style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid #f59e0b40', borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 600, color: '#f59e0b' }}>
               ${items.reduce((s, i) => s + (i.estimatedCost ? Number(i.estimatedCost) : 0), 0).toFixed(2)} upsell
            </div>
          )}
        </div>

        {/* Category Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {categories.map(cat => {
            const catItems = categorizedItems[cat] || [];
            const hasRed = catItems.some(({ item }) => item.condition === 'red');
            const hasYellow = catItems.some(({ item }) => item.condition === 'yellow');
            return (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                style={{ background: activeCategory === cat ? '#e5332a' : 'rgba(255,255,255,0.06)', color: activeCategory === cat ? '#fff' : '#e5e7eb', border: `1px solid ${activeCategory === cat ? '#e5332a' : 'rgba(255,255,255,0.12)'}`, borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {cat} {hasRed ? '' : hasYellow ? '' : ''}
              </button>
            );
          })}
        </div>

        {/* Active Category Items */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 24 }}>
          {(categorizedItems[activeCategory] || []).map(({ item, idx }) => (
            <div key={idx} style={{ background: conditionStyle[item.condition].bg, border: `1px solid ${conditionStyle[item.condition].border}`, borderRadius: 10, padding: 14, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{item.itemName}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['green', 'yellow', 'red'] as Condition[]).map(c => (
                    <button key={c} onClick={() => updateItem(idx, 'condition', c)}
                      style={{ background: item.condition === c ? (c === 'green' ? '#22c55e' : c === 'yellow' ? '#f59e0b' : '#e5332a') : 'rgba(255,255,255,0.06)', color: item.condition === c ? '#fff' : '#9ca3af', border: `1px solid ${c === 'green' ? '#22c55e' : c === 'yellow' ? '#f59e0b' : '#e5332a'}40`, borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {c === 'green' ? 'OK' : c === 'yellow' ? 'Advisory' : 'Urgent'}
                    </button>
                  ))}
                </div>
              </div>
              {item.condition !== 'green' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                  <input placeholder="Add notes (e.g., 2mm remaining, replace soon)" value={item.notes} onChange={e => updateItem(idx, 'notes', e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, padding: '8px 12px', color: '#e5e7eb', fontSize: 13 }} />
                  <input placeholder="Est. $" value={item.estimatedCost} onChange={e => updateItem(idx, 'estimatedCost', e.target.value)} type="number"
                    style={{ width: 90, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, padding: '8px 12px', color: '#e5e7eb', fontSize: 13 }} />
                </div>
              )}
            </div>
          ))}
        </div>

        {dviError && <p style={{color:'#ef4444',fontSize:13,margin:'0 0 12px',fontWeight:600}}>{dviError}</p>}
        <button onClick={submit} disabled={saving}
          style={{ width: '100%', background: '#e5332a', color: '#fff', border: 'none', borderRadius: 10, padding: '14px 0', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
          {saving ? 'Submitting...' : <><FaCheckCircle style={{marginRight:4}} /> Submit Inspection</>}
        </button>
      </div>
    </div>
  );
}

