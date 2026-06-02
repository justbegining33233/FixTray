'use client';
import { FaUndo } from 'react-icons/fa';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function CancelContent() {
  const searchParams = useSearchParams();
  const workOrderId = searchParams?.get('workOrderId');

  return (
    <div style={{
      minHeight: '100vh',
      background: 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        background: 'rgba(0,0,0,0.4)',
        border: '1px solid rgba(245,158,11,0.3)',
        borderRadius: 16,
        padding: 48,
        textAlign: 'center',
        maxWidth: 480,
        width: '100%',
        margin: '0 16px',
      }}>
        <div style={{fontSize: 64, marginBottom: 16}}><FaUndo style={{marginRight:4}} /></div>
        <h1 style={{fontSize: 28, fontWeight: 700, color: '#f59e0b', marginBottom: 8}}>
          Payment Cancelled
        </h1>
        <p style={{color: '#9aa3b2', fontSize: 16, marginBottom: 32}}>
          No charge was made. You can try again whenever you&apos;re ready.
        </p>
        {workOrderId && (
          <Link
            href={`/customer/workorders/${workOrderId}`}
            style={{
              display: 'block',
              padding: '14px 32px',
              background: '#f59e0b',
              color: 'white',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 16,
              textDecoration: 'none',
              marginBottom: 12,
            }}
          >
            Return to Work Order
          </Link>
        )}
        <Link
          href="/customer/dashboard"
          style={{
            display: 'block',
            marginTop: 16,
            color: '#e5332a',
            fontSize: 14,
            textDecoration: 'none',
          }}
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}

export default function PaymentCancel() {
  return (
    <Suspense fallback={<div style={{minHeight:'100vh', background: 'transparent'}} />}>
      <CancelContent />
    </Suspense>
  );
}

