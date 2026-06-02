"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';

export default function ManagerAdminRootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/manager/admin/logs' as Route);
  }, [router]);

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#000000', color: '#e5e7eb' }}>
      <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}>Manager Admin Redirect</h1>
      Redirecting to manager admin logs...
    </main>
  );
}
