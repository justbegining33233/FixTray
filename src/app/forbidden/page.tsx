'use client';

import { usePhrase } from '@/lib/usePhrase';
import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ROLE_HOME } from '@/lib/roleConfig';

function ForbiddenInner() {
  const say = usePhrase();
  const params = useSearchParams();
  const from = params.get('from') || '';
  const role = typeof window !== 'undefined' ? localStorage.getItem('userRole') : '';
  const home = ROLE_HOME[role || ''] || '/auth/login';

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#000', color: '#e5e7eb', padding: 24 }}>
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        <div style={{ fontSize: 48, fontWeight: 800, color: '#e5332a', marginBottom: 8 }}>403</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>{say("Forbidden")}</h1>
        <p style={{ color: '#9aa3b2', lineHeight: 1.6, marginBottom: 24 }}>
          {say("That page is not available for your account")}{from ? ` (${from})` : ''}.
        </p>
        <Link
          href={home as any}
          style={{ display: 'inline-block', padding: '12px 24px', background: '#e5332a', color: 'white', borderRadius: 8, fontWeight: 700, textDecoration: 'none' }}
        >
          {say("Go to your home")}{' '}</Link>
      </div>
    </main>
  );
}

export default function ForbiddenPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#000' }} />}>
      <ForbiddenInner />
    </Suspense>
  );
}
