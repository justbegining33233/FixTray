'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import MobileShell from '@/components/MobileShell';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useIsNative } from '@/context/NativeContext';
import { useAuth } from '@/contexts/AuthContext';
import { FaArrowLeft } from 'react-icons/fa';

/** Derive a human-readable section title from the pathname */
function getTitle(pathname: string): string {
  // e.g. /shop/manage-team/123 → "Manage Team"
  const seg = pathname.split('/')[2] || '';
  return seg.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'FixTray';
}

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const isMobile = useIsMobile();
  const isNative = useIsNative();
  const { user } = useAuth();
  const isDesktopMode = !(isNative || isMobile);
  const showBackToDashboard = pathname.startsWith('/shop/') && pathname !== '/shop/home';

  useEffect(() => {
    if (!pathname.startsWith('/shop/')) return;
    if (pathname.startsWith('/shop/settings') || pathname === '/shop/complete-profile') return;

    const agreementAccepted =
      typeof window !== 'undefined' && localStorage.getItem('fixtrayAgreementAccepted') === 'true';

    if (!agreementAccepted) {
      router.replace('/shop/settings?tab=general');
    }
  }, [pathname, router]);

  // /shop/home has its own MobileShell with the full tile-grid home screen.
  // All other /shop/* pages are wrapped here so they get the mobile shell chrome.
  if ((isNative || isMobile) && pathname !== '/shop/home') {
    return (
      <MobileShell
        role="shop"
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
          <FaArrowLeft style={{ marginRight: 4 }} /> Back to Dashboard
        </Link>
      )}
      <div className={`role-route-shell ${isDesktopMode ? 'desktop-mode-shell' : ''}`}><div data-page-shell>{children}</div></div>
    </>
  );
}
