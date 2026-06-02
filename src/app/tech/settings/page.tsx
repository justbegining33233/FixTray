"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';

export default function TechSettingsRootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/tech/settings/two-factor' as Route);
  }, [router]);

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#000000', color: '#e5e7eb' }}>
      <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}>Technician Settings Redirect</h1>
      Redirecting to security settings...
    </main>
  );
}
