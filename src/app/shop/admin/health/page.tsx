'use client';

import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import { useState } from 'react';

export default function HealthCheckPage() {
  useRequireAuth(['shop', 'admin', 'superadmin']);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div style={{ minHeight: '100vh', background: 'transparent' }}>
      <TopNavBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} showMenuButton />
      <Sidebar role="shop" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 42, fontWeight: 800, color: '#e5332a', marginBottom: 8 }}>403</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#e5e7eb', marginBottom: 12 }}>System health is restricted</h1>
        <p style={{ color: '#9aa3b2', lineHeight: 1.6, marginBottom: 24 }}>
          Environment and platform health details are available only to FixTray administrators.
          Shop accounts should not probe this surface.
        </p>
        <Link
          href="/shop/home"
          style={{ display: 'inline-block', padding: '12px 24px', background: '#e5332a', color: 'white', borderRadius: 8, fontWeight: 700, textDecoration: 'none' }}
        >
          Back to Shop Home
        </Link>
      </div>
    </div>
  );
}
