'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Route } from 'next';
import Link from 'next/link';
import { FaCheckCircle } from 'react-icons/fa';

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const workOrderId = searchParams?.get('workOrderId');
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!workOrderId) return;
    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timer);
          router.push(`/customer/workorders/${workOrderId}` as Route);
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [workOrderId]);

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
        border: '1px solid rgba(34,197,94,0.3)',
        borderRadius: 16,
        padding: 48,
        textAlign: 'center',
        maxWidth: 480,
        width: '100%',
        margin: '0 16px',
      }}>
        <div style={{fontSize: 64, marginBottom: 16}}><FaCheckCircle style={{marginRight:4}} /></div>
        <h1 style={{fontSize: 28, fontWeight: 700, color: '#22c55e', marginBottom: 8}}>
          Payment Successful!
        </h1>
        <p style={{color: '#9aa3b2', fontSize: 16, marginBottom: 32}}>
          Your payment was processed securely. A receipt has been sent to your email.
        </p>
        {workOrderId && (
          <>
            <Link
              href={`/customer/workorders/${workOrderId}`}
              style={{
                display: 'block',
                padding: '14px 32px',
                background: '#22c55e',
                color: 'white',
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 16,
                textDecoration: 'none',
                marginBottom: 12,
              }}
            >
              View Work Order
            </Link>
            <p style={{color: '#6b7280', fontSize: 13}}>
              Redirecting in {countdown}s...
            </p>
          </>
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

export default function PaymentSuccess() {
  return (
    <Suspense fallback={<div style={{minHeight:'100vh', background: 'transparent'}} />}>
      <SuccessContent />
    </Suspense>
  );
}

