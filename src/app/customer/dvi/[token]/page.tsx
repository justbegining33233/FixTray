'use client';

import { useState, useEffect, ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { FaCheckCircle, FaExclamationTriangle, FaSearch } from 'react-icons/fa';

interface DVIItem {
  id: string;
  category: string;
  itemName: string;
  condition: string;
  notes?: string;
  estimatedCost?: number;
  approved: boolean;
}

interface DVIInspection {
  id: string;
  vehicleDesc?: string;
  mileage?: number;
  status: string;
  customerApproved: boolean;
  approvedAt?: string;
  notes?: string;
  createdAt: string;
  items: DVIItem[];
}

const conditionColor: Record<string, string> = {
  green: '#22c55e',
  yellow: '#f59e0b',
  red: '#e5332a',
};
const conditionBg: Record<string, string> = {
  green: 'rgba(34,197,94,0.1)',
  yellow: 'rgba(245,158,11,0.1)',
  red: 'rgba(229,51,42,0.1)',
};
const conditionLabel: Record<string, ReactNode> = {
  green: <><FaCheckCircle style={{marginRight:4}} /> Good</>,
  yellow: <><FaExclamationTriangle style={{marginRight:4}} /> Attention</>,
  red: ' Urgent',
};

export default function CustomerDVIPage() {
  const params = useParams();
  const token = params?.token as string;

  const [inspection, setInspection] = useState<DVIInspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/dvi/token/${token}`)
      .then(r => {
        if (!r.ok) throw new Error('Inspection not found');
        return r.json();
      })
      .then(d => { setInspection(d); setLoading(false); })
      .catch(err => { setError(err.message || 'Failed to load inspection'); setLoading(false); });
  }, [token]);

  const handleApprove = async () => {
    if (!inspection) return;
    setApproving(true);
    try {
      const r = await fetch(`/api/dvi/token/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      if (r.ok) { setApproved(true); setInspection(p => p ? { ...p, customerApproved: true } : p); }
      else { const d = await r.json().catch(() => ({})); setError(d.error || 'Failed to approve.'); }
    } catch { setError('Network error.'); }
    setApproving(false);
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>
      Loading inspection...
    </div>
  );

  if (error || !inspection) return (
    <div style={{ minHeight: '100vh', background: '#000000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb', textAlign: 'center', padding: 32 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}><FaSearch style={{marginRight:4}} /></div>
      <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>Inspection Not Found</h2>
      <p style={{ color: '#9ca3af' }}>{error || 'This inspection link may have expired or is invalid.'}</p>
    </div>
  );

  const categories = [...new Set(inspection.items.map(i => i.category))];
  const urgentItems = inspection.items.filter(i => i.condition === 'red');
  const attentionItems = inspection.items.filter(i => i.condition === 'yellow');
  const totalEstimate = inspection.items.filter(i => i.condition !== 'green' && i.estimatedCost).reduce((s, i) => s + (i.estimatedCost || 0), 0);

  return (
    <div style={{ minHeight: '100vh', background: '#000000', color: '#e5e7eb', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#1f2937', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '20px 24px' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}><FaSearch style={{marginRight:4}} /> Vehicle Inspection Report</h1>
        {inspection.vehicleDesc && (
          <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: 14 }}>{inspection.vehicleDesc}{inspection.mileage ? `  ${inspection.mileage.toLocaleString()} miles` : ''}</p>
        )}
        <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>{new Date(inspection.createdAt).toLocaleDateString()}</p>
      </div>

      <div style={{ padding: '24px 16px', maxWidth: 640, margin: '0 auto' }}>
        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          <div style={{ background: 'rgba(229,51,42,0.1)', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#e5332a' }}>{urgentItems.length}</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>Urgent</div>
          </div>
          <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b' }}>{attentionItems.length}</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>Attention</div>
          </div>
          {totalEstimate > 0 && (
            <div style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#60a5fa' }}>${totalEstimate.toFixed(0)}</div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Est. Repairs</div>
            </div>
          )}
        </div>

        {/* Items by Category */}
        {categories.map(cat => {
          const catItems = inspection.items.filter(i => i.category === cat);
          return (
            <div key={cat} style={{ marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>{cat}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {catItems.map(item => (
                  <div key={item.id} style={{ background: conditionBg[item.condition], border: `1px solid ${conditionColor[item.condition]}33`, borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{item.itemName}</div>
                      {item.notes && <div style={{ color: '#9ca3af', fontSize: 13, marginTop: 4 }}>{item.notes}</div>}
                      {item.estimatedCost && item.condition !== 'green' && (
                        <div style={{ color: '#60a5fa', fontSize: 13, marginTop: 4 }}>Est. ${item.estimatedCost.toFixed(2)}</div>
                      )}
                    </div>
                    <span style={{ color: conditionColor[item.condition], fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', marginLeft: 12 }}>
                      {conditionLabel[item.condition] || item.condition}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Approval */}
        {!inspection.customerApproved && !approved ? (
          <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, padding: 20, marginTop: 24, textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Approve Recommended Services</h3>
            <p style={{ color: '#9ca3af', fontSize: 14, margin: '0 0 16px' }}>By approving, you authorize the shop to proceed with the recommended repairs.</p>
            <button onClick={handleApprove} disabled={approving}
              style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 32px', fontSize: 15, fontWeight: 700, cursor: approving ? 'not-allowed' : 'pointer' }}>
              {approving ? 'Approving...' : <><FaCheckCircle style={{marginRight:4}} /> Approve Services</>}
            </button>
            {error && <div style={{ color: '#ef4444', fontSize: 13, marginTop: 10 }}>{error}</div>}
          </div>
        ) : (
          <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, padding: 20, marginTop: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 40 }}><FaCheckCircle style={{marginRight:4}} /></div>
            <h3 style={{ margin: '8px 0 4px', fontSize: 16 }}>Services Approved</h3>
            <p style={{ color: '#9ca3af', fontSize: 14, margin: 0 }}>Your shop has been notified. They will proceed with the approved repairs.</p>
          </div>
        )}
      </div>
    </div>
  );
}
