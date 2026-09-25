'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useIsNative } from '@/context/NativeContext';
import { useIsMobile } from '@/hooks/useIsMobile';
import RoleTabBar from '@/components/RoleTabBar';
import { mobileNavForActor, type ShellRole } from '@/lib/mobileRoleNav';

interface MobileNavProps {
  role: ShellRole;
}

/**
 * Bottom tab bar used on phone-width screens and inside Capacitor.
 * Super Admin tabs render only for a superadmin. The tab list itself lives
 * in mobileRoleNav so MobileShell and this bar stay in lockstep.
 */
export default function MobileNav({ role }: MobileNavProps) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const isNative = useIsNative();
  if (!isMobile && !isNative) return null;

  const nav = mobileNavForActor(role, {
    role: user?.role,
    isSuperAdmin: user?.isSuperAdmin,
  });
  if (!nav) return null;
  return <RoleTabBar nav={nav} />;
}
