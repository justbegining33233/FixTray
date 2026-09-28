'use client';

import { usePhrase } from '@/lib/usePhrase';
import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useIsNative } from '@/context/NativeContext';
import MobileShell from '@/components/MobileShell';
import { shellRoleForActor } from '@/lib/mobileRoleNav';
import { ROLE_HOME } from '@/lib/roleConfig';

function ForbiddenInner() {
  const say = usePhrase();
  const params = useSearchParams();
  const from = params.get('from') || '';
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const isNative = useIsNative();
  const role = user?.role || '';
  const home = ROLE_HOME[role] || '/auth/login';
  const shellRole = shellRoleForActor({
    role: user?.role || role,
    isSuperAdmin: user?.isSuperAdmin,
    isOwner: user?.isOwner,
  });

  const body = (
    <main style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', background: '#000', color: '#e5e7eb', padding: 24 }}>
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        <div style={{ fontSize: 48, fontWeight: 800, color: '#e5332a', marginBottom: 8 }}>403</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>{say("Forbidden")}</h1>
        <p style={{ color: '#9aa3b2', lineHeight: 1.6, marginBottom: 24 }}>
          {say("That page is not available for your account")}{from ? ` (${from})` : ''}.
        </p>
        <Link
          href={home as never}
          data-forbidden-home="1"
          style={{ display: 'inline-block', padding: '12px 24px', background: '#e5332a', color: 'white', borderRadius: 8, fontWeight: 700, textDecoration: 'none' }}
        >
          {say("Go to your home")}{' '}</Link>
      </div>
    </main>
  );

  if ((isNative || isMobile) && shellRole) {
    const roleForShell = shellRole === 'superadmin' ? 'admin' : shellRole;
    return (
      <MobileShell role={roleForShell} userName={user?.name} sectionTitle="Forbidden">
        {body}
      </MobileShell>
    );
  }

  return body;
}

export default function ForbiddenPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#000' }} />}>
      <ForbiddenInner />
    </Suspense>
  );
}
