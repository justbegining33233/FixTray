'use client';

import type { ReactNode } from 'react';
import MobileShell from '@/components/MobileShell';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useIsNative } from '@/context/NativeContext';
import { shellRoleForActor } from '@/lib/mobileRoleNav';

export default function WorkordersLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const isNative = useIsNative();
  const shellRole = shellRoleForActor({ role: user?.role, isSuperAdmin: user?.isSuperAdmin });

  if ((isNative || isMobile) && shellRole) {
    const role = shellRole === 'superadmin' ? 'admin' : shellRole;
    return (
      <MobileShell role={role} userName={user?.name}>
        <div className="role-route-shell">
          <div data-page-shell>{children}</div>
        </div>
      </MobileShell>
    );
  }

  return (
    <div className="role-route-shell desktop-mode-shell">
      <div data-page-shell>{children}</div>
    </div>
  );
}
