'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { useAuth } from '@/contexts/AuthContext';

/** Where each role goes to create a new work order */
const NEW_WORKORDER_BY_ROLE: Record<string, string> = {
  shop:       '/shop/new-inshop-job',
  tech:       '/shop/new-inshop-job',
  manager:    '/shop/new-inshop-job',
  customer:   '/customer/workorders',
  admin:      '/admin/home',
  superadmin: '/admin/home',
};

export default function WorkOrderNewRedirect() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/auth/login?redirect=%2Fworkorders%2Fnew' as Route);
      return;
    }
    const dest = NEW_WORKORDER_BY_ROLE[user.role] ?? '/auth/login';
    router.replace(dest as Route);
  }, [user, isLoading, router]);

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#000000', color: '#e5e7eb' }}>
      <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}>New Work Order Redirect</h1>
      Redirecting to create work order...
    </main>
  );
}
