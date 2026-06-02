'use client';
import { useState, useEffect } from 'react';
import useRequireAuth from '@/lib/useRequireAuth';
import { FaCheckCircle, FaHourglassHalf, FaLightbulb, FaLink, FaPencilAlt } from 'react-icons/fa';

interface WorkAuthorization {
  id: string;
  token: string;
  authToken?: string;
  status: string;
  workSummary: string;
  estimateTotal?: number;
  expiresAt?: string;
  signerName?: string;
  signedAt?: string;
  declinedAt?: string;
  createdAt: string;
  workOrderId?: string;
}

interface WorkOrderOption {
  id: string;
  serviceLocation: string;
  status: string;
  summary: string;
  estimateAmount: number | null;
}

interface WorkOrderRow {
  id: string;
  status?: string;
  serviceLocation?: string;
  issueDescription?: string | { symptoms?: string } | null;
  estimate?: unknown;
  estimatedCost?: number | null;
}

const ACTIVE_WORK_ORDER_STATUSES = new Set(['pending', 'assigned', 'in-progress', 'waiting-estimate', 'waiting-for-payment']);
const ALLOWED_SERVICE_LOCATIONS = new Set(['in-shop', 'roadside', 'roadcall']);

const hasQuoteData = (workOrder: { estimate?: unknown; estimatedCost?: number | null }) => {
  if (typeof workOrder.estimatedCost === 'number' && workOrder.estimatedCost > 0) return true;

  if (!workOrder.estimate || typeof workOrder.estimate !== 'object') return false;

  const estimate = workOrder.estimate as Record<string, unknown>;
  const amountCandidates = [estimate.amount, estimate.total, estimate.subtotal, estimate.grandTotal];
  if (amountCandidates.some((value) => Number(value) > 0)) return true;

  if (Array.isArray(estimate.lineItems) && estimate.lineItems.length > 0) return true;
  if (Array.isArray(estimate.items) && estimate.items.length > 0) return true;

  return false;
};

const getEstimateAmount = (workOrder: { estimate?: unknown; estimatedCost?: number | null }) => {
  if (typeof workOrder.estimatedCost === 'number' && workOrder.estimatedCost > 0) return workOrder.estimatedCost;
  if (!workOrder.estimate || typeof workOrder.estimate !== 'object') return null;

  const estimate = workOrder.estimate as Record<string, unknown>;
  const amountCandidates = [estimate.amount, estimate.total, estimate.subtotal, estimate.grandTotal]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  return amountCandidates.length > 0 ? amountCandidates[0] : null;
};

