'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import MobileShell from '@/components/MobileShell';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useIsNative } from '@/context/NativeContext';
import { useAuth } from '@/contexts/AuthContext';
import { FaArrowLeft } from 'react-icons/fa';
import { managerShopRedirect, normalizeRole } from '@/lib/roleNav';
import { fetchShopAgreementAccepted } from '@/lib/fixtrayAgreement';

/** Derive a human-readable section title from the pathname */
function getTitle(pathname: string): string {
  // e.g. /shop/manage-team/123 → "Manage Team"
  const seg = pathname.split('/')[2] || '';
  return seg.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'FixTray';
}

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  const say = usePhrase();
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const isMobile = useIsMobile();
  const isNative = useIsNative();
  const { user, isLoading } = useAuth();
  const isDesktopMode = !(isNative || isMobile);
  const showBackToDashboard = false;
  const actorRole = normalizeRole(user?.role);
  const managerDest = !isLoading && actorRole === 'manager' ? managerShopRedirect(pathname, 'manager') : null;

  useEffect(() => {
    if (managerDest) router.replace(managerDest as Route);
  }, [managerDest, router]);

  useEffect(() => {
    if (!pathname.startsWith('/shop/')) return;
    // Home dashboard, settings, and complete-profile are always accessible
    if (
      pathname === '/shop/home' ||
      pathname.startsWith('/shop/settings') ||
      pathname === '/shop/complete-profile'
    ) return;
    // Only redirect authenticated users — don't interfere during auth loading
    if (!user) return;
    // Managers are sent to manager-owned pages, not the shop agreement gate.
    if (actorRole === 'manager') return;
    if (typeof window !== 'undefined' && localStorage.getItem('fixtrayAgreementAccepted') === 'true') return;

    let cancelled = false;
    (async () => {
      const accepted = await fetchShopAgreementAccepted();
      if (cancelled) return;
      // Unknown (failed fetch) must not hijack Orders and the rest of the shop.
      if (accepted === false) router.replace('/shop/settings?tab=general');
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, router, user, actorRole]);

  if (managerDest) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>
        {say('Loading...')}
      </div>
    );
  }

  // /shop/home has its own MobileShell with the full tile-grid home screen.
  // All other /shop/* pages are wrapped here so they get the mobile shell chrome.
  if ((isNative || isMobile) && pathname !== '/shop/home') {
    return (
      <MobileShell
        role={actorRole === 'manager' ? 'manager' : 'shop'}
        isHome={false}
        sectionTitle={getTitle(pathname)}
        userName={user?.name}
      >
        <div className={`role-route-shell ${isDesktopMode ? 'desktop-mode-shell' : ''}`}><div data-page-shell>{children}</div></div>
      </MobileShell>
    );
  }

  return (
    <>
      {showBackToDashboard && (
        <Link
          href="/shop/home"
          style={{
            position: 'fixed',
            left: 20,
            bottom: 20,
            zIndex: 1000,
            background: '#e5332a',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 999,
            padding: '10px 16px',
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: 13,
            boxShadow: '0 8px 22px rgba(0,0,0,0.28)',
          }}
        >
          <FaArrowLeft style={{ marginRight: 4 }} /> {say("Back to Dashboard")}{' '}</Link>
      )}
      <div className={`role-route-shell ${isDesktopMode ? 'desktop-mode-shell' : ''}`}><div data-page-shell>{children}</div></div>
    </>
  );
}
