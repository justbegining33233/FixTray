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

export default function TechLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const isMobile = useIsMobile();
  const isNative = useIsNative();
  const { user } = useAuth();
  const isDesktopMode = !(isNative || isMobile);

  if ((isNative || isMobile) && pathname !== '/tech/home') {
    return (
      <MobileShell
        role="tech"
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
