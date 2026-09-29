"use client";

import { usePhrase } from '@/lib/usePhrase';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeRole } from '@/lib/roleNav';

export default function WorkordersRootPage() {
  const say = usePhrase();
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    const role = normalizeRole(user?.role);
    const dest = role === 'manager'
      ? '/manager/assignments'
      : role === 'tech'
        ? '/tech/jobs?view=active'
        : role === 'customer'
          ? '/customer/workorders'
          : role === 'admin' || role === 'superadmin'
            ? '/admin/home'
            : '/shop/jobs';
    router.replace(dest as Route);
  }, [router, user?.role]);

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#000000', color: '#e5e7eb' }}>
      <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}>{say("Work Orders Redirect")}</h1>
      {say("Redirecting to work orders...")}{' '}</main>
  );
}
