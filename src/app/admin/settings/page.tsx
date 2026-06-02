'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminSettingsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/system-settings');
  }, [router]);
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#000000', color: '#e5e7eb' }}>
      <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}>Admin Settings Redirect</h1>
      Redirecting to system settings...
    </main>
  );
}
