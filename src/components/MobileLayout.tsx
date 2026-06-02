'use client';

import { useEffect, useState } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useIsNative } from '@/context/NativeContext';

interface MobileLayoutProps {
  children: React.ReactNode;
  role: 'customer' | 'shop' | 'tech' | 'manager';
  showSidebar?: boolean;
  sidebarContent?: React.ReactNode;
  topNavContent?: React.ReactNode;
}

export default function MobileLayout({
  children,
  role: _role,
  showSidebar = true,
  sidebarContent,
  topNavContent
}: MobileLayoutProps) {
  const isMobile = useIsMobile();
  const isNative = useIsNative();
  const [isCompactDesktop, setIsCompactDesktop] = useState(false);

  useEffect(() => {
    const updateCompactMode = () => {
      if (typeof window === 'undefined') return;
      setIsCompactDesktop(window.innerWidth <= 1200);
    };

    updateCompactMode();
    window.addEventListener('resize', updateCompactMode);
    return () => window.removeEventListener('resize', updateCompactMode);
  }, []);

  // On mobile, skip all desktop chrome (sidebar, top nav) — the section layout
  // already wraps content in MobileShell. Just render the page content directly.
  if (isNative || isMobile) return <>{children}</>;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'transparent',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Top Navigation */}
      {topNavContent}

      {/* Main Layout with Sidebar */}
      <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
        {/* Sidebar Space */}
        {showSidebar && sidebarContent}

        {/* Main Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div
            style={{
              maxWidth: isCompactDesktop ? 1200 : 1400,
              margin: '0 auto',
              padding: isCompactDesktop ? 14 : 32,
              width: '100%',
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}