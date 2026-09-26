'use client';

import type { ReactNode } from 'react';
import MobileShell from '@/components/MobileShell';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useIsNative } from '@/context/NativeContext';
import { shellRoleForActor } from '@/lib/mobileRoleNav';

export default function ReportsLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const isNative = useIsNative();
  const shellRole = shellRoleForActor({
    role: user?.role,
    isSuperAdmin: user?.isSuperAdmin,
    isOwner: user?.isOwner,
  });

  if ((isNative || isMobile) && shellRole) {
    const role = shellRole === 'superadmin' ? 'admin' : shellRole;
    return (
      <MobileShell role={role} userName={user?.name} sectionTitle="Reports">
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
