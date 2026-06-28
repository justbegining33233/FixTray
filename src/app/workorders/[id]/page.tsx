'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  FaArrowLeft, FaUser, FaCar, FaWrench, FaMapMarkerAlt,
  FaCalendarAlt, FaDollarSign, FaComment, FaBox, FaTruck,
  FaCheckCircle, FaClock, FaExclamationCircle,
} from 'react-icons/fa';

type Message = { id: string; sender: string; senderName: string; body: string; createdAt: string };
type Vehicle = { id: string; vehicleType: string; make?: string; model?: string; year?: number; vin?: string; licensePlate?: string };

type WorkOrder = {
  id: string;
  status: string;
  paymentStatus: string;
  vehicleType: string;
  serviceLocation: string;
  issueDescription: string | Record<string, unknown>;
  bay?: number | null;
  estimatedCost?: number | null;
  dueDate?: string | null;
  createdAt: string;
  repairs?: unknown;
  maintenance?: unknown;
  partsMaterials?: unknown;
  partsUsed?: unknown;
  techLabor?: unknown;
  estimate?: unknown;
  location?: unknown;
  customer?: { id: string; firstName: string; lastName: string; email?: string; phone?: string; company?: string };
  assignedTo?: { id: string; firstName: string; lastName: string };
  vehicle?: Vehicle | null;
  messages?: Message[];
};

const STATUS_STYLES: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
  pending:               { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b',  icon: <FaClock /> },
  assigned:              { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa',  icon: <FaWrench /> },
  'in-progress':         { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa',  icon: <FaWrench /> },
  'waiting-estimate':    { bg: 'rgba(139,92,246,0.15)',  color: '#a78bfa',  icon: <FaClock /> },
  'waiting-for-payment': { bg: 'rgba(239,68,68,0.15)',   color: '#f87171',  icon: <FaDollarSign /> },
  completed:             { bg: 'rgba(34,197,94,0.15)',   color: '#22c55e',  icon: <FaCheckCircle /> },
  cancelled:             { bg: 'rgba(107,114,128,0.15)', color: '#9ca3af',  icon: <FaExclamationCircle /> },
};

function statusStyle(status: string) {
  return STATUS_STYLES[status?.toLowerCase()] ?? STATUS_STYLES['pending'];
}

function parseIssue(raw: unknown): string {
  if (!raw) return 'No description provided.';
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed?.symptoms || parsed?.description || raw;
    } catch { return raw; }
  }
  if (typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    return (r.symptoms as string) || (r.description as string) || JSON.stringify(raw);
  }
  return String(raw);
}

