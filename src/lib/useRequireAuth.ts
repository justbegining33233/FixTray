'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_HOME } from '@/lib/roleConfig';

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
        // Redirect to the user's own section, not to login
        const home = ROLE_HOME[user.role] ?? '/auth/login';
        router.push(home as Route);
        return;
      }
    }
  }, [isAuthenticated, isLoading, user, allowedRoles, router]);

  return { user, isLoading };
}