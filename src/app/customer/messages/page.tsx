'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Messages() {
  const router = useRouter();

  useEffect(() => {
    // Messaging is now internal (staff only). Redirect customers to their work orders
    // where they can communicate directly with the shop through the work order.
    const t = setTimeout(() => router.replace('/customer/workorders'), 3000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#e5e7eb', marginBottom: 12 }}>Messaging has moved</h1>
        <p style={{ fontSize: 15, color: '#9aa3b2', lineHeight: 1.6, marginBottom: 24 }}>
          Customer messaging is now built directly into your work orders.
          Open any work order to send and receive messages with your shop.
        </p>
        <Link
          href="/customer/workorders"
          style={{ display: 'inline-block', padding: '12px 28px', background: '#e5332a', color: 'white', borderRadius: 8, fontWeight: 700, fontSize: 15, textDecoration: 'none' }}
        >
          View My Work Orders
        </Link>
        <p style={{ marginTop: 16, fontSize: 13, color: '#6b7280' }}>Redirecting automatically…</p>
      </div>
    </div>
  );
}
