'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Route } from 'next';
import { useAuth } from '@/contexts/AuthContext';
import { platformOwnerRedirect } from '@/lib/platformOwnerScope';

/**
 * Client-side twin of the proxy rule: the platform owner is sent to the
 * platform home when a client navigation lands on a shop page.
 */
export default function PlatformOwnerScopeGuard() {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading || !user) return;
    const dest = platformOwnerRedirect(pathname, { role: user.role, isSuperAdmin: user.isSuperAdmin, isOwner: user.isOwner });
    if (dest && dest !== pathname) router.replace(dest as Route);
  }, [pathname, user, isLoading, router]);

  return null;
}
