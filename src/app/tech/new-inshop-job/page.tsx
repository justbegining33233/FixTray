'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { useAuth } from '@/contexts/AuthContext';

const DEST_BY_ROLE: Record<string, string> = {
  tech:       '/shop/new-inshop-job',
  shop:       '/shop/new-inshop-job',
  manager:    '/shop/new-inshop-job',
  customer:   '/customer/workorders',
  admin:      '/admin/home',
  superadmin: '/admin/home',
};

export default function TechNewInShopJobRedirect() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/auth/login?redirect=%2Ftech%2Fnew-inshop-job' as Route);
      return;
    }
    const dest = DEST_BY_ROLE[user.role] ?? '/auth/login';
    router.replace(dest as Route);
  }, [user, isLoading, router]);

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#000000', color: '#e5e7eb' }}>
      <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}>New In-Shop Job Redirect</h1>
      Redirecting to in-shop job form...
    </main>
  );
}
