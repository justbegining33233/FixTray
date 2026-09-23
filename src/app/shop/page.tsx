"use client";

import { usePhrase } from '@/lib/usePhrase';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';

export default function ShopRootPage() {
  const say = usePhrase();
  const router = useRouter();

  useEffect(() => {
    router.replace('/shop/admin' as Route);
  }, [router]);

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#000000', color: '#e5e7eb' }}>
      <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}>{say("Shop Redirect")}</h1>
      {say("Redirecting to shop admin...")}{' '}</main>
  );
}
