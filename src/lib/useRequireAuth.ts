'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { useAuth } from '@/contexts/AuthContext';

export default function useRequireAuth(allowedRoles?: string[]) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        const target = typeof window !== 'undefined'
          ? `${window.location.pathname}${window.location.search}`
          : '/';
        router.push(`/auth/login?redirect=${encodeURIComponent(target)}` as any);
        return;
      }

      if (allowedRoles && user && !allowedRoles.includes(user.role)) {
        const from = typeof window !== 'undefined' ? window.location.pathname : '/';
        router.replace(`/forbidden?from=${encodeURIComponent(from)}` as Route);
        return;
      }
    }
  }, [isAuthenticated, isLoading, user, allowedRoles, router]);

  return { user, isLoading };
}