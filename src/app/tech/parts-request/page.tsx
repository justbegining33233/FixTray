'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft } from 'react-icons/fa';

export default function TechPartsRequestPage() {
  const { user, isLoading } = useRequireAuth(['tech']);
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const canSubmit = itemName.trim().length > 0 && Number(quantity) >= 1 && reason.trim().length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !user) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/shop/inventory-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          shopId: user.shopId,
          requestedById: user.id,
          itemName: itemName.trim(),
          quantity: Number(quantity),
          reason: reason.trim(),
          urgency: 'normal',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMsg({ type: 'error', text: err.error || 'Failed to submit parts request' });
        return;
      }
      setMsg({ type: 'success', text: 'Parts request submitted to your shop.' });
      setItemName('');
      setQuantity('1');
      setReason('');
    } catch {
      setMsg({ type: 'error', text: 'Failed to submit parts request' });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', padding: 24 }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <Link href="/tech/inventory" style={{ color: '#e5332a', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
          <FaArrowLeft style={{ marginRight: 4 }} /> Back to Inventory
        </Link>
        <h1 style={{ color: '#e5e7eb', fontSize: 28, fontWeight: 700, margin: '16px 0 8px' }}>Parts Request</h1>
        <p style={{ color: '#9aa3b2', marginBottom: 24 }}>Send a parts request to your shop manager.</p>
        <form onSubmit={submit} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 24, display: 'grid', gap: 14 }}>
          <label style={{ color: '#9aa3b2', fontSize: 13 }}>
            Item *
            <input required value={itemName} onChange={(e) => setItemName(e.target.value)} style={{ width: '100%', marginTop: 6, padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: '#e5e7eb' }} />
          </label>
          <label style={{ color: '#9aa3b2', fontSize: 13 }}>
            Quantity *
            <input required type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} style={{ width: '100%', marginTop: 6, padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: '#e5e7eb' }} />
          </label>
          <label style={{ color: '#9aa3b2', fontSize: 13 }}>
            Reason *
            <textarea required value={reason} onChange={(e) => setReason(e.target.value)} rows={4} style={{ width: '100%', marginTop: 6, padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: '#e5e7eb' }} />
          </label>
          <button type="submit" disabled={!canSubmit || submitting} style={{ padding: 14, background: '#e5332a', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: canSubmit && !submitting ? 'pointer' : 'not-allowed', opacity: canSubmit && !submitting ? 1 : 0.5 }}>
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
        {msg && <p style={{ marginTop: 16, color: msg.type === 'success' ? '#22c55e' : '#fca5a5' }}>{msg.text}</p>}
      </div>
    </div>
  );
}
