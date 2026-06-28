'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  FaArrowLeft, FaUser, FaCar, FaWrench, FaMapMarkerAlt,
  FaCalendarAlt, FaDollarSign, FaComment, FaBox, FaTruck,
  FaCheckCircle, FaClock, FaExclamationCircle, FaPlus, FaTrash,
  FaPaperPlane, FaSave, FaEnvelope, FaSearch, FaPaperclip, FaTimes, FaStopwatch,
} from 'react-icons/fa';

// ─── Types ────────────────────────────────────────────────────────────────────

type WOMessage = { id: string; sender: string; senderName: string; body: string; createdAt: string };
type Vehicle   = { id: string; vehicleType: string; make?: string; model?: string; year?: number; vin?: string; licensePlate?: string };

type LineItem = { _key: string; type: 'labor' | 'part' | 'misc'; description: string; partNumber: string; price: number; qty: number; status: 'new' | 'saved'; poId?: string; poCost?: number; };

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

type InvItem = { id: string; name: string; sku?: string | null; price: number; quantity: number; type: string; rate?: number | null };
type SvcItem = { id: string; serviceName: string; category: string; price?: number | null; duration?: number | null; description?: string | null };

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
  'estimate-submitted':  { bg: 'rgba(96,165,250,0.15)',  color: '#60a5fa',  icon: <FaEnvelope /> },
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

  // Submit estimate state
  const [submittingEst, setSubmittingEst] = useState(false);
  const [submitEstMsg,  setSubmitEstMsg]  = useState('');
  const [userRole,      setUserRole]      = useState<string | null>(null);

  // Messaging state
  const [messages,   setMessages]     = useState<WOMessage[]>([]);
  const [msgText,    setMsgText]      = useState('');
  const [sending,    setSending]      = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Media attachments in messages
  const [pendingMedia,    setPendingMedia]    = useState<string[]>([]);
  const [uploadingMedia,  setUploadingMedia]  = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  // Add line item modal
  const [showItemModal,   setShowItemModal]   = useState(false);
  const [modalTab,        setModalTab]        = useState<'inventory' | 'services' | 'pickup' | 'custom'>('inventory');
  const [inventoryItems,  setInventoryItems]  = useState<InvItem[]>([]);
  const [shopServices,    setShopServices]    = useState<SvcItem[]>([]);
  const [shopMarkup,      setShopMarkup]      = useState(0.30);
  const [itemSearch,      setItemSearch]      = useState('');
  const [modalLoading,    setModalLoading]    = useState(false);
  const [poVendor,        setPoVendor]        = useState('');
  const [poPartName,      setPoPartName]      = useState('');
  const [poSku,           setPoSku]           = useState('');
  const [poCost,          setPoCost]          = useState<number>(0);
  const [poQty,           setPoQty]           = useState<number>(1);
  // Custom tab
  const [customDesc,      setCustomDesc]      = useState('');
  const [customType,      setCustomType]      = useState<'part' | 'labor' | 'misc'>('part');
  const [customPrice,     setCustomPrice]     = useState<number>(0);
  const [customQty,       setCustomQty]       = useState<number>(1);
  // PO edit modal
  const [editPoLine,      setEditPoLine]      = useState<LineItem | null>(null);
  const [editPoCost,      setEditPoCost]      = useState<number>(0);
  const [editPoQty,       setEditPoQty]       = useState<number>(1);

  // Clock in / out
  const [userId,       setUserId]       = useState<string | null>(null);
  const [userShopId,   setUserShopId]   = useState<string | null>(null);
  const [clockEntry,   setClockEntry]   = useState<{ id: string; clockIn: string } | null>(null);
  const [clockLoading, setClockLoading] = useState(false);
  const [clockMsg,     setClockMsg]     = useState('');
  const [clockTimer,   setClockTimer]   = useState('');

  // Load work order + read userRole/userId/shopId from localStorage
  useEffect(() => {
    if (!id) return;
    let role: string | null = null;
    let uid2: string | null = null;
    if (typeof window !== 'undefined') {
      role = localStorage.getItem('userRole');
      uid2 = localStorage.getItem('userId');
      setUserRole(role);
      setUserId(uid2);
      setUserShopId(localStorage.getItem('shopId'));
    }
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

    // Check if tech/manager already has an open clock-in for today
    if ((role === 'tech' || role === 'manager') && uid2 && token) {
      const today = new Date().toISOString().split('T')[0];
      fetch(`/api/time-tracking?techId=${uid2}&startDate=${today}&endDate=${today}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.timeEntries) {
            const open = (d.timeEntries as Array<{ id: string; clockIn: string; clockOut?: string | null }>)
              .find(e => !e.clockOut);
            if (open) setClockEntry({ id: open.id, clockIn: open.clockIn });
          }
        })
        .catch(() => {});
    }
  }, [id]);

  // Scroll messages to bottom when new ones arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Live clock timer
  useEffect(() => {
    if (!clockEntry) { setClockTimer(''); return; }
    const update = () => {
      const elapsed = Date.now() - new Date(clockEntry.clockIn).getTime();
      const h = Math.floor(elapsed / 3600000);
      const m = Math.floor((elapsed % 3600000) / 60000);
      const s = Math.floor((elapsed % 60000) / 1000);
      setClockTimer(`${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [clockEntry]);

  // ── Parse message body (supports embedded media JSON) ─────────────────────
  function parseMessageBody(body: string): { text: string; media: string[] } {
    try {
      const p = JSON.parse(body);
      if (p && typeof p.t === 'string' && Array.isArray(p.m)) return { text: p.t, media: p.m as string[] };
    } catch { /* plain text */ }
    return { text: body, media: [] };
  }

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

  // ── Submit estimate to customer ───────────────────────────────────────────
  const handleSubmitEstimate = async () => {
    if (!id) return;
    if (grandTotal === 0) { setSubmitEstMsg('Add line items first.'); setTimeout(() => setSubmitEstMsg(''), 3000); return; }
    setSubmittingEst(true); setSubmitEstMsg('');
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    try {
      const res = await fetch(`/api/workorders/${id}/submit-estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (res.ok) {
        setSubmitEstMsg('Submitted!');
        // Refresh work order to show updated status
        const r = await fetch(`/api/workorders/${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (r.ok) { const d = await r.json(); setWo(d?.workOrder ?? d); }
        setTimeout(() => setSubmitEstMsg(''), 4000);
      } else {
        const d = await res.json();
        setSubmitEstMsg(d.error || 'Failed.');
        setTimeout(() => setSubmitEstMsg(''), 4000);
      }
    } catch { setSubmitEstMsg('Failed.'); setTimeout(() => setSubmitEstMsg(''), 3000); }
    finally { setSubmittingEst(false); }
  };

  // ── Send message (with optional media) ───────────────────────────────────
  const handleSendMessage = async () => {
    if (!id || (!msgText.trim() && pendingMedia.length === 0)) return;
    setSending(true);
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    try {
      const bodyVal = pendingMedia.length > 0
        ? JSON.stringify({ t: msgText.trim(), m: pendingMedia })
        : msgText.trim();
      const res = await fetch(`/api/workorders/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ body: bodyVal }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, data.message]);
        setMsgText('');
        setPendingMedia([]);
      }
    } finally { setSending(false); }
  };

  // ── Upload media attachment ───────────────────────────────────────────────
  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMedia(true);
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'workorder-messages');
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (res.ok) {
        const { url } = await res.json();
        setPendingMedia(prev => [...prev, url]);
      }
    } catch { /* ignore */ }
    finally {
      setUploadingMedia(false);
      if (mediaInputRef.current) mediaInputRef.current.value = '';
    }
  };

  // ── Open add-item modal + fetch shop data ─────────────────────────────────
  const handleOpenItemModal = async () => {
    setShowItemModal(true);
    setModalTab('inventory');
    setItemSearch('');
    setCustomDesc(''); setCustomType('part'); setCustomPrice(0); setCustomQty(1);
    if (inventoryItems.length > 0 || shopServices.length > 0) return; // already loaded
    setModalLoading(true);
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const shopId2 = typeof window !== 'undefined' ? localStorage.getItem('shopId') : null;
    if (!shopId2) { setModalLoading(false); return; }
    try {
      const [invRes, svcRes, settingsRes] = await Promise.all([
        fetch(`/api/inventory?shopId=${shopId2}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
        fetch(`/api/services?shopId=${shopId2}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
        fetch(`/api/shop/settings?shopId=${shopId2}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
      ]);
      if (invRes.ok) { const d = await invRes.json(); setInventoryItems(d.items || []); }
      if (svcRes.ok) { const d = await svcRes.json(); setShopServices(d.services || []); }
      if (settingsRes.ok) { const d = await settingsRes.json(); setShopMarkup(d.settings?.inventoryMarkup ?? 0.30); }
    } catch { /* ignore */ }
    finally { setModalLoading(false); }
  };

  // ── Add inventory item to line items ──────────────────────────────────────
  const handleAddInventoryItem = (item: InvItem) => {
    setLineItems(prev => [...prev, {
      _key: uid(), type: item.type === 'labor' ? 'labor' : 'part',
      description: item.name, partNumber: item.sku || '',
      price: item.type === 'labor' ? (item.rate ?? item.price) : item.price,
      qty: 1, status: 'new',
    }]);
    setShowItemModal(false);
  };

  // ── Add service to line items ─────────────────────────────────────────────
  const handleAddService = (svc: SvcItem) => {
    setLineItems(prev => [...prev, {
      _key: uid(), type: 'labor',
      description: svc.serviceName, partNumber: '',
      price: svc.price ?? 0,
      qty: svc.duration ? Math.round((svc.duration / 60) * 4) / 4 : 1, // duration in minutes → hours (0.25 increments)
      status: 'new',
    }]);
    setShowItemModal(false);
  };

  // ── Add part pickup + create PO ───────────────────────────────────────────
  const handleAddPartPickup = async () => {
    if (!poPartName.trim() || !poVendor.trim()) return;
    const sellingPrice = poCost * (1 + shopMarkup);
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const shopId2 = typeof window !== 'undefined' ? localStorage.getItem('shopId') : null;
    const userId2 = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
    let poId: string | undefined;
    if (shopId2 && poVendor.trim()) {
      try {
        const res = await fetch('/api/purchase-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({
            shopId: shopId2, vendor: poVendor.trim(), createdById: userId2,
            items: [{ itemName: poPartName.trim(), sku: poSku.trim() || undefined, quantity: poQty, unitCost: poCost, workOrderId: id }],
          }),
        });
        if (res.ok) { const d = await res.json(); poId = d.order?.id; }
      } catch { /* non-blocking */ }
    }
    setLineItems(prev => [...prev, {
      _key: uid(), type: 'part',
      description: `${poPartName.trim()} (PO: ${poVendor.trim()})`,
      partNumber: poSku.trim(), price: sellingPrice, qty: poQty, status: 'new',
      poId, poCost,
    }]);
    setPoVendor(''); setPoPartName(''); setPoSku(''); setPoCost(0); setPoQty(1);
    setShowItemModal(false);
  };

  // ── Add custom line item ──────────────────────────────────────────────────
  const handleAddCustomItem = () => {
    if (!customDesc.trim()) return;
    setLineItems(prev => [...prev, {
      _key: uid(), type: customType,
      description: customDesc.trim(), partNumber: '',
      price: customPrice, qty: customQty, status: 'new',
    }]);
    setCustomDesc(''); setCustomType('part'); setCustomPrice(0); setCustomQty(1);
    setShowItemModal(false);
  };

  // ── Clock in ──────────────────────────────────────────────────────────────
  const handleClockIn = async () => {
    if (!userId || !userShopId) return;
    setClockLoading(true); setClockMsg('');
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    try {
      const res = await fetch('/api/time-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: 'clock-in', techId: userId, shopId: userShopId, workOrderId: id }),
      });
      const data = await res.json();
      if (res.ok) {
        setClockEntry({ id: data.timeEntry.id, clockIn: data.timeEntry.clockIn });
        setClockMsg('Clocked in!');
      } else {
        if (data.entry) setClockEntry({ id: data.entry.id, clockIn: data.entry.clockIn });
        setClockMsg(data.error || 'Failed.');
      }
      setTimeout(() => setClockMsg(''), 3000);
    } catch { setClockMsg('Failed.'); setTimeout(() => setClockMsg(''), 3000); }
    finally { setClockLoading(false); }
  };

  // ── Clock out ─────────────────────────────────────────────────────────────
  const handleClockOut = async () => {
    if (!userId || !userShopId) return;
    setClockLoading(true); setClockMsg('');
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    try {
      const res = await fetch('/api/time-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: 'clock-out', techId: userId, shopId: userShopId }),
      });
      if (res.ok) { setClockEntry(null); setClockMsg('Clocked out!'); }
      else { const d = await res.json(); setClockMsg(d.error || 'Failed.'); }
      setTimeout(() => setClockMsg(''), 3000);
    } catch { setClockMsg('Failed.'); setTimeout(() => setClockMsg(''), 3000); }
    finally { setClockLoading(false); }
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

  // Authorization gates clock-in: estimate must be accepted before tech can start
  const awaitingAuth = wo.status === 'estimate-submitted';
  const authDenied   = wo.status === 'denied-estimate';
  const canClockIn   = ['pending', 'assigned', 'in-progress', 'waiting-estimate', 'waiting-for-payment'].includes(wo.status);
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

        {/* ── Clock In / Out (gated by customer authorization) ── */}
        {(userRole === 'tech' || userRole === 'manager') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {awaitingAuth && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
                <FaClock style={{ fontSize: 11 }} /> Awaiting Customer Authorization
              </span>
            )}
            {authDenied && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
                <FaExclamationCircle style={{ fontSize: 11 }} /> Authorization Denied
              </span>
            )}
            {canClockIn && (
              <>
                {clockTimer && (
                  <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 700, fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <FaStopwatch style={{ fontSize: 11 }} /> {clockTimer}
                  </span>
                )}
                {clockMsg && (
                  <span style={{ fontSize: 11, color: clockMsg.includes('!') ? '#22c55e' : '#f87171' }}>{clockMsg}</span>
                )}
                <button
                  onClick={clockEntry ? handleClockOut : handleClockIn}
                  disabled={clockLoading || !userId}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, background: clockEntry ? 'rgba(229,51,42,0.15)' : 'rgba(34,197,94,0.15)', border: `1px solid ${clockEntry ? 'rgba(229,51,42,0.3)' : 'rgba(34,197,94,0.3)'}`, color: clockEntry ? '#e5332a' : '#22c55e', fontSize: 12, fontWeight: 700, borderRadius: 8, padding: '7px 14px', cursor: clockLoading ? 'not-allowed' : 'pointer', opacity: clockLoading ? 0.6 : 1 }}
                >
                  <FaClock style={{ fontSize: 11 }} />
                  {clockLoading ? '…' : clockEntry ? 'Clock Out' : 'Clock In'}
                </button>
              </>
            )}
          </div>
        )}

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
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 5, background: saving ? 'transparent' : saveMsg === 'Saved!' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${saveMsg === 'Saved!' ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`, color: saveMsg === 'Saved!' ? '#22c55e' : '#e5e7eb', fontSize: 12, fontWeight: 700, borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
                  <FaSave style={{ fontSize: 11 }} /> {saving ? 'Saving…' : saveMsg || 'Save'}
                </button>
                {userRole !== 'customer' && (
                  <button onClick={handleSubmitEstimate} disabled={submittingEst} style={{ display: 'flex', alignItems: 'center', gap: 5, background: submitEstMsg === 'Submitted!' ? 'rgba(34,197,94,0.15)' : 'rgba(96,165,250,0.12)', border: `1px solid ${submitEstMsg === 'Submitted!' ? 'rgba(34,197,94,0.3)' : 'rgba(96,165,250,0.3)'}`, color: submitEstMsg === 'Submitted!' ? '#22c55e' : '#60a5fa', fontSize: 12, fontWeight: 700, borderRadius: 6, padding: '4px 10px', cursor: submittingEst ? 'not-allowed' : 'pointer', opacity: submittingEst ? 0.6 : 1 }}>
                    <FaEnvelope style={{ fontSize: 11 }} /> {submittingEst ? 'Submitting…' : submitEstMsg || (wo.status === 'denied-estimate' ? 'Reissue Estimate' : 'Submit Estimate')}
                  </button>
                )}
              </div>
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
                        <input style={{ ...inputStyle, textAlign: 'right' }} type="number" min={0} step={0.01} value={li.price}
                          onFocus={e => e.target.select()}
                          onChange={e => setLineItems(prev => prev.map(x => x._key === li._key ? { ...x, price: parseFloat(e.target.value) || 0, status: 'new' } : x))} />
                      </td>
                      <td style={tdStyle}>
                        <input style={{ ...inputStyle, textAlign: 'right' }} type="number" min={0} step={li.type === 'labor' ? 0.25 : 1} value={li.qty}
                          onFocus={e => e.target.select()}
                          onChange={e => setLineItems(prev => prev.map(x => x._key === li._key ? { ...x, qty: parseFloat(e.target.value) || 0, status: 'new' } : x))} />
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
                        {li.poId && (
                          <button onClick={() => { setEditPoLine(li); setEditPoCost(li.poCost ?? li.price); setEditPoQty(li.qty); }}
                            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', cursor: 'pointer', fontSize: 10, padding: '3px 6px', borderRadius: 4, marginRight: 4, fontWeight: 700 }}>PO</button>
                        )}
                        <button onClick={() => setLineItems(prev => prev.filter(x => x._key !== li._key))} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 13, padding: '4px' }}><FaTrash /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add row + totals */}
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <button onClick={handleOpenItemModal} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'transparent', border: '1px dashed rgba(255,255,255,0.15)', color: '#9aa3b2', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
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
                const parsed = parseMessageBody(msg.body);
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isShop ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '80%', padding: '8px 12px', borderRadius: isShop ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      background: isShop ? 'rgba(229,51,42,0.18)' : 'rgba(255,255,255,0.07)',
                      border: `1px solid ${isShop ? 'rgba(229,51,42,0.3)' : 'rgba(255,255,255,0.1)'}`,
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: isShop ? '#e5332a' : '#60a5fa', marginBottom: 4 }}>{msg.senderName || msg.sender}</div>
                      {parsed.text && <p style={{ margin: 0, fontSize: 13, color: '#e5e7eb', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{parsed.text}</p>}
                      {parsed.media.map((url, i) => {
                        const isVid = /\.(mp4|webm|mov|avi)(\?|$)/i.test(url);
                        return isVid
                          ? <video key={i} src={url} controls style={{ maxWidth: '100%', borderRadius: 6, marginTop: parsed.text ? 6 : 0, display: 'block' }} />
                          : <img key={i} src={url} alt="attachment" onClick={() => window.open(url, '_blank')} style={{ maxWidth: '100%', borderRadius: 6, marginTop: parsed.text ? 6 : 0, display: 'block', cursor: 'pointer' }} />;
                      })}
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

            {/* Pending media previews */}
            {pendingMedia.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {pendingMedia.map((url, i) => (
                  <div key={i} style={{ position: 'relative', display: 'inline-block' }}>
                    {/\.(mp4|webm|mov|avi)(\?|$)/i.test(url)
                      ? <video src={url} style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 6, background: '#000' }} />
                      : <img src={url} alt="" style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 6 }} />
                    }
                    <button onClick={() => setPendingMedia(prev => prev.filter((_, j) => j !== i))}
                      style={{ position: 'absolute', top: -6, right: -6, background: '#e5332a', border: 'none', borderRadius: '50%', width: 18, height: 18, color: '#fff', fontSize: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                      <FaTimes />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Compose */}
            <input ref={mediaInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleMediaUpload} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => mediaInputRef.current?.click()}
                disabled={uploadingMedia}
                title="Attach photo or video"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, flexShrink: 0, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: uploadingMedia ? '#f59e0b' : '#9aa3b2', cursor: 'pointer', fontSize: 15 }}
              >
                {uploadingMedia ? '⏳' : <FaPaperclip />}
              </button>
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
                disabled={sending || (!msgText.trim() && pendingMedia.length === 0)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 16px', background: 'rgba(229,51,42,0.18)', border: '1px solid rgba(229,51,42,0.3)', color: '#e5332a', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: ((!msgText.trim() && pendingMedia.length === 0) || sending) ? 0.5 : 1 }}
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

      {/* ── Add Line Item Modal ── */}
      {showItemModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setShowItemModal(false)}>
          <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, width: '100%', maxWidth: 620, maxHeight: '82vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#e5e7eb' }}>Add Line Item</span>
              <button onClick={() => setShowItemModal(false)} style={{ background: 'none', border: 'none', color: '#9aa3b2', cursor: 'pointer', fontSize: 16, padding: 4 }}><FaTimes /></button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              {(['inventory', 'services', 'pickup', 'custom'] as const).map(tab => (
                <button key={tab} onClick={() => { setModalTab(tab); setItemSearch(''); }}
                  style={{ flex: 1, padding: '10px 4px', background: 'none', border: 'none', borderBottom: `2px solid ${modalTab === tab ? '#e5332a' : 'transparent'}`, color: modalTab === tab ? '#e5332a' : '#9aa3b2', fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {tab === 'pickup' ? 'Part Pickup (PO)' : tab === 'custom' ? 'Custom' : tab}
                </button>
              ))}
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              {modalLoading ? (
                <div style={{ textAlign: 'center', color: '#9aa3b2', padding: 40, fontSize: 13 }}>Loading shop data…</div>
              ) : modalTab === 'inventory' ? (
                <>
                  <div style={{ position: 'relative', marginBottom: 12 }}>
                    <FaSearch style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', fontSize: 12, pointerEvents: 'none' }} />
                    <input value={itemSearch} onChange={e => setItemSearch(e.target.value)} placeholder="Search inventory by name or SKU…" autoFocus
                      style={{ ...inputStyle, paddingLeft: 30 }} />
                  </div>
                  {inventoryItems
                    .filter(it => !itemSearch || it.name.toLowerCase().includes(itemSearch.toLowerCase()) || (it.sku || '').toLowerCase().includes(itemSearch.toLowerCase()))
                    .length === 0
                    ? <div style={{ textAlign: 'center', color: '#6b7280', padding: '28px 0', fontSize: 13 }}>No inventory items found.</div>
                    : inventoryItems
                        .filter(it => !itemSearch || it.name.toLowerCase().includes(itemSearch.toLowerCase()) || (it.sku || '').toLowerCase().includes(itemSearch.toLowerCase()))
                        .map(item => (
                          <div key={item.id} onClick={() => handleAddInventoryItem(item)}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', marginBottom: 6, cursor: 'pointer' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(229,51,42,0.08)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb' }}>{item.name}</div>
                              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                                {item.sku ? `SKU: ${item.sku}` : ''}{item.sku ? ' · ' : ''}Qty in stock: {item.quantity}{item.type === 'labor' ? ' · Labor' : ''}
                              </div>
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#22c55e', whiteSpace: 'nowrap', marginLeft: 12 }}>
                              {item.type === 'labor' && item.rate != null ? `$${item.rate}/hr` : `$${item.price.toFixed(2)}`}
                            </div>
                          </div>
                        ))
                  }
                </>
              ) : modalTab === 'services' ? (
                <>
                  <div style={{ position: 'relative', marginBottom: 12 }}>
                    <FaSearch style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', fontSize: 12, pointerEvents: 'none' }} />
                    <input value={itemSearch} onChange={e => setItemSearch(e.target.value)} placeholder="Search services by name or category…" autoFocus
                      style={{ ...inputStyle, paddingLeft: 30 }} />
                  </div>
                  {shopServices
                    .filter(s => !itemSearch || s.serviceName.toLowerCase().includes(itemSearch.toLowerCase()) || s.category.toLowerCase().includes(itemSearch.toLowerCase()))
                    .length === 0
                    ? <div style={{ textAlign: 'center', color: '#6b7280', padding: '28px 0', fontSize: 13 }}>No services found.</div>
                    : shopServices
                        .filter(s => !itemSearch || s.serviceName.toLowerCase().includes(itemSearch.toLowerCase()) || s.category.toLowerCase().includes(itemSearch.toLowerCase()))
                        .map(svc => (
                          <div key={svc.id} onClick={() => handleAddService(svc)}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', marginBottom: 6, cursor: 'pointer' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(229,51,42,0.08)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb' }}>{svc.serviceName}</div>
                              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, textTransform: 'capitalize' }}>
                                {svc.category}{svc.duration ? ` · ${svc.duration} min` : ''}{svc.description ? ` · ${svc.description}` : ''}
                              </div>
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#22c55e', whiteSpace: 'nowrap', marginLeft: 12 }}>
                              {svc.price != null ? `$${svc.price.toFixed(2)}` : 'Custom'}
                            </div>
                          </div>
                        ))
                  }
                </>
              ) : modalTab === 'pickup' ? (
                /* Part Pickup / PO form */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, fontSize: 12, color: '#f59e0b', lineHeight: 1.5 }}>
                    A Purchase Order will be created automatically when you add this item. The shop markup of <strong>{(shopMarkup * 100).toFixed(0)}%</strong> is applied to your cost to set the customer price.
                  </div>
                  {([
                    { label: 'Vendor / Supplier *', value: poVendor, set: setPoVendor, placeholder: 'e.g. NAPA Auto Parts' },
                    { label: 'Part Name *', value: poPartName, set: setPoPartName, placeholder: 'e.g. Oil Filter' },
                    { label: 'Part Number / SKU', value: poSku, set: setPoSku, placeholder: 'Optional' },
                  ] as { label: string; value: string; set: (v: string) => void; placeholder: string }[]).map(({ label, value, set, placeholder }) => (
                    <div key={label}>
                      <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{label}</div>
                      <input value={value} onChange={e => set(e.target.value)} placeholder={placeholder} style={inputStyle} />
                    </div>
                  ))}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Your Cost ($) *</div>
                      <input type="number" min={0} step={0.01} value={poCost}
                        onFocus={e => e.target.select()}
                        onChange={e => setPoCost(parseFloat(e.target.value) || 0)} style={{ ...inputStyle, textAlign: 'right' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Quantity *</div>
                      <input type="number" min={1} step={1} value={poQty}
                        onFocus={e => e.target.select()}
                        onChange={e => setPoQty(Math.max(1, parseInt(e.target.value) || 1))} style={{ ...inputStyle, textAlign: 'right' }} />
                    </div>
                  </div>
                  {poCost > 0 && (
                    <div style={{ padding: '12px 14px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>Unit cost: ${poCost.toFixed(2)} + {(shopMarkup * 100).toFixed(0)}% markup</div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>Customer unit price: ${(poCost * (1 + shopMarkup)).toFixed(2)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#9aa3b2', textAlign: 'right' }}>Total (×{poQty})</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#22c55e' }}>${(poCost * (1 + shopMarkup) * poQty).toFixed(2)}</div>
                      </div>
                    </div>
                  )}
                  <button onClick={handleAddPartPickup} disabled={!poPartName.trim() || !poVendor.trim() || poCost <= 0}
                    style={{ padding: '10px 16px', background: (!poPartName.trim() || !poVendor.trim() || poCost <= 0) ? 'rgba(255,255,255,0.04)' : 'rgba(229,51,42,0.18)', border: `1px solid ${(!poPartName.trim() || !poVendor.trim() || poCost <= 0) ? 'rgba(255,255,255,0.08)' : 'rgba(229,51,42,0.3)'}`, color: (!poPartName.trim() || !poVendor.trim() || poCost <= 0) ? '#4b5563' : '#e5332a', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: (!poPartName.trim() || !poVendor.trim() || poCost <= 0) ? 'not-allowed' : 'pointer' }}>
                    Add Part Pickup &amp; Create PO
                  </button>
                </div>
              ) : (
                /* Custom line item */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Description *</div>
                    <input value={customDesc} onChange={e => setCustomDesc(e.target.value)} placeholder="e.g. Diagnostic fee, Shop supplies…" autoFocus style={inputStyle} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Type</div>
                    <select value={customType} onChange={e => setCustomType(e.target.value as 'part' | 'labor' | 'misc')} style={{ ...inputStyle, padding: '8px 10px' }}>
                      <option value="part">Part</option>
                      <option value="labor">Labor</option>
                      <option value="misc">Misc / Fee</option>
                    </select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Unit Price ($)</div>
                      <input type="number" min={0} step={0.01} value={customPrice}
                        onFocus={e => e.target.select()}
                        onChange={e => setCustomPrice(parseFloat(e.target.value) || 0)}
                        style={{ ...inputStyle, textAlign: 'right' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Quantity</div>
                      <input type="number" min={customType === 'labor' ? 0.25 : 1} step={customType === 'labor' ? 0.25 : 1} value={customQty}
                        onFocus={e => e.target.select()}
                        onChange={e => setCustomQty(parseFloat(e.target.value) || 1)}
                        style={{ ...inputStyle, textAlign: 'right' }} />
                    </div>
                  </div>
                  {customPrice > 0 && (
                    <div style={{ padding: '10px 14px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#9aa3b2' }}>Total (×{customQty})</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: '#22c55e' }}>${(customPrice * customQty).toFixed(2)}</span>
                    </div>
                  )}
                  <button onClick={handleAddCustomItem} disabled={!customDesc.trim()}
                    style={{ padding: '10px 16px', background: !customDesc.trim() ? 'rgba(255,255,255,0.04)' : 'rgba(229,51,42,0.18)', border: `1px solid ${!customDesc.trim() ? 'rgba(255,255,255,0.08)' : 'rgba(229,51,42,0.3)'}`, color: !customDesc.trim() ? '#4b5563' : '#e5332a', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: !customDesc.trim() ? 'not-allowed' : 'pointer' }}>
                    Add Custom Line Item
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PO edit modal */}
      {editPoLine && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setEditPoLine(null)}>
          <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, width: '100%', maxWidth: 420, padding: 20 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#e5e7eb' }}>Edit PO Line Item</span>
              <button onClick={() => setEditPoLine(null)} style={{ background: 'none', border: 'none', color: '#9aa3b2', cursor: 'pointer', fontSize: 16, padding: 4 }}><FaTimes /></button>
            </div>
            <div style={{ fontSize: 13, color: '#9aa3b2', marginBottom: 16, padding: '10px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>
              {editPoLine.description}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Your Cost ($)</div>
                <input type="number" min={0} step={0.01} value={editPoCost}
                  onFocus={e => e.target.select()}
                  onChange={e => setEditPoCost(parseFloat(e.target.value) || 0)}
                  style={{ ...inputStyle, textAlign: 'right' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Quantity</div>
                <input type="number" min={1} step={1} value={editPoQty}
                  onFocus={e => e.target.select()}
                  onChange={e => setEditPoQty(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ ...inputStyle, textAlign: 'right' }} />
              </div>
            </div>
            <div style={{ padding: '10px 14px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Unit cost: ${editPoCost.toFixed(2)} + {(shopMarkup * 100).toFixed(0)}% markup</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Customer price: ${(editPoCost * (1 + shopMarkup)).toFixed(2)}/unit</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#9aa3b2' }}>Total (×{editPoQty})</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#22c55e' }}>${(editPoCost * (1 + shopMarkup) * editPoQty).toFixed(2)}</div>
              </div>
            </div>
            <button onClick={() => {
              const newPrice = editPoCost * (1 + shopMarkup);
              setLineItems(prev => prev.map(x => x._key === editPoLine._key ? { ...x, price: newPrice, qty: editPoQty, poCost: editPoCost, status: 'new' } : x));
              if (editPoLine.poId) {
                const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
                fetch(`/api/purchase-orders/${editPoLine.poId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                  body: JSON.stringify({ notes: `Cost adjusted: $${editPoCost.toFixed(2)}/unit × ${editPoQty} on ${new Date().toLocaleDateString()}` }),
                }).catch(() => {});
              }
              setEditPoLine(null);
            }} style={{ width: '100%', padding: '10px 16px', background: 'rgba(229,51,42,0.18)', border: '1px solid rgba(229,51,42,0.3)', color: '#e5332a', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Apply Price Changes
            </button>
          </div>
        </div>
      )}

    </main>
  );
}

