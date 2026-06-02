'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function SuccessContent() {
  const params = useSearchParams();
  const shopId = params?.get('shopId') ?? null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', padding: 24 }}>
      <div style={{ maxWidth: 520, width: '100%', background: 'rgba(10,16,32,0.68)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 48, boxShadow: '0 8px 36px rgba(0,0,0,0.55)', textAlign: 'center' }}>
        {/* Check icon */}
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#f1f5f9', marginBottom: 12 }}>
          You&rsquo;re all set!
        </h1>

        <p style={{ color: '#94a3b8', lineHeight: 1.6, marginBottom: 8 }}>
          Your 7-day free trial has started. Your card won&rsquo;t be charged until the trial ends.
        </p>

        <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6, marginBottom: 32 }}>
          Our team will review your shop and send your login credentials once approved. Keep an eye on your inbox!
        </p>

        {shopId && (
          <p style={{ fontSize: 12, color: '#475569', marginBottom: 24 }}>
            Shop reference: <code style={{ fontFamily: 'monospace', color: '#94a3b8' }}>{shopId}</code>
          </p>
        )}

        <Link
          href="/"
          style={{ display: 'inline-block', background: '#e5332a', color: '#fff', padding: '12px 28px', borderRadius: 8, fontWeight: 600, textDecoration: 'none', fontSize: 15 }}
        >
          Go to Homepage
        </Link>
      </div>
    </div>
  );
}

export default function RegisterSuccessPage() {
  return (
    <Suspense fallback={null}>
      <SuccessContent />
    </Suspense>
  );
}
