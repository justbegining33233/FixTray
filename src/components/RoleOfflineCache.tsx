'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { cacheCurrentDocument } from '@/lib/offlinePageCache';

/** While online, keep a copy of the page this role is allowed to open. */
export default function RoleOfflineCache() {
  const { user, isLoading } = useAuth();
  const pathname = usePathname() || '';
  const search = useSearchParams();
  const searchKey = search?.toString() || '';

  useEffect(() => {
    if (isLoading) return;
    const controller = new AbortController();
    void cacheCurrentDocument(user?.role ?? null, user?.id ?? null, controller.signal);
    return () => controller.abort();
  }, [isLoading, user?.role, user?.id, pathname, searchKey]);

  return null;
}
