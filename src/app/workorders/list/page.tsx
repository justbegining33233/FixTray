'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { useAuth } from '@/contexts/AuthContext';

/** Where each role's work order list lives */
const WORKORDER_LIST_BY_ROLE: Record<string, string> = {
  shop:       '/shop/admin',
  tech:       '/tech/home',
  manager:    '/manager/overview',
  customer:   '/customer/workorders',
  admin:      '/admin/home',
  superadmin: '/admin/home',
};

export default function WorkOrderListRedirect() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/auth/login?redirect=%2Fworkorders%2Flist' as Route);
      return;
    }
    const dest = WORKORDER_LIST_BY_ROLE[user.role] ?? '/auth/login';
    router.replace(dest as Route);
  }, [user, isLoading, router]);

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#000000', color: '#e5e7eb' }}>
      <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}>Work Order List Redirect</h1>
      Redirecting to your work order list...
    </main>
  );
}
