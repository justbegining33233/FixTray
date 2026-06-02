'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';

export default function CustomerHome() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/customer/dashboard' as Route);
  }, [router]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
        background: '#000000'
    }}>
      <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}>Customer Home Redirect</h1>
      <div style={{ color: '#e5e7eb', fontSize: 18 }}>Redirecting to Customer Dashboard...</div>
    </div>
  );
}

