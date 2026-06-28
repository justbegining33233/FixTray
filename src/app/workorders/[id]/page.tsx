'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  FaArrowLeft, FaUser, FaCar, FaWrench, FaMapMarkerAlt,
  FaCalendarAlt, FaDollarSign, FaComment, FaBox, FaTruck,
  FaCheckCircle, FaClock, FaExclamationCircle, FaPlus, FaTrash,
  FaPaperPlane, FaSave,
} from 'react-icons/fa';

// ─── Types ────────────────────────────────────────────────────────────────────

type WOMessage = { id: string; sender: string; senderName: string; body: string; createdAt: string };
type Vehicle   = { id: string; vehicleType: string; make?: string; model?: string; year?: number; vin?: string; licensePlate?: string };

type LineItem = { _key: string; type: 'labor' | 'part' | 'misc'; description: string; partNumber: string; price: number; qty: number; status: 'new' | 'saved'; };

type WorkOrder = {
  id: string; status: string; paymentStatus: string;
  vehicleType: string; serviceLocation: string;
  issueDescription: string | Record<string, unknown>;
  bay?: number | null; estimatedCost?: number | null;
  dueDate?: string | null; createdAt: string;
  repairs?: unknown; maintenance?: unknown; partsMaterials?: unknown;
  partsUsed?: unknown; techLabor?: unknown; estimate?: unknown; location?: unknown;
  customer?: { id: string; firstName: string; lastName: string; email?: string; phone?: string; company?: string };
  assignedTo?: { id: string; firstName: string; lastName: string };
  vehicle?: Vehicle | null;
  messages?: WOMessage[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2);

function toArr(raw: unknown): Record<string, unknown>[] {
  if (!raw) return [];
  try {
    const a = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(a) ? a : [a];
  } catch { return []; }
}

function parseLineItems(wo: WorkOrder): LineItem[] {
  const items: LineItem[] = [];
  // Labor from techLabor
  toArr(wo.techLabor).forEach(item => {
    items.push({ _key: uid(), type: 'labor', description: String(item.description || item.name || item.service || ''), partNumber: '', price: Number(item.rate || item.unitPrice || 0), qty: Number(item.hours || item.quantity || 1), status: 'saved' });
  });
  // Parts from partsUsed
  toArr(wo.partsUsed).forEach(item => {
    items.push({ _key: uid(), type: 'part', description: String(item.name || item.description || item.part || ''), partNumber: String(item.sku || item.partNumber || ''), price: Number(item.unitPrice || item.price || 0), qty: Number(item.quantity || item.qty || 1), status: 'saved' });
  });
  // Misc from estimate.lineItems
  try {
    const est = wo.estimate ? (typeof wo.estimate === 'string' ? JSON.parse(wo.estimate) : wo.estimate) as Record<string, unknown> : null;
    if (Array.isArray(est?.lineItems)) {
      (est.lineItems as Record<string, unknown>[]).forEach(item => {
        items.push({ _key: uid(), type: 'misc', description: String(item.description || ''), partNumber: '', price: Number(item.unitPrice || 0), qty: Number(item.quantity || 1), status: 'saved' });
      });
    }
  } catch { /* ignore */ }
  return items;
}

function fmt(n: number) { return `$${n.toFixed(2)}`; }

const STATUS_STYLES: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
  pending:               { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b',  icon: <FaClock /> },
  assigned:              { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa',  icon: <FaWrench /> },
  'in-progress':         { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa',  icon: <FaWrench /> },
  'waiting-estimate':    { bg: 'rgba(139,92,246,0.15)',  color: '#a78bfa',  icon: <FaClock /> },
  'waiting-for-payment': { bg: 'rgba(239,68,68,0.15)',   color: '#f87171',  icon: <FaDollarSign /> },
  completed:             { bg: 'rgba(34,197,94,0.15)',   color: '#22c55e',  icon: <FaCheckCircle /> },
  cancelled:             { bg: 'rgba(107,114,128,0.15)', color: '#9ca3af',  icon: <FaExclamationCircle /> },
};
function statusStyle(s: string) { return STATUS_STYLES[s?.toLowerCase()] ?? STATUS_STYLES['pending']; }

function parseIssue(raw: unknown): string {
  if (!raw) return 'No description provided.';
  if (typeof raw === 'string') {
    try { const p = JSON.parse(raw); return p?.symptoms || p?.description || raw; } catch { return raw; }
  }
  if (typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    return (r.symptoms as string) || (r.description as string) || JSON.stringify(raw);
  }
  return String(raw);
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function Card({ title, icon, action, children }: { title: string; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: '#e5332a', fontSize: 13 }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#e5e7eb', textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1 }}>{title}</span>
        {action}
      </div>
      <div style={{ padding: '14px 16px' }}>{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '') return null;
  return (
    <div>
      <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#e5e7eb' }}>{value}</div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 6, color: '#e5e7eb', fontSize: 13, padding: '5px 8px', width: '100%', boxSizing: 'border-box',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkOrderDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [wo, setWo]           = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  // Editable line-item state
  const [lineItems,  setLineItems]    = useState<LineItem[]>([]);
  const [saving,     setSaving]       = useState(false);
  const [saveMsg,    setSaveMsg]      = useState('');

  // Messaging state
  const [messages,   setMessages]     = useState<WOMessage[]>([]);
  const [msgText,    setMsgText]      = useState('');
  const [sending,    setSending]      = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load work order
  useEffect(() => {
    if (!id) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    fetch(`/api/workorders/${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        const w: WorkOrder = data?.workOrder ?? data;
        setWo(w);
        setLineItems(parseLineItems(w));
        setMessages(w.messages ?? []);
      })
      .catch(code => setError(
        code === 404 ? 'Work order not found.' : code === 403 ? 'Not authorized.' : 'Failed to load work order.'
      ))
      .finally(() => setLoading(false));
  }, [id]);

  // Scroll messages to bottom when new ones arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Computed totals ────────────────────────────────────────────────────────
  const grandTotal = lineItems.reduce((s, li) => s + li.price * li.qty, 0);

  // ── Save line items ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!id) return;
    setSaving(true); setSaveMsg('');
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    try {
      const laborItems = lineItems.filter(li => li.type === 'labor');
      const partItems  = lineItems.filter(li => li.type === 'part');
      const miscItems  = lineItems.filter(li => li.type === 'misc');
      const res = await fetch(`/api/workorders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          techLabor: laborItems.map(({ description, qty, price }) => ({ description, hours: qty, rate: price })),
          partsUsed: partItems.map(({ description, partNumber, qty, price }) => ({ name: description, sku: partNumber || undefined, quantity: qty, unitPrice: price })),
          estimate: {
            lineItems: miscItems.map(({ description, qty, price }) => ({ description, quantity: qty, unitPrice: price, total: qty * price })),
            subtotal: grandTotal,
            total: grandTotal,
          },
          estimatedCost: grandTotal,
        }),
      });
      if (res.ok) {
        setLineItems(prev => prev.map(li => ({ ...li, status: 'saved' })));
        setSaveMsg('Saved!');
        setTimeout(() => setSaveMsg(''), 3000);
      } else { setSaveMsg('Save failed.'); }
    } catch { setSaveMsg('Save failed.'); }
    finally { setSaving(false); }
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSendMessage = async () => {
    if (!id || !msgText.trim()) return;
    setSending(true);
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    try {
      const res = await fetch(`/api/workorders/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ body: msgText.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, data.message]);
        setMsgText('');
      }
    } finally { setSending(false); }
  };

  // ─── Loading / error states ──────────────────────────────────────────────
  if (loading) return (
    <main style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9aa3b2' }}>
      Loading work order…
    </main>
  );

  if (error || !wo) return (
    <main style={{ minHeight: '100vh', background: '#0a0a0a', padding: '40px 24px' }}>
      <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#9aa3b2', fontSize: 14, cursor: 'pointer', marginBottom: 24 }}>
        <FaArrowLeft /> Back
      </button>
      <div style={{ color: '#f87171' }}>{error || 'Work order not found.'}</div>
    </main>
  );

  const ss           = statusStyle(wo.status);
  const shortId      = wo.id.slice(-8).toUpperCase();
  const customerName = wo.customer ? `${wo.customer.firstName} ${wo.customer.lastName}`.trim() : 'Unknown';
  const techName     = wo.assignedTo ? `${wo.assignedTo.firstName} ${wo.assignedTo.lastName}`.trim() : null;
  const issueText    = parseIssue(wo.issueDescription);
  const locationLabel = wo.serviceLocation === 'road-call' ? 'Road Call' : wo.serviceLocation === 'in-shop' ? 'In Shop' : wo.serviceLocation;

  let pickupAddr: string | null = null;
  if (wo.serviceLocation === 'road-call' && wo.location) {
    try {
      const loc = typeof wo.location === 'string' ? JSON.parse(wo.location) : wo.location as Record<string, unknown>;
      pickupAddr = (loc.address || loc.pickupAddress || loc.location) as string | null;
    } catch { /* ignore */ }
  }

  // Table header style
  const thStyle: React.CSSProperties = { fontSize: 11, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', padding: '4px 6px', textAlign: 'left' };
  const tdStyle: React.CSSProperties = { padding: '4px 4px', verticalAlign: 'middle' };

  return (
    <main style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e7eb' }}>

      {/* ── Top bar ── */}
      <div style={{ background: '#111111', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e5e7eb', fontSize: 13, fontWeight: 600, borderRadius: 8, padding: '7px 14px', cursor: 'pointer' }}>
          <FaArrowLeft style={{ fontSize: 11 }} /> Back
        </button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>WO-{shortId}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: ss.bg, color: ss.color, borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
            {ss.icon}&nbsp;{wo.status.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </span>
          {wo.serviceLocation === 'road-call' && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
              <FaTruck style={{ fontSize: 11 }} /> Road Call
            </span>
          )}
        </div>
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          Created {new Date(wo.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}{' '}
          {new Date(wo.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* ── Body ── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 24px 64px' }}>

        {/* Info cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <Card title="Customer" icon={<FaUser />}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Field label="Name"    value={customerName} />
              <Field label="Company" value={wo.customer?.company} />
              <Field label="Phone"   value={wo.customer?.phone} />
              <Field label="Email"   value={wo.customer?.email} />
            </div>
          </Card>
          <Card title="Vehicle" icon={<FaCar />}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Field label="Type"               value={wo.vehicle?.vehicleType || wo.vehicleType} />
              <Field label="Year / Make / Model" value={wo.vehicle ? [wo.vehicle.year, wo.vehicle.make, wo.vehicle.model].filter(Boolean).join(' ') || undefined : undefined} />
              <Field label="VIN"                value={wo.vehicle?.vin} />
              <Field label="License Plate"      value={wo.vehicle?.licensePlate} />
            </div>
          </Card>
          <Card title="Work Order Info" icon={<FaWrench />}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Field label="Service Location" value={locationLabel} />
              <Field label="Bay"              value={wo.bay != null ? `Bay ${wo.bay}` : null} />
              <Field label="Assigned Tech"    value={techName ?? 'Unassigned'} />
              <Field label="Due Date"         value={wo.dueDate ? new Date(wo.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null} />
              <Field label="Est. Cost"        value={wo.estimatedCost != null ? `$${wo.estimatedCost.toFixed(2)}` : null} />
              <Field label="Payment Status"   value={wo.paymentStatus?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} />
            </div>
          </Card>
        </div>

        {/* Issue */}
        <div style={{ marginTop: 16 }}>
          <Card title="Issue Description" icon={<FaExclamationCircle />}>
            <p style={{ margin: 0, fontSize: 14, color: '#e5e7eb', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{issueText}</p>
          </Card>
        </div>

        {/* ── Repairs & Parts ── */}
        <div style={{ marginTop: 16 }}>
          <Card
            title="Line Items"
            icon={<FaBox />}
            action={
              <button onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 5, background: saving ? 'transparent' : saveMsg === 'Saved!' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${saveMsg === 'Saved!' ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`, color: saveMsg === 'Saved!' ? '#22c55e' : '#e5e7eb', fontSize: 12, fontWeight: 700, borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
                <FaSave style={{ fontSize: 11 }} /> {saving ? 'Saving…' : saveMsg || 'Save'}
              </button>
            }
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={thStyle}>Description</th>
                    <th style={{ ...thStyle, width: 110 }}>Part #</th>
                    <th style={{ ...thStyle, width: 90 }}>Price</th>
                    <th style={{ ...thStyle, width: 70 }}>Qty</th>
                    <th style={{ ...thStyle, width: 90 }}>Ext Price</th>
                    <th style={{ ...thStyle, width: 70 }}>Type</th>
                    <th style={{ ...thStyle, width: 60 }}>Status</th>
                    <th style={{ ...thStyle, width: 32 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: '20px 6px', textAlign: 'center', fontSize: 13, color: '#6b7280' }}>No line items yet — add one below.</td></tr>
                  )}
                  {lineItems.map(li => (
                    <tr key={li._key} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={tdStyle}>
                        <input style={inputStyle} value={li.description} onChange={e => setLineItems(prev => prev.map(x => x._key === li._key ? { ...x, description: e.target.value, status: 'new' } : x))} placeholder="Description" />
                      </td>
                      <td style={tdStyle}>
                        <input style={inputStyle} value={li.partNumber} onChange={e => setLineItems(prev => prev.map(x => x._key === li._key ? { ...x, partNumber: e.target.value, status: 'new' } : x))} placeholder="—" />
                      </td>
                      <td style={tdStyle}>
                        <input style={{ ...inputStyle, textAlign: 'right' }} type="number" min={0} step={0.01} value={li.price} onChange={e => setLineItems(prev => prev.map(x => x._key === li._key ? { ...x, price: Number(e.target.value), status: 'new' } : x))} />
                      </td>
                      <td style={tdStyle}>
                        <input style={{ ...inputStyle, textAlign: 'right' }} type="number" min={0} step={li.type === 'labor' ? 0.25 : 1} value={li.qty} onChange={e => setLineItems(prev => prev.map(x => x._key === li._key ? { ...x, qty: Number(e.target.value), status: 'new' } : x))} />
                      </td>
                      <td style={{ ...tdStyle, fontSize: 13, color: '#e5e7eb', fontWeight: 600, textAlign: 'right', paddingRight: 8 }}>{fmt(li.price * li.qty)}</td>
                      <td style={tdStyle}>
                        <select style={{ ...inputStyle, padding: '5px 4px' }} value={li.type} onChange={e => setLineItems(prev => prev.map(x => x._key === li._key ? { ...x, type: e.target.value as LineItem['type'], status: 'new' } : x))}>
                          <option value="part">Part</option>
                          <option value="labor">Labor</option>
                          <option value="misc">Misc</option>
                        </select>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: li.status === 'saved' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.15)', color: li.status === 'saved' ? '#22c55e' : '#f59e0b' }}>
                          {li.status === 'saved' ? 'Saved' : 'New'}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <button onClick={() => setLineItems(prev => prev.filter(x => x._key !== li._key))} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 13, padding: '4px' }}><FaTrash /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add row + totals */}
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <button onClick={() => setLineItems(prev => [...prev, { _key: uid(), type: 'part', description: '', partNumber: '', price: 0, qty: 1, status: 'new' }])} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'transparent', border: '1px dashed rgba(255,255,255,0.15)', color: '#9aa3b2', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
                <FaPlus style={{ fontSize: 10 }} /> Add Line Item
              </button>
              {grandTotal > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {lineItems.filter(li => li.type === 'labor').reduce((s, li) => s + li.price * li.qty, 0) > 0 && <span style={{ fontSize: 12, color: '#9aa3b2' }}>Labor {fmt(lineItems.filter(li => li.type === 'labor').reduce((s, li) => s + li.price * li.qty, 0))}</span>}
                  {lineItems.filter(li => li.type === 'part').reduce((s, li) => s + li.price * li.qty, 0) > 0 && <span style={{ fontSize: 12, color: '#9aa3b2' }}>Parts {fmt(lineItems.filter(li => li.type === 'part').reduce((s, li) => s + li.price * li.qty, 0))}</span>}
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#22c55e' }}>Total {fmt(grandTotal)}</span>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Pickup location */}
        {pickupAddr && (
          <div style={{ marginTop: 16 }}>
            <Card title="Pickup Location" icon={<FaMapMarkerAlt />}>
              <p style={{ margin: 0, fontSize: 14, color: '#e5e7eb' }}>{pickupAddr}</p>
            </Card>
          </div>
        )}

        {/* ── Customer Messages ── */}
        <div style={{ marginTop: 16 }}>
          <Card title={`Customer Messages${messages.length ? ` (${messages.length})` : ''}`} icon={<FaComment />}>
            {/* Thread */}
            <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14, paddingRight: 4 }}>
              {messages.length === 0 && (
                <div style={{ fontSize: 13, color: '#6b7280', padding: '16px 0', textAlign: 'center' }}>
                  No messages yet. Send the first one below.
                </div>
              )}
              {messages.map(msg => {
                const isShop = ['shop', 'tech', 'manager'].includes(msg.sender);
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isShop ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '80%', padding: '8px 12px', borderRadius: isShop ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      background: isShop ? 'rgba(229,51,42,0.18)' : 'rgba(255,255,255,0.07)',
                      border: `1px solid ${isShop ? 'rgba(229,51,42,0.3)' : 'rgba(255,255,255,0.1)'}`,
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: isShop ? '#e5332a' : '#60a5fa', marginBottom: 4 }}>{msg.senderName || msg.sender}</div>
                      <p style={{ margin: 0, fontSize: 13, color: '#e5e7eb', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{msg.body}</p>
                    </div>
                    <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2, paddingInline: 4 }}>
                      {new Date(msg.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{' '}
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Compose */}
            <div style={{ display: 'flex', gap: 8 }}>
              <textarea
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSendMessage(); }}
                placeholder="Type a message… (Ctrl+Enter to send)"
                rows={2}
                style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#e5e7eb', fontSize: 13, padding: '8px 12px', resize: 'vertical', fontFamily: 'inherit' }}
              />
              <button
                onClick={handleSendMessage}
                disabled={sending || !msgText.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 16px', background: 'rgba(229,51,42,0.18)', border: '1px solid rgba(229,51,42,0.3)', color: '#e5332a', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (!msgText.trim() || sending) ? 0.5 : 1 }}
              >
                <FaPaperPlane style={{ fontSize: 12 }} /> {sending ? '…' : 'Send'}
              </button>
            </div>
          </Card>
        </div>

        {/* Timeline */}
        <div style={{ marginTop: 16 }}>
          <Card title="Timeline" icon={<FaCalendarAlt />}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              <Field label="Created" value={`${new Date(wo.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} ${new Date(wo.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`} />
              {wo.dueDate && <Field label="Due" value={new Date(wo.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} />}
            </div>
          </Card>
        </div>

      </div>
    </main>
  );
}

