'use client';

import { useState } from 'react';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import Breadcrumbs from '@/components/Breadcrumbs';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaCog } from 'react-icons/fa';
import Link from 'next/link';
import type { Route } from 'next';

const settingsLinks = [
  { label: 'Permissions', href: '/manager/settings/permissions', description: 'Manage team permissions and access levels' },
  { label: 'Two-Factor Auth', href: '/manager/settings/two-factor', description: 'Set up two-factor authentication for extra security' },
];

export default function ManagerSettingsPage() {
  const { user, isLoading } = useRequireAuth(['manager']);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#000000' }}>
      <Sidebar role="manager" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopNavBar onMenuToggle={() => setSidebarOpen(o => !o)} showMenuButton />
        <main style={{ flex: 1, padding: 24, maxWidth: 900, margin: '0 auto', width: '100%' }}>
          <Breadcrumbs />
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', margin: '16px 0 24px' }}><FaCog style={{ marginRight: 8 }} />Settings</h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {settingsLinks.map(s => (
              <Link key={s.href} href={s.href as Route} style={{ textDecoration: 'none' }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 20, cursor: 'pointer', transition: 'border-color 0.2s' }}>
                  <h3 style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{s.label}</h3>
                  <p style={{ color: '#9aa3b2', fontSize: 14 }}>{s.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

