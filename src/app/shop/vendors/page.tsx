'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaBookmark, FaBox, FaClipboardList, FaCreditCard, FaEnvelope, FaIndustry, FaPhone, FaRegStar, FaStar, FaTimes, FaTrash, FaUser } from 'react-icons/fa';

type TabId = 'vendors' | 'orders';

interface Vendor {
  id: string; name: string; contactName: string; phone: string; email: string;
  website: string; category: string; accountNumber: string; paymentTerms: string;
  rating: number; notes: string; isActive: boolean; createdAt: string;
}
interface OrderItem { itemName: string; sku: string; quantity: string; unitCost: string; }
interface PurchaseOrder {
  id: string; vendor: string; status: string; totalCost: number | null;
  expectedDate: string | null; notes: string | null; createdAt: string;
  items: { id: string; itemName: string; sku: string | null; quantity: number; unitCost: number; status: string }[];
}

const CATEGORIES = ['parts', 'fluids', 'tires', 'tools', 'equipment', 'other'];
const TERMS = ['Net 30', 'Net 15', 'Net 60', 'COD', 'Prepaid', 'Credit Card'];
const BLANK_V = { name: '', contactName: '', phone: '', email: '', website: '', category: 'parts', accountNumber: '', paymentTerms: 'Net 30', rating: '5', notes: '', isActive: true };
const BLANK_ITEM: OrderItem = { itemName: '', sku: '', quantity: '1', unitCost: '' };

const ratingStars = (r: number) => [...Array.from({length: Math.round(r)}, (_, i) => <FaStar key={i} />), ...Array.from({length: 5 - Math.round(r)}, (_, i) => <FaRegStar key={i} />)];
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  ordered:   { bg: 'rgba(229,51,42,0.2)',  text: '#ff6b64' },
  shipped:   { bg: 'rgba(245,158,11,0.2)',  text: '#fbbf24' },
  received:  { bg: 'rgba(34,197,94,0.2)',   text: '#4ade80' },
  cancelled: { bg: 'rgba(239,68,68,0.2)',   text: '#f87171' },
};
const bg = 'transparent';
const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#f1f5f9', fontSize: 14, boxSizing: 'border-box' };

