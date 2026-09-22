'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Route } from 'next';
import { shopRestrictedDestination } from '@/lib/shopRestrictedRoutes';

export default function ShopRestrictedRedirect({ fallback }: { fallback: string }) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const destination = shopRestrictedDestination(pathname) || fallback;

  useEffect(() => {
    router.replace(destination as Route);
  }, [destination, router]);

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#000', color: '#e5e7eb' }}>
      Opening the right page…
    </main>
  );
}
