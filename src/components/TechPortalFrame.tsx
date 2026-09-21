'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import TopNavBar from '@/components/TopNavBar';

/** Tech sidebar and top bar around shared job-intake forms (VIS-066 / VIS-083). */
export default function TechPortalFrame({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#000000' }}>
      <Sidebar role="tech" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopNavBar onMenuToggle={() => setSidebarOpen((open) => !open)} showMenuButton />
        <div style={{ flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}
