"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';

export default function CustomerWorkordersRootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/customer/history' as Route);
  }, [router]);

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#000000', color: '#e5e7eb' }}>
      <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}>Customer Work Orders Redirect</h1>
      Redirecting to customer history...
    </main>
  );
}
