'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import useRequireAuth from '@/lib/useRequireAuth';
import { FaArrowLeft, FaClipboardList, FaExclamationTriangle, FaIndustry, FaShoppingCart, FaTimes } from 'react-icons/fa';

interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendor: string;
  status: 'pending' | 'ordered' | 'received' | 'cancelled';
  createdAt: string;
  expectedDate?: string;
  total: number;
  items: POItem[];
  notes?: string;
}

interface POItem {
  id: string;
  partNumber: string;
  description: string;
  qty: number;
  unitCost: number;
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b',  label: 'Pending' },
  ordered:   { bg: 'rgba(229,51,42,0.15)',  color: '#e5332a',  label: 'Ordered' },
  received:  { bg: 'rgba(34,197,94,0.15)',   color: '#22c55e',  label: 'Received' },
  cancelled: { bg: 'rgba(229,51,42,0.15)',   color: '#e5332a',  label: 'Cancelled' },
};

const EMPTY_ITEM: Omit<POItem, 'id'> = { partNumber: '', description: '', qty: 1, unitCost: 0 };

const toUiOrder = (order: any): PurchaseOrder => ({
  id: order.id,
  poNumber: `PO-${String(order.id).slice(-8).toUpperCase()}`,
  vendor: order.vendor || 'Vendor',
  status: order.status || 'pending',
  createdAt: order.createdAt,
  expectedDate: order.expectedDate,
  total: Number(order.totalCost || 0),
  notes: order.notes || '',
  items: Array.isArray(order.items)
    ? order.items.map((item: any) => ({
        id: item.id,
        partNumber: item.sku || '',
        description: item.itemName || '',
        qty: Number(item.quantity || 0),
        unitCost: Number(item.unitCost || 0),
      }))
    : [],
});

