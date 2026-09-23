'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Route } from 'next';
import { shopRestrictedDestination } from '@/lib/shopRestrictedRoutes';

export default function ShopRestrictedRedirect({ fallback }: { fallback: string }) {
  const say = usePhrase();
  const pathname = usePathname() || '';
  const router = useRouter();
  const destination = shopRestrictedDestination(pathname) || fallback;

  useEffect(() => {
    router.replace(destination as Route);
  }, [destination, router]);

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#000', color: '#e5e7eb' }}>
      {say("Opening the right page…")}{' '}</main>
  );
}
