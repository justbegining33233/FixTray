'use client';

import { usePathname } from 'next/navigation';
import MobileShell from '@/components/MobileShell';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useIsNative } from '@/context/NativeContext';
import { useAuth } from '@/contexts/AuthContext';

function getTitle(pathname: string): string {
  const seg = pathname.split('/')[2] || '';
  return seg.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'FixTray';
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const isMobile = useIsMobile();
  const isNative = useIsNative();
  const { user } = useAuth();
  const isDesktopMode = !(isNative || isMobile);

  // /admin/home has its own MobileShell tile-grid home screen.
  // All other /admin/* pages are wrapped here so they get mobile shell chrome.
  if ((isNative || isMobile) && pathname !== '/admin/home') {
    return (
      <MobileShell
        role="admin"
        isHome={false}
        sectionTitle={getTitle(pathname)}
        userName={user?.name}
      >
        <div className={`role-route-shell ${isDesktopMode ? 'desktop-mode-shell' : ''}`}><div data-page-shell>{children}</div></div>
      </MobileShell>
    );
  }

  return <div className={`role-route-shell ${isDesktopMode ? 'desktop-mode-shell' : ''}`}><div data-page-shell>{children}</div></div>;
}