const openPurchaseOrderPdf = (order: PurchaseOrder) => {
  const rows = order.items
    .map(
      (item, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${item.description || '-'}</td>
          <td>${item.partNumber || '-'}</td>
          <td>${item.qty}</td>
          <td>$${item.unitCost.toFixed(2)}</td>
          <td>$${(item.qty * item.unitCost).toFixed(2)}</td>
        </tr>
      `
    )
    .join('');

  const html = `
    <!doctype html>
    <html>
      <head>
        <title>${order.poNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 32px; color: #000000; }
          .header { display:flex; justify-content:space-between; margin-bottom:24px; }
          .brand { font-size: 26px; font-weight: 800; color: #e5332a; }
          .meta { text-align:right; font-size:12px; color:#4b5563; }
          h1 { margin: 0 0 8px 0; font-size: 22px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 12px; }
          th { background: #f3f4f6; text-align: left; }
          .total { margin-top: 16px; text-align: right; font-size: 18px; font-weight: 700; }
          .note { margin-top: 20px; font-size: 12px; color: #374151; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand">FixTray</div>
            <h1>Purchase Order</h1>
          </div>
          <div class="meta">
            <div><strong>PO #:</strong> ${order.poNumber}</div>
            <div><strong>Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</div>
            <div><strong>Status:</strong> ${order.status}</div>
          </div>
        </div>

        <div><strong>Vendor:</strong> ${order.vendor}</div>
        <div><strong>Expected Date:</strong> ${order.expectedDate ? new Date(order.expectedDate).toLocaleDateString() : 'N/A'}</div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th>Part #</th>
              <th>Qty</th>
              <th>Unit Cost</th>
              <th>Line Total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="total">Total: $${order.total.toFixed(2)}</div>
        <div class="note"><strong>Notes:</strong> ${order.notes || 'None'}</div>
        <script>window.onload = function(){ window.print(); };</script>
      </body>
    </html>
  `;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
};

export default function PurchaseOrdersPage() {
  const { user, isLoading } = useRequireAuth(['shop']);
  const router = useRouter();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [form, setForm] = useState({ vendor: '', expectedDate: '', notes: '', items: [{ ...EMPTY_ITEM }] });

  const shopId = user?.shopId || user?.id || '';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const r = await fetch(`/api/purchase-orders?shopId=${encodeURIComponent(shopId)}`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const data = await r.json();
        const apiOrders = Array.isArray(data?.orders) ? data.orders : [];
        setOrders(apiOrders.map(toUiOrder));
      } else if (r.status === 404) {
        setOrders([]); // API not yet implemented  -  show empty state gracefully
      } else {
        setError('Failed to load purchase orders. Please try again.');
      }
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => { if (!user) return; load(); }, [user, load]);

  const createPO = async () => {
    if (!form.vendor.trim()) return;
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        shopId,
        vendor: form.vendor,
        expectedDate: form.expectedDate || undefined,
        notes: form.notes,
        items: form.items.map((item) => ({
          itemName: item.description,
          sku: item.partNumber,
          quantity: item.qty,
          unitCost: item.unitCost,
        })),
      };
      const r = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (r.ok) {
        const data = await r.json();
        if (data?.order) {
          const newOrder = toUiOrder(data.order);
          openPurchaseOrderPdf(newOrder);
        }
        setShowNew(false);
        setForm({ vendor: '', expectedDate: '', notes: '', items: [{ ...EMPTY_ITEM }] });
        load();
      } else {
        setError('Failed to create purchase order. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const token = localStorage.getItem('token');
      const r = await fetch(`/api/purchase-orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      if (r.ok) {
        const data = await r.json();
        const updated = data?.order ? toUiOrder(data.order) : null;
        if (updated) {
          setOrders(prev => prev.map(o => o.id === id ? updated : o));
          if (selected?.id === id) setSelected(updated);
        }
      }
    } catch { /* ignore */ }
  };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] }));
  const removeItem = (i: number) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i: number, k: string, v: string | number) =>
    setForm(f => ({ ...f, items: f.items.map((it, idx) => idx === i ? { ...it, [k]: v } : it) }));

  const total = (items: typeof form.items) => items.reduce((s, i) => s + i.qty * i.unitCost, 0);

  const filtered = statusFilter === 'all' ? orders : orders.filter(o => o.status === statusFilter);

  if (isLoading) return <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  return (
    <div className="centered-app-page" style={{ minHeight: '100vh', background: 'transparent', color: '#e5e7eb', fontFamily: 'system-ui,sans-serif' }}>
      {/* Header */}
      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 13, marginBottom: 6, padding: 0 }}><FaArrowLeft style={{marginRight:4}} /> Back</button>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}><FaShoppingCart style={{marginRight:4}} /> Purchase Orders</h1>
          <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: 14 }}>Manage vendor purchase orders and parts procurement</p>
        </div>
        <button onClick={() => setShowNew(true)} style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          + New Purchase Order
        </button>
      </div>

      <div style={{ padding: 32 }}>
        {/* Status filter tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {['all', 'pending', 'ordered', 'received', 'cancelled'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: '7px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: statusFilter === s ? '#e5332a' : 'rgba(255,255,255,0.08)',
              color: statusFilter === s ? '#fff' : '#9ca3af',
            }}>
              {s === 'all' ? `All (${orders.length})` : `${STATUS_STYLES[s]?.label} (${orders.filter(o => o.status === s).length})`}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(229,51,42,0.1)', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 10, padding: '14px 20px', marginBottom: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
            <span><FaExclamationTriangle style={{marginRight:4}} /></span>
            <span style={{ color: '#fca5a5', fontSize: 14 }}>{error}</span>
            <button onClick={load} style={{ marginLeft: 'auto', background: '#e5332a', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}>Retry</button>
          </div>
        )}

        {/* Loading */}
        {loading && <div style={{ textAlign: 'center', padding: 60, color: '#6b7280' }}>Loading purchase orders...</div>}

        {/* Empty state */}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px dashed rgba(255,255,255,0.12)' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}><FaShoppingCart style={{marginRight:4}} /></div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#e5e7eb', marginBottom: 8 }}>
              {statusFilter === 'all' ? 'No purchase orders yet' : `No ${statusFilter} orders`}
            </div>
            <div style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>
              {statusFilter === 'all' ? 'Create your first purchase order to start tracking parts procurement.' : 'Try a different status filter.'}
            </div>
            {statusFilter === 'all' && (
              <button onClick={() => setShowNew(true)} style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                + Create Purchase Order
              </button>
            )}
          </div>
        )}

        {/* Order list */}
        {!loading && filtered.length > 0 && (
          <div style={{ display: 'grid', gap: 12 }}>
            {filtered.map(order => {
              const s = STATUS_STYLES[order.status];
              return (
                <div key={order.id} onClick={() => setSelected(order)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 12, padding: '18px 24px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{order.poNumber}</div>
                    <div style={{ color: '#9ca3af', fontSize: 13, marginTop: 2 }}><FaIndustry style={{marginRight:4}} /> {order.vendor}</div>
                  </div>
                  <div style={{ color: '#6b7280', fontSize: 13 }}>
                    {order.items?.length ?? 0} item{(order.items?.length ?? 0) !== 1 ? 's' : ''}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#22c55e' }}>${(order.total ?? 0).toFixed(2)}</div>
                  <div style={{ padding: '4px 10px', borderRadius: 16, background: s?.bg, color: s?.color, fontSize: 12, fontWeight: 700 }}>{s?.label}</div>
                  <div style={{ color: '#6b7280', fontSize: 12 }}>{new Date(order.createdAt).toLocaleDateString()}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
          <div style={{ background: '#1a1d27', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: 32, width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{selected.poNumber}</h2>
                <div style={{ color: '#9ca3af', fontSize: 13, marginTop: 4 }}><FaIndustry style={{marginRight:4}} /> {selected.vendor}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 22 }}></button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 8 }}>Update Status</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(['pending', 'ordered', 'received', 'cancelled'] as const).map(s => (
                  <button key={s} onClick={() => updateStatus(selected.id, s)} style={{
                    padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    background: selected.status === s ? STATUS_STYLES[s].bg : 'rgba(255,255,255,0.06)',
                    color: selected.status === s ? STATUS_STYLES[s].color : '#9ca3af',
                    outline: selected.status === s ? `1px solid ${STATUS_STYLES[s].color}` : 'none',
                  }}>
                    {STATUS_STYLES[s].label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 12, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>
                <span>Description</span><span>Part #</span><span>Qty</span><span style={{ textAlign: 'right' }}>Cost</span>
              </div>
              {selected.items?.map((item, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 14 }}>
                  <span>{item.description}</span>
                  <span style={{ color: '#9ca3af' }}>{item.partNumber}</span>
                  <span>{item.qty}</span>
                  <span style={{ textAlign: 'right' }}>${(item.qty * item.unitCost).toFixed(2)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px', fontWeight: 700, fontSize: 16, color: '#22c55e' }}>
                Total: ${(selected.total ?? 0).toFixed(2)}
              </div>
            </div>
            {selected.notes && <div style={{ color: '#9ca3af', fontSize: 13 }}><FaClipboardList style={{marginRight:4}} /> {selected.notes}</div>}
          </div>
        </div>
      )}

      {/* New PO modal */}
      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setShowNew(false); }}>
          <div style={{ background: '#1a1d27', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: 32, width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>New Purchase Order</h2>
              <button onClick={() => setShowNew(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 22 }}></button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Vendor *</label>
              <input value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))}
                placeholder="Vendor name" style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Expected Delivery Date</label>
              <input type="date" value={form.expectedDate} onChange={e => setForm(f => ({ ...f, expectedDate: e.target.value }))}
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
            </div>

            {/* Line items */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <label style={{ fontSize: 13, color: '#9ca3af', fontWeight: 700 }}>Line Items</label>
                <button onClick={addItem} style={{ background: 'rgba(229,51,42,0.2)', color: '#e5332a', border: 'none', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 13 }}>+ Add Item</button>
              </div>
              {form.items.map((item, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 0.7fr 0.9fr auto', gap: 8, marginBottom: 8 }}>
                  <input value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} placeholder="Description"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '8px 12px', color: '#e5e7eb', fontSize: 13 }} />
                  <input value={item.partNumber} onChange={e => updateItem(i, 'partNumber', e.target.value)} placeholder="Part #"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '8px 12px', color: '#e5e7eb', fontSize: 13 }} />
                  <input type="number" value={item.qty} min={1} onChange={e => updateItem(i, 'qty', Number(e.target.value))} placeholder="Qty"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '8px 12px', color: '#e5e7eb', fontSize: 13 }} />
                  <input type="number" value={item.unitCost} min={0} step={0.01} onChange={e => updateItem(i, 'unitCost', Number(e.target.value))} placeholder="Unit $"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '8px 12px', color: '#e5e7eb', fontSize: 13 }} />
                  <button onClick={() => removeItem(i)} disabled={form.items.length === 1}
                    style={{ background: 'rgba(229,51,42,0.15)', color: '#e5332a', border: 'none', borderRadius: 6, padding: '8px 10px', cursor: 'pointer', fontSize: 14 }}><FaTimes style={{marginRight:4}} /></button>
                </div>
              ))}
              <div style={{ textAlign: 'right', fontSize: 15, fontWeight: 700, color: '#22c55e', marginTop: 8 }}>Total: ${total(form.items).toFixed(2)}</div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                placeholder="Optional notes or instructions..."
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }} />
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNew(false)} style={{ background: 'rgba(255,255,255,0.08)', color: '#9ca3af', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
              <button onClick={createPO} disabled={saving || !form.vendor.trim()} style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: !form.vendor.trim() ? 0.5 : 1 }}>
                {saving ? 'Creating...' : 'Create Purchase Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


