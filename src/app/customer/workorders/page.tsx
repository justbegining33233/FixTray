'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { unwrapWorkOrders } from '@/lib/workOrderList';

const OPEN = new Set(['pending', 'assigned', 'in-progress', 'waiting-estimate', 'waiting-for-payment']);

export default function CustomerWorkOrdersPage() {
  const { user, isLoading } = useRequireAuth(['customer']);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('token');
    fetch('/api/workorders?role=customer', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => setOrders(unwrapWorkOrders(data)))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [user]);

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  const open = orders.filter((order) => OPEN.has(String(order.status || '').toLowerCase()));
  const rest = orders.filter((order) => !OPEN.has(String(order.status || '').toLowerCase()));

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', padding: 24 }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ color: '#e5e7eb', fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Work Orders</h1>
        <p style={{ color: '#9aa3b2', marginBottom: 24 }}>Open jobs first, then recent history.</p>
        {loading ? (
          <div style={{ color: '#9aa3b2' }}>Loading work orders...</div>
        ) : orders.length === 0 ? (
          <div style={{ color: '#9aa3b2' }}>No work orders yet. <Link href="/customer/appointments/new" style={{ color: '#e5332a' }}>Book a service</Link>.</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {[...open, ...rest].map((order) => (
              <Link
                key={order.id}
                href={`/customer/workorders/${order.id}` as any}
                style={{ display: 'block', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16, textDecoration: 'none' }}
              >
                <div style={{ color: '#e5e7eb', fontWeight: 700 }}>
                  WO-{String(order.id).slice(-8).toUpperCase()} · {order.serviceType || order.issueDescription || 'Service'}
                </div>
                <div style={{ color: '#9aa3b2', fontSize: 13, marginTop: 4 }}>
                  {order.status} {order.shop?.shopName ? `· ${order.shop.shopName}` : ''}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