const statusColor: Record<string, { bg: string; color: string; text: string }> = {
  pending:  { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', text: 'Pending' },
  signed:   { bg: 'rgba(34,197,94,0.15)',  color: '#22c55e', text: 'Signed' },
  declined: { bg: 'rgba(229,51,42,0.15)',  color: '#e5332a', text: 'Declined' },
  expired:  { bg: 'rgba(107,114,128,0.15)', color: '#9ca3af', text: 'Expired' },
};

export default function WorkAuthorizationsPage() {
  const { user, isLoading } = useRequireAuth(['shop']);
  const [auths, setAuths] = useState<WorkAuthorization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ workOrderId: '', workSummary: '', estimateTotal: '' });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState('');
  const [formError, setFormError] = useState('');
  const [workOrderOptions, setWorkOrderOptions] = useState<WorkOrderOption[]>([]);
  const [loadingWorkOrders, setLoadingWorkOrders] = useState(false);

  const load = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const r = await fetch('/api/work-authorizations', { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setAuths(await r.json());
    setLoading(false);
  };

  useEffect(() => { if (!user) return; load(); }, [user]);

  const loadEligibleWorkOrders = async () => {
    setLoadingWorkOrders(true);
    setFormError('');
    try {
      const token = localStorage.getItem('token');
      const r = await fetch('/api/workorders?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!r.ok) {
        setWorkOrderOptions([]);
        setFormError('Unable to load work orders.');
        return;
      }

      const data = await r.json();
      const rows: WorkOrderRow[] = Array.isArray(data)
        ? data as WorkOrderRow[]
        : (Array.isArray(data.workOrders) ? data.workOrders as WorkOrderRow[] : []);

      const options: WorkOrderOption[] = rows
        .filter((wo) => {
          const status = String(wo.status || '').toLowerCase();
          const serviceLocation = String(wo.serviceLocation || '').toLowerCase();
          return ACTIVE_WORK_ORDER_STATUSES.has(status)
            && ALLOWED_SERVICE_LOCATIONS.has(serviceLocation)
            && hasQuoteData(wo);
        })
        .map((wo) => {
          const issue = typeof wo.issueDescription === 'string'
            ? wo.issueDescription
            : (wo.issueDescription?.symptoms || 'Quoted work order');
          return {
            id: wo.id,
            serviceLocation: String(wo.serviceLocation || ''),
            status: String(wo.status || ''),
            summary: String(issue || 'Quoted work order'),
            estimateAmount: getEstimateAmount(wo),
          } as WorkOrderOption;
        });

      setWorkOrderOptions(options);

      if (options.length === 0) {
        setForm((prev) => ({ ...prev, workOrderId: '' }));
      } else if (!options.some((opt: WorkOrderOption) => opt.id === form.workOrderId)) {
        const first = options[0];
        setForm({
          workOrderId: first.id,
          workSummary: first.summary,
          estimateTotal: first.estimateAmount ? String(first.estimateAmount) : '',
        });
      }
    } catch {
      setWorkOrderOptions([]);
      setFormError('Unable to load work orders.');
    } finally {
      setLoadingWorkOrders(false);
    }
  };

  useEffect(() => {
    if (!showNew || !user) return;
    loadEligibleWorkOrders();
  }, [showNew, user]);

  const create = async () => {
    if (!form.workOrderId) { setFormError('Select a quoted work order.'); return; }
    if (!form.workSummary.trim()) { setFormError('Work summary is required.'); return; }
    setSaving(true);
    setFormError('');
    const token = localStorage.getItem('token');
    const r = await fetch('/api/work-authorizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...form, estimateTotal: form.estimateTotal ? Number(form.estimateTotal) : null }),
    });
    if (r.ok) {
      setShowNew(false);
      setForm({ workOrderId: '', workSummary: '', estimateTotal: '' });
      load();
    } else {
      const data = await r.json().catch(() => ({}));
      setFormError(data.error || 'Failed to create authorization.');
    }
    setSaving(false);
  };

  const copyLink = (authToken: string) => {
    if (!authToken) return;
    const url = `${window.location.origin}/customer/authorization/${authToken}`;
    navigator.clipboard.writeText(url);
    setCopied(authToken);
    setTimeout(() => setCopied(''), 2000);
  };

  const getStatus = (a: WorkAuthorization) => {
    if (a.status === 'signed') return 'signed';
    if (a.status === 'declined') return 'declined';
    if (a.expiresAt && new Date(a.expiresAt) < new Date()) return 'expired';
    return 'pending';
  };

  if (isLoading) return <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  const signed = auths.filter(a => a.status === 'signed').length;
  const pending = auths.filter(a => a.status === 'pending').length;

  return (
    <div className="centered-app-page" style={{ minHeight: '100vh', background: 'transparent', color: '#e5e7eb', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}><FaPencilAlt style={{marginRight:4}} /> Work Authorizations</h1>
          <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: 14 }}>Digital e-signatures for customer work approvals  -  legally binding with timestamp</p>
        </div>
        <button onClick={() => setShowNew(true)} style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>+ New Authorization</button>
      </div>

      {/* Stats */}
      <div style={{ padding: '24px 32px 0', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {[{ label: 'Total', value: auths.length, icon: '' }, { label: 'Signed', value: signed, icon: '' }, { label: 'Pending', value: pending, icon: <FaHourglassHalf style={{marginRight:4}} /> }].map(s => (
          <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 24px', minWidth: 120 }}>
            <div style={{ fontSize: 24 }}>{s.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 800, margin: '4px 0' }}>{s.value}</div>
            <div style={{ fontSize: 13, color: '#9ca3af' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '24px 32px' }}>
        {loading ? <div style={{ color: '#6b7280' }}>Loading...</div> :
          auths.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 80 }}>
              <div style={{ fontSize: 64 }}><FaPencilAlt style={{marginRight:4}} /></div>
              <div style={{ fontSize: 18, fontWeight: 600, margin: '16px 0 8px' }}>No authorizations yet</div>
              <div style={{ color: '#9ca3af', marginBottom: 24 }}>Create a work authorization from an existing quoted in-shop or roadcall work order</div>
              <button onClick={() => setShowNew(true)} style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 28px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>+ Create First Authorization</button>
            </div>
          ) : (
            <div>
              {auths.map(a => {
                const st = getStatus(a);
                const s = statusColor[st];
                return (
                  <div key={a.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 20px', marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 15 }}>
                          {a.workOrderId ? `Work Order #${a.workOrderId}` : `Auth ${a.id.slice(-6).toUpperCase()}`}
                        </div>
                        <div style={{ color: '#9ca3af', fontSize: 13, marginBottom: 6 }}>
                          {new Date(a.createdAt).toLocaleDateString()}  -  {a.workSummary.slice(0, 80)}{a.workSummary.length > 80 ? '...' : ''}
                        </div>
                        {a.estimateTotal && <div style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b' }}>${Number(a.estimateTotal).toFixed(2)}</div>}
                        {a.signerName && <div style={{ fontSize: 13, color: '#22c55e', marginTop: 4 }}>Signed by {a.signerName} on {a.signedAt ? new Date(a.signedAt).toLocaleDateString() : 'N/A'}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}`, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>{s.text}</span>
                        {st === 'pending' && (
                          <button onClick={() => copyLink(a.authToken || a.token)} style={{ background: 'rgba(229,51,42,0.15)', color: '#ff6b64', border: '1px solid #e5332a', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                            {copied === (a.authToken || a.token) ? <><FaCheckCircle style={{marginRight:4}} /> Copied!</> : <><FaLink style={{marginRight:4}} /> Copy Link</>}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </div>

      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 28, width: 480, maxWidth: '93%' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18 }}>Create Work Authorization</h3>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Quoted Work Order *</label>
              <select
                value={form.workOrderId}
                onChange={e => {
                  const selected = workOrderOptions.find((wo) => wo.id === e.target.value);
                  setForm((prev) => ({
                    ...prev,
                    workOrderId: e.target.value,
                    workSummary: selected ? selected.summary : prev.workSummary,
                    estimateTotal: selected?.estimateAmount ? String(selected.estimateAmount) : prev.estimateTotal,
                  }));
                }}
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box' }}
                disabled={loadingWorkOrders || workOrderOptions.length === 0}
              >
                {loadingWorkOrders && <option value="">Loading quoted work orders...</option>}
                {!loadingWorkOrders && workOrderOptions.length === 0 && <option value="">No eligible quoted work orders found</option>}
                {!loadingWorkOrders && workOrderOptions.map((wo) => (
                  <option key={wo.id} value={wo.id}>
                    {wo.id.slice(0, 8)} | {wo.serviceLocation} | {wo.status}
                  </option>
                ))}
              </select>
              {!loadingWorkOrders && workOrderOptions.length === 0 && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#fca5a5' }}>
                  Create a quote on an active in-shop or roadcall work order first.
                </div>
              )}
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Work Summary * <span style={{ color: '#6b7280' }}>(visible to customer)</span></label>
              <textarea value={form.workSummary} onChange={e => setForm(p => ({ ...p, workSummary: e.target.value }))} rows={4}
                placeholder="Describe the work to be performed, parts to be replaced, and any relevant details..."
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Estimated Total ($)</label>
              <input value={form.estimateTotal} onChange={e => setForm(p => ({ ...p, estimateTotal: e.target.value }))} type="number" placeholder="450.00"
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
            </div>

            <div style={{ background: 'rgba(229,51,42,0.1)', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#ffb4ad' }}>
              <FaLightbulb style={{marginRight:4}} /> Authorizations can only be created from quoted active in-shop or roadcall work orders. After creating, copy the link and send it to the customer. The link expires in 7 days.
            </div>

            {formError && (
              <div style={{ marginBottom: 12, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '8px 14px', color: '#fca5a5', fontSize: 13, fontWeight: 600 }}>{formError}</div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={create} disabled={saving || loadingWorkOrders || workOrderOptions.length === 0} style={{ flex: 1, background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: (saving || loadingWorkOrders || workOrderOptions.length === 0) ? 'not-allowed' : 'pointer', opacity: (saving || loadingWorkOrders || workOrderOptions.length === 0) ? 0.6 : 1 }}>{saving ? 'Creating...' : 'Create & Get Link'}</button>
              <button onClick={() => setShowNew(false)} style={{ flex: 1, background: 'transparent', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '11px 0', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

