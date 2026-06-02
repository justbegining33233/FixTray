'use client';

import { useEffect } from 'react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
export default function OwnerQuickEditLegacyPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/owner?section=quick-edit' as Route);
  }, [router]);

  return (
    <div style={{ minHeight: '100vh', background: '#000000', color: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}>Owner Quick Edit Redirect</h1>
      Redirecting...
    </div>
  );
}

