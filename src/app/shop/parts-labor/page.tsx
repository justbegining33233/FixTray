'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';

export default function PartsLaborRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/shop/services' as Route);
  }, [router]);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'transparent',
        color: '#e5e7eb',
      }}
    >
      Redirecting to Service Catalog...
    </main>
  );
}
