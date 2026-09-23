'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { useAuth } from '@/contexts/AuthContext';
import { actorSatisfiesRoles } from '@/lib/roleAccess';
import { roleDeniedRedirect } from '@/lib/roleNav';

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

      if (allowedRoles && user && !actorSatisfiesRoles({
        role: user.role,
        isOwner: user.isOwner,
        isSuperAdmin: user.isSuperAdmin,
      }, allowedRoles)) {
        const from = typeof window !== 'undefined' ? window.location.pathname : '/';
        router.replace(roleDeniedRedirect(from, user.role) as Route);
        return;
      }
    }
  }, [isAuthenticated, isLoading, user, allowedRoles, router]);

  return { user, isLoading };
}