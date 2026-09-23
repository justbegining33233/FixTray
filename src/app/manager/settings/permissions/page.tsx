'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useState } from 'react';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import Breadcrumbs from '@/components/Breadcrumbs';
import TeamPermissionsTable from '@/components/TeamPermissionsTable';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaLock } from 'react-icons/fa';

export default function ManagerPermissionsPage() {
  const say = usePhrase();
  const { user, isLoading } = useRequireAuth(['manager']);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>{say("Loading...")}</div>;
  if (!user) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#000000' }}>
      <Sidebar role="manager" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopNavBar onMenuToggle={() => setSidebarOpen((open) => !open)} showMenuButton />
        <main style={{ flex: 1, padding: 24, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
          <Breadcrumbs />
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', margin: '16px 0 8px' }}><FaLock style={{ marginRight: 8 }} /> {say("Team Permissions")}</h1>
          <p style={{ color: '#9aa3b2', fontSize: 14, marginBottom: 24 }}>
            {say("Review and update what each team member can access.")}{' '}</p>
          <TeamPermissionsTable />
        </main>
      </div>
    </div>
  );
}
