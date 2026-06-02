"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';

export default function SuperadminRootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/superadmin/analytics' as Route);
  }, [router]);

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#000000', color: '#e5e7eb' }}>
      <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}>Super Admin Redirect</h1>
      Redirecting to superadmin analytics...
    </main>
  );
}
