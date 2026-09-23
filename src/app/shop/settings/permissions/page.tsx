'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useState } from 'react';
import Link from 'next/link';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import TeamPermissionsTable from '@/components/TeamPermissionsTable';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft } from 'react-icons/fa';

export default function PermissionsPage() {
  const say = usePhrase();
  const { user, isLoading } = useRequireAuth(['shop']);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>{say("Loading...")}</div>;
  if (!user) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#000000' }}>
      <Sidebar role="shop" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopNavBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} showMenuButton />
        <main style={{ flex: 1, padding: '24px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
          <div style={{ marginBottom: 24 }}>
            <Link href="/shop/manage-team" style={{ color: '#ff6b64', textDecoration: 'none', fontSize: 14 }}><FaArrowLeft style={{marginRight:4}} /> {say("Manage Team")}</Link>
            <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 700, marginTop: 4 }}>{say("Team Permissions")}</h1>
            <p style={{ color: '#9ca3af', fontSize: 14 }}>{say("Control what each team member can access")}</p>
          </div>
          <TeamPermissionsTable />
        </main>
      </div>
    </div>
  );
}