function JsonList({ data, label }: { data: unknown; label: string }) {
  if (!data) return null;
  let items: unknown[] = [];
  if (typeof data === 'string') {
    try { items = JSON.parse(data); } catch { items = [data]; }
  } else if (Array.isArray(data)) {
    items = data;
  } else if (typeof data === 'object') {
    items = [data];
  }
  if (!items.length) return null;

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((item, i) => {
          const t = typeof item === 'string' ? item
            : typeof item === 'object' && item !== null
            ? ((item as Record<string, unknown>).description as string)
              || ((item as Record<string, unknown>).name as string)
              || ((item as Record<string, unknown>).part as string)
              || JSON.stringify(item)
            : String(item);
          return (
            <div key={i} style={{ fontSize: 13, color: '#e5e7eb', padding: '6px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.07)' }}>
              {t}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: '#e5332a', fontSize: 13 }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#e5e7eb', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</span>
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

export default function WorkOrderDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [wo, setWo] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    fetch(`/api/workorders/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => setWo(data?.workOrder ?? data))
      .catch(code => setError(
        code === 404 ? 'Work order not found.' :
        code === 403 ? 'Not authorized.' :
        'Failed to load work order.'
      ))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9aa3b2' }}>
        Loading work order…
      </main>
    );
  }

  if (error || !wo) {
    return (
      <main style={{ minHeight: '100vh', background: '#0a0a0a', padding: '40px 24px' }}>
        <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#9aa3b2', fontSize: 14, cursor: 'pointer', marginBottom: 24 }}>
          <FaArrowLeft /> Back
        </button>
        <div style={{ color: '#f87171', fontSize: 15 }}>{error || 'Work order not found.'}</div>
      </main>
    );
  }

  const ss = statusStyle(wo.status);
  const shortId = wo.id.slice(-8).toUpperCase();
  const customerName = wo.customer ? `${wo.customer.firstName} ${wo.customer.lastName}`.trim() : 'Unknown';
  const techName = wo.assignedTo ? `${wo.assignedTo.firstName} ${wo.assignedTo.lastName}`.trim() : null;
  const issueText = parseIssue(wo.issueDescription);
  const locationLabel = wo.serviceLocation === 'road-call' ? 'Road Call' : wo.serviceLocation === 'in-shop' ? 'In Shop' : wo.serviceLocation;

  // Estimate parsing
  let est: Record<string, unknown> | null = null;
  if (wo.estimate) {
    try { est = typeof wo.estimate === 'string' ? JSON.parse(wo.estimate) : wo.estimate as Record<string, unknown>; } catch { /* ignore */ }
  }
  const estParts = est?.parts as number | undefined;
  const estLabor = est?.labor as number | undefined;
  const estTotal = est?.total as number | undefined;
  const estTax   = est?.tax   as number | undefined;
  const showEstimate = estParts != null || estLabor != null || estTotal != null;

  // Pickup location for road calls
  let pickupAddr: string | null = null;
  if (wo.serviceLocation === 'road-call' && wo.location) {
    try {
      const loc = typeof wo.location === 'string' ? JSON.parse(wo.location) : wo.location as Record<string, unknown>;
      pickupAddr = (loc.address || loc.pickupAddress || loc.location) as string | null;
    } catch { /* ignore */ }
  }

  const hasRepairs = !!(wo.repairs || wo.maintenance || wo.partsMaterials || wo.partsUsed || wo.techLabor);

  return (
    <main style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e7eb' }}>

      {/* Top bar */}
      <div style={{ background: '#111111', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <button
          onClick={() => router.back()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e5e7eb', fontSize: 13, fontWeight: 600, borderRadius: 8, padding: '7px 14px', cursor: 'pointer' }}
        >
          <FaArrowLeft style={{ fontSize: 11 }} /> Back
        </button>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
            WO-{shortId}
          </span>
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
          Created {new Date(wo.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          {' '}{new Date(wo.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 24px 64px' }}>

        {/* Top row: customer / vehicle / WO info */}
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

        {/* Repairs & Parts */}
        {hasRepairs && (
          <div style={{ marginTop: 16 }}>
            <Card title="Repairs & Parts" icon={<FaBox />}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <JsonList data={wo.repairs}        label="Repairs" />
                <JsonList data={wo.maintenance}    label="Maintenance" />
                <JsonList data={wo.partsMaterials} label="Parts / Materials" />
                <JsonList data={wo.partsUsed}      label="Parts Used" />
                <JsonList data={wo.techLabor}      label="Labor" />
              </div>
            </Card>
          </div>
        )}

        {/* Estimate */}
        {showEstimate && (
          <div style={{ marginTop: 16 }}>
            <Card title="Estimate" icon={<FaDollarSign />}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
                {estParts != null && <Field label="Parts" value={`$${Number(estParts).toFixed(2)}`} />}
                {estLabor != null && <Field label="Labor" value={`$${Number(estLabor).toFixed(2)}`} />}
                {estTax   != null && <Field label="Tax"   value={`$${Number(estTax).toFixed(2)}`} />}
                {estTotal != null && (
                  <div>
                    <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Total</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#22c55e' }}>${Number(estTotal).toFixed(2)}</div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Pickup location */}
        {pickupAddr && (
          <div style={{ marginTop: 16 }}>
            <Card title="Pickup Location" icon={<FaMapMarkerAlt />}>
              <p style={{ margin: 0, fontSize: 14, color: '#e5e7eb' }}>{pickupAddr}</p>
            </Card>
          </div>
        )}

        {/* Comments */}
        {!!wo.messages?.length && (
          <div style={{ marginTop: 16 }}>
            <Card title={`Comments (${wo.messages.length})`} icon={<FaComment />}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {wo.messages.map(msg => (
                  <div key={msg.id} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#e5332a' }}>{msg.senderName || msg.sender}</span>
                      <span style={{ fontSize: 11, color: '#6b7280' }}>
                        {new Date(msg.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{' '}
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: '#e5e7eb', lineHeight: 1.5 }}>{msg.body}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

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
