'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { useAuth } from '@/contexts/AuthContext';

export default function ManagerAdminSettingsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/auth/login?redirect=%2Fmanager%2Fadmin%2Fsettings' as Route);
      return;
    }
    // Redirect to the main manager settings page
    router.replace('/manager/settings' as Route);
  }, [user, isLoading, router]);

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#000000', color: '#e5e7eb' }}>
      <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}>Manager Settings Redirect</h1>
      Redirecting to manager settings...
    </main>
  );
}