export default function VendorManagementPage() {
  const { user, isLoading } = useRequireAuth(['shop']);
  const [activeTab, setActiveTab] = useState<TabId>('vendors');

  // -- Vendors state --
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorsLoading, setVendorsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof BLANK_V>({ ...BLANK_V });
  const [saving, setSaving] = useState(false);
  const [vendorError, setVendorError] = useState<string | null>(null);
  const [vendorSuccess, setVendorSuccess] = useState<string | null>(null);
  const [deleteVendorConfirm, setDeleteVendorConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deleteOrderConfirmId, setDeleteOrderConfirmId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState('all');

  // -- Orders state --
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderVendor, setOrderVendor] = useState('');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([{ ...BLANK_ITEM }]);
  const [orderDate, setOrderDate] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [orderSuccess, setOrderSuccess] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const loadVendors = async () => {
    try {
      const res = await fetch('/api/shop/vendors', { headers });
      const data = await res.json();
      setVendors(data.vendors ?? []);
    } catch { setVendorError('Failed to load vendors'); }
    finally { setVendorsLoading(false); }
  };

  const loadOrders = async () => {
    try {
      const res = await fetch('/api/shop/purchase-orders', { headers });
      const data = await res.json();
      setOrders(data.orders ?? []);
    } catch { /* silent */ }
    finally { setOrdersLoading(false); }
  };

  useEffect(() => { if (user) { loadVendors(); loadOrders(); } }, [user]);

  // -- Vendor handlers --
  const openCreate = () => { setEditId(null); setForm({ ...BLANK_V }); setShowForm(true); setVendorError(null); };
  const openEdit = (v: Vendor) => {
    setEditId(v.id);
    setForm({ name: v.name, contactName: v.contactName, phone: v.phone, email: v.email, website: v.website, category: v.category, accountNumber: v.accountNumber, paymentTerms: v.paymentTerms, rating: String(v.rating), notes: v.notes, isActive: v.isActive });
    setShowForm(true); setVendorError(null);
  };
  const handleSave = async () => {
    if (!form.name) { setVendorError('Vendor name is required'); return; }
    setSaving(true); setVendorError(null);
    try {
      const body = { ...form, rating: parseFloat(form.rating) || 5 };
      const url = editId ? `/api/shop/vendors/${editId}` : '/api/shop/vendors';
      const res = await fetch(url, { method: editId ? 'PUT' : 'POST', headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setVendorSuccess(editId ? 'Vendor updated!' : 'Vendor added!');
      setShowForm(false); loadVendors();
    } catch (e: any) { setVendorError(e.message); }
    finally { setSaving(false); }
  };
  const handleDeleteVendor = async (id: string, _name: string) => {
    try {
      await fetch(`/api/shop/vendors/${id}`, { method: 'DELETE', headers });
      setVendorSuccess('Vendor removed'); setDeleteVendorConfirm(null); loadVendors();
    } catch { setVendorError('Delete failed'); setDeleteVendorConfirm(null); }
  };

  // -- Order handlers --
  const addItem = () => setOrderItems(prev => [...prev, { ...BLANK_ITEM }]);
  const removeItem = (i: number) => setOrderItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof OrderItem, val: string) =>
    setOrderItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

  const orderTotal = orderItems.reduce((s, it) => s + (parseFloat(it.unitCost) || 0) * (parseInt(it.quantity) || 0), 0);

  const handleCreateOrder = async () => {
    if (!orderVendor) { setOrderError('Please select a vendor'); return; }
    if (!orderItems[0].itemName) { setOrderError('At least one item is required'); return; }
    setSavingOrder(true); setOrderError('');
    try {
      const res = await fetch('/api/shop/purchase-orders', {
        method: 'POST', headers,
        body: JSON.stringify({ vendor: orderVendor, items: orderItems, expectedDate: orderDate || null, notes: orderNotes || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create order');
      setOrderSuccess('Order created!');
      setShowOrderForm(false);
      setOrderVendor(''); setOrderItems([{ ...BLANK_ITEM }]); setOrderDate(''); setOrderNotes('');
      loadOrders();
      setTimeout(() => setOrderSuccess(''), 4000);
    } catch (e: any) { setOrderError(e.message); }
    finally { setSavingOrder(false); }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/shop/purchase-orders/${id}`, { method: 'PUT', headers, body: JSON.stringify({ status }) });
    if (res.ok) { setOrderSuccess(`Order marked ${status}`); loadOrders(); setTimeout(() => setOrderSuccess(''), 3000); }
  };

  const handleDeleteOrder = async (id: string) => {
    await fetch(`/api/shop/purchase-orders/${id}`, { method: 'DELETE', headers });
    setDeleteOrderConfirmId(null);
    loadOrders();
  };

  const displayed = filterCategory === 'all' ? vendors : vendors.filter(v => v.category === filterCategory);
  const displayedOrders = filterStatus === 'all' ? orders : orders.filter(o => o.status === filterStatus);

  if (isLoading || vendorsLoading) return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>
  );
  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: bg, padding: '24px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <Link href="/shop/admin" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 13 }}><FaArrowLeft style={{marginRight:4}} /> Admin</Link>
          <h1 style={{ color: '#f1f5f9', fontSize: 26, fontWeight: 700, margin: '4px 0 2px' }}><FaIndustry style={{marginRight:4}} /> Vendors & Parts Orders</h1>
          <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Manage suppliers and track parts orders</p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 28, background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
          {([
            { id: 'vendors' as TabId, label: `<FaIndustry style={{marginRight:4}} /> Vendors (${vendors.length})` },
            { id: 'orders' as TabId,  label: ` Parts Orders (${orders.filter(o => o.status !== 'cancelled').length})` },
          ]).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ padding: '9px 20px', borderRadius: 7, border: 'none', background: activeTab === tab.id ? '#e5332a' : 'transparent', color: activeTab === tab.id ? '#fff' : '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* -- VENDORS TAB -- */}
        {activeTab === 'vendors' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['all', ...CATEGORIES].map(cat => (
                  <button key={cat} onClick={() => setFilterCategory(cat)}
                    style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.15)', background: filterCategory === cat ? '#e5332a' : 'transparent', color: filterCategory === cat ? 'white' : '#94a3b8', cursor: 'pointer', fontSize: 13, textTransform: 'capitalize' }}>
                    {cat}
                  </button>
                ))}
              </div>
              <button onClick={openCreate} style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: '#e5332a', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>+ Add Vendor</button>
            </div>

            {vendorSuccess && <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#86efac', fontSize: 14 }}>{vendorSuccess}</div>}
            {vendorError && !showForm && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#fca5a5', fontSize: 14 }}>{vendorError}</div>}

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Total Vendors', value: vendors.length, color: '#ff6b64' },
                { label: 'Active', value: vendors.filter(v => v.isActive).length, color: '#34d399' },
                { label: 'Categories', value: new Set(vendors.map(v => v.category)).size, color: '#a78bfa' },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '14px 16px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ color: s.color, fontSize: 24, fontWeight: 700 }}>{s.value}</div>
                  <div style={{ color: '#64748b', fontSize: 12 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {displayed.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#475569' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}><FaIndustry style={{marginRight:4}} /></div>
                <p style={{ fontSize: 16 }}>{vendors.length === 0 ? 'No vendors yet  -  add your first parts supplier' : 'No vendors in this category'}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {displayed.map(v => (
                  <div key={v.id} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 20, border: `1px solid ${v.isActive ? 'rgba(255,255,255,0.08)' : 'rgba(239,68,68,0.2)'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <h3 style={{ color: '#f1f5f9', fontWeight: 600, margin: '0 0 4px', fontSize: 16 }}>{v.name}</h3>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, background: 'rgba(139,92,246,0.2)', color: '#c4b5fd', padding: '2px 8px', borderRadius: 12, textTransform: 'capitalize' }}>{v.category}</span>
                          {!v.isActive && <span style={{ fontSize: 11, background: 'rgba(239,68,68,0.2)', color: '#fca5a5', padding: '2px 8px', borderRadius: 12 }}>Inactive</span>}
                        </div>
                      </div>
                      <span style={{ color: '#fbbf24', fontSize: 14 }}>{ratingStars(v.rating)}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7 }}>
                      {v.contactName && <div><FaUser style={{marginRight:4}} /> {v.contactName}</div>}
                      {v.phone      && <div><FaPhone style={{marginRight:4}} /> {v.phone}</div>}
                      {v.email      && <div><FaEnvelope style={{marginRight:4}} /> {v.email}</div>}
                      {v.accountNumber && <div><FaBookmark style={{marginRight:4}} /> Acct: {v.accountNumber}</div>}
                      {v.paymentTerms  && <div><FaCreditCard style={{marginRight:4}} /> {v.paymentTerms}</div>}
                    </div>
                    {v.notes && <p style={{ color: '#64748b', fontSize: 12, marginTop: 10, fontStyle: 'italic' }}>{v.notes}</p>}
                    <div style={{ display: 'flex', gap: 8, marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
                      <button onClick={() => openEdit(v)} style={{ flex: 1, padding: '7px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}>Edit</button>
                      <button onClick={() => { setOrderVendor(v.name); setActiveTab('orders'); setShowOrderForm(true); }}
                        style={{ flex: 1, padding: '7px', borderRadius: 7, border: '1px solid rgba(229,51,42,0.4)', background: 'rgba(229,51,42,0.1)', color: '#ff6b64', cursor: 'pointer', fontSize: 13 }}>
                        <FaBox style={{marginRight:4}} /> Order Parts
                      </button>
                      <button onClick={() => setDeleteVendorConfirm({ id: v.id, name: v.name })} style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: '#fca5a5', cursor: 'pointer', fontSize: 13 }}><FaTimes style={{marginRight:4}} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* -- PARTS ORDERS TAB -- */}
        {activeTab === 'orders' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['all', 'ordered', 'shipped', 'received', 'cancelled'].map(s => {
                  const col = STATUS_COLORS[s] || { bg: 'transparent', text: '#94a3b8' };
                  const active = filterStatus === s;
                  const count = s === 'all' ? orders.length : orders.filter(o => o.status === s).length;
                  return (
                    <button key={s} onClick={() => setFilterStatus(s)}
                      style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${active ? col.bg : 'rgba(255,255,255,0.12)'}`, background: active ? col.bg : 'transparent', color: active ? col.text : '#64748b', cursor: 'pointer', fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>
                      {s === 'all' ? `All (${count})` : `${s} (${count})`}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => { setShowOrderForm(true); setOrderError(''); }}
                style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: '#e5332a', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                + New Order
              </button>
            </div>

            {orderSuccess && <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#86efac', fontSize: 14 }}>{orderSuccess}</div>}

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Open Orders', value: orders.filter(o => o.status === 'ordered').length, color: '#ff6b64' },
                { label: 'In Transit', value: orders.filter(o => o.status === 'shipped').length, color: '#fbbf24' },
                { label: 'Received', value: orders.filter(o => o.status === 'received').length, color: '#4ade80' },
                { label: 'Total Spent', value: `$${orders.filter(o => o.status === 'received').reduce((s, o) => s + (o.totalCost || 0), 0).toFixed(0)}`, color: '#a78bfa' },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '14px 16px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ color: s.color, fontSize: 22, fontWeight: 700 }}>{s.value}</div>
                  <div style={{ color: '#64748b', fontSize: 12 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {ordersLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#475569' }}>Loading orders...</div>
            ) : displayedOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#475569' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}><FaBox style={{marginRight:4}} /></div>
                <p style={{ fontSize: 16 }}>{orders.length === 0 ? 'No parts orders yet' : 'No orders with this status'}</p>
                <button onClick={() => setShowOrderForm(true)} style={{ marginTop: 12, padding: '10px 20px', borderRadius: 8, border: 'none', background: '#e5332a', color: 'white', fontWeight: 600, cursor: 'pointer' }}>+ New Order</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {displayedOrders.map(order => {
                  const sc = STATUS_COLORS[order.status] || STATUS_COLORS.ordered;
                  const expanded = expandedOrder === order.id;
                  return (
                    <div key={order.id} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
                      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 160 }}>
                          <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 15 }}>{order.vendor}</div>
                          <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
                            {new Date(order.createdAt).toLocaleDateString()}  {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                            {order.expectedDate && `  Expected ${new Date(order.expectedDate).toLocaleDateString()}`}
                          </div>
                        </div>
                        <span style={{ background: sc.bg, color: sc.text, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, textTransform: 'capitalize' }}>{order.status}</span>
                        {order.totalCost != null && (
                          <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 16 }}>${order.totalCost.toFixed(2)}</span>
                        )}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button onClick={() => setExpandedOrder(expanded ? null : order.id)}
                            style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}>
                            {expanded ? 'Hide' : 'Items'}
                          </button>
                          {order.status === 'ordered' && (
                            <button onClick={() => handleUpdateStatus(order.id, 'shipped')}
                              style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.1)', color: '#fbbf24', cursor: 'pointer', fontSize: 12 }}>
                              Mark Shipped
                            </button>
                          )}
                          {order.status === 'shipped' && (
                            <button onClick={() => handleUpdateStatus(order.id, 'received')}
                              style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(34,197,94,0.4)', background: 'rgba(34,197,94,0.1)', color: '#4ade80', cursor: 'pointer', fontSize: 12 }}>
                              Mark Received
                            </button>
                          )}
                          {(order.status === 'ordered' || order.status === 'shipped') && (
                            <button onClick={() => handleUpdateStatus(order.id, 'cancelled')}
                              style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: '#f87171', cursor: 'pointer', fontSize: 12 }}>
                              Cancel
                            </button>
                          )}
                          <button onClick={() => setDeleteOrderConfirmId(order.id)}
                            style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: 'transparent', color: '#475569', cursor: 'pointer', fontSize: 12 }}>
                            <FaTimes style={{marginRight:4}} />
                          </button>
                        </div>
                      </div>
                      {expanded && (
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '12px 20px', background: 'rgba(0,0,0,0.15)' }}>
                          {order.notes && <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 10px', fontStyle: 'italic' }}><FaClipboardList style={{marginRight:4}} /> {order.notes}</p>}
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                              <tr style={{ color: '#475569' }}>
                                <th style={{ textAlign: 'left', padding: '4px 8px' }}>Item</th>
                                <th style={{ textAlign: 'left', padding: '4px 8px' }}>SKU</th>
                                <th style={{ textAlign: 'right', padding: '4px 8px' }}>Qty</th>
                                <th style={{ textAlign: 'right', padding: '4px 8px' }}>Unit Cost</th>
                                <th style={{ textAlign: 'right', padding: '4px 8px' }}>Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {order.items.map(item => (
                                <tr key={item.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', color: '#e2e8f0' }}>
                                  <td style={{ padding: '6px 8px' }}>{item.itemName}</td>
                                  <td style={{ padding: '6px 8px', color: '#64748b' }}>{item.sku || ' - '}</td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{item.quantity}</td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>${item.unitCost.toFixed(2)}</td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>${(item.unitCost * item.quantity).toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* -- VENDOR FORM MODAL -- */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
          onClick={() => { setShowForm(false); setVendorError(null); }}>
          <div style={{ background: '#1e293b', borderRadius: 16, padding: 28, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={e => e.stopPropagation()}>
            <h2 style={{ color: '#f1f5f9', fontSize: 20, fontWeight: 700, marginBottom: 20 }}>{editId ? 'Edit Vendor' : 'Add New Vendor'}</h2>
            {[
              { label: 'Vendor Name *', key: 'name', type: 'text', placeholder: 'e.g. NAPA Auto Parts' },
              { label: 'Contact Name', key: 'contactName', type: 'text', placeholder: 'Account rep name' },
              { label: 'Phone', key: 'phone', type: 'tel', placeholder: '(555) 000-0000' },
              { label: 'Email', key: 'email', type: 'email', placeholder: 'contact@vendor.com' },
              { label: 'Website', key: 'website', type: 'url', placeholder: 'https://vendor.com' },
              { label: 'Account Number', key: 'accountNumber', type: 'text', placeholder: 'Your account #' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <label style={{ color: '#94a3b8', fontSize: 13, display: 'block', marginBottom: 4 }}>{label}</label>
                <input type={type} value={(form as any)[key]} placeholder={placeholder}
                  onChange={e => setForm({ ...form, [key]: e.target.value })} style={inp} />
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: 13, display: 'block', marginBottom: 4 }}>Category</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  style={{ ...inp, background: '#1e293b' }}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: 13, display: 'block', marginBottom: 4 }}>Payment Terms</label>
                <select value={form.paymentTerms} onChange={e => setForm({ ...form, paymentTerms: e.target.value })}
                  style={{ ...inp, background: '#1e293b' }}>
                  {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ color: '#94a3b8', fontSize: 13, display: 'block', marginBottom: 4 }}>Rating (1-5)</label>
              <input type="number" min="1" max="5" value={form.rating} onChange={e => setForm({ ...form, rating: e.target.value })} style={inp} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ color: '#94a3b8', fontSize: 13, display: 'block', marginBottom: 4 }}>Notes</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3}
                style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
              <label htmlFor="isActive" style={{ color: '#94a3b8', fontSize: 14 }}>Active vendor</label>
            </div>
            {vendorError && <p style={{ color: '#fca5a5', fontSize: 13, marginBottom: 12 }}>{vendorError}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleSave} disabled={saving}
                style={{ flex: 1, padding: '11px', borderRadius: 8, border: 'none', background: '#e5332a', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
                {saving ? 'Saving...' : editId ? 'Update Vendor' : 'Add Vendor'}
              </button>
              <button onClick={() => { setShowForm(false); setVendorError(null); }}
                style={{ padding: '11px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -- ORDER FORM MODAL -- */}
      {showOrderForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
          onClick={() => setShowOrderForm(false)}>
          <div style={{ background: '#000000', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 640, maxHeight: '92vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <h2 style={{ color: '#f1f5f9', fontSize: 20, fontWeight: 700, margin: '0 0 20px' }}><FaBox style={{marginRight:4}} /> New Parts Order</h2>

            <div style={{ marginBottom: 16 }}>
              <label style={{ color: '#94a3b8', fontSize: 13, display: 'block', marginBottom: 4 }}>Vendor *</label>
              {vendors.length > 0 ? (
                <select value={orderVendor} onChange={e => setOrderVendor(e.target.value)} style={{ ...inp, background: '#1e293b' }}>
                  <option value=""> -  Select vendor  - </option>
                  {vendors.filter(v => v.isActive).map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                  <option value="__custom__">Other (type below)</option>
                </select>
              ) : (
                <input value={orderVendor} onChange={e => setOrderVendor(e.target.value)} placeholder="Vendor name" style={inp} />
              )}
              {orderVendor === '__custom__' && (
                <input style={{ ...inp, marginTop: 8 }} placeholder="Enter vendor name" onChange={e => setOrderVendor(e.target.value)} />
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: 13, display: 'block', marginBottom: 4 }}>Expected Date</label>
                <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: 13, display: 'block', marginBottom: 4 }}>Notes</label>
                <input value={orderNotes} onChange={e => setOrderNotes(e.target.value)} placeholder="Optional notes" style={inp} />
              </div>
            </div>

            {/* Line items */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>Line Items *</label>
                <button onClick={addItem} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(229,51,42,0.4)', background: 'rgba(229,51,42,0.1)', color: '#ff6b64', cursor: 'pointer', fontSize: 12 }}>+ Add Item</button>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 70px 90px 28px', gap: 6, padding: '8px 10px', color: '#475569', fontSize: 11, fontWeight: 600 }}>
                  <span>PART NAME</span><span>SKU</span><span>QTY</span><span>UNIT $</span><span />
                </div>
                {orderItems.map((item, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 70px 90px 28px', gap: 6, padding: '6px 10px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <input value={item.itemName} onChange={e => updateItem(i, 'itemName', e.target.value)} placeholder="e.g. Oil Filter" style={{ ...inp, padding: '6px 8px', fontSize: 13 }} />
                    <input value={item.sku} onChange={e => updateItem(i, 'sku', e.target.value)} placeholder="PF48" style={{ ...inp, padding: '6px 8px', fontSize: 13 }} />
                    <input type="number" min="1" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} style={{ ...inp, padding: '6px 8px', fontSize: 13 }} />
                    <input type="number" step="0.01" min="0" value={item.unitCost} onChange={e => updateItem(i, 'unitCost', e.target.value)} placeholder="0.00" style={{ ...inp, padding: '6px 8px', fontSize: 13 }} />
                    <button onClick={() => removeItem(i)} disabled={orderItems.length === 1}
                      style={{ background: 'none', border: 'none', color: orderItems.length === 1 ? '#374151' : '#f87171', cursor: orderItems.length === 1 ? 'default' : 'pointer', fontSize: 16, padding: 0 }}><FaTimes style={{marginRight:4}} /></button>
                  </div>
                ))}
                <div style={{ padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'right', color: '#f1f5f9', fontSize: 14, fontWeight: 700 }}>
                  Total: ${orderTotal.toFixed(2)}
                </div>
              </div>
            </div>

            {orderError && <p style={{ color: '#fca5a5', fontSize: 13, marginBottom: 12 }}>{orderError}</p>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleCreateOrder} disabled={savingOrder}
                style={{ flex: 1, padding: 12, borderRadius: 8, border: 'none', background: savingOrder ? 'rgba(229,51,42,0.4)' : '#e5332a', color: '#fff', fontWeight: 700, cursor: savingOrder ? 'default' : 'pointer' }}>
                {savingOrder ? 'Placing...' : 'Place Order'}
              </button>
              <button onClick={() => setShowOrderForm(false)}
                style={{ padding: '12px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete vendor confirm modal */}
      {deleteVendorConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 32, maxWidth: 400, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}><FaTrash style={{marginRight:4}} /></div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>Remove Vendor?</h3>
            <p style={{ color: '#94a3b8', marginBottom: 24, fontSize: 14 }}>Remove "{deleteVendorConfirm.name}" from your vendor list?</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setDeleteVendorConfirm(null)} style={{ flex: 1, padding: '10px', background: '#334155', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', color: '#e2e8f0' }}>Cancel</button>
              <button onClick={() => handleDeleteVendor(deleteVendorConfirm.id, deleteVendorConfirm.name)} style={{ flex: 1, padding: '10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete order confirm modal */}
      {deleteOrderConfirmId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 32, maxWidth: 400, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}><FaTrash style={{marginRight:4}} /></div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>Delete Order?</h3>
            <p style={{ color: '#94a3b8', marginBottom: 24, fontSize: 14 }}>This purchase order will be permanently deleted.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setDeleteOrderConfirmId(null)} style={{ flex: 1, padding: '10px', background: '#334155', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', color: '#e2e8f0' }}>Cancel</button>
              <button onClick={() => handleDeleteOrder(deleteOrderConfirmId)} style={{ flex: 1, padding: '10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



