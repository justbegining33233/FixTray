'use client';

import type { ReactNode } from 'react';
import { useRequireAuth } from '@/contexts/AuthContext';

/** Shop-owner only. Techs and managers are sent to their own home or Forbidden. */
export default function RequireShopOwner({ children }: { children: ReactNode }) {
  useRequireAuth(['shop']);
  return <>{children}</>;
}
