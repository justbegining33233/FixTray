'use client';

import { useState, useEffect } from 'react';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import Breadcrumbs from '@/components/Breadcrumbs';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaChartBar, FaClipboardList, FaUsers } from 'react-icons/fa';

interface OverviewStats {
  activeJobs: number;
  unassigned: number;
  overdueJobs: number;
  completedToday: number;
  pendingQueue: number;
  teamMembers: number;
}

export default function ManagerOverviewPage() {
  const { user, isLoading } = useRequireAuth(['manager']);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const token = localStorage.getItem('token');
      try {
        const shopKey = (user as { shopId?: string }).shopId || '';
        const shopQuery = shopKey ? `?shopId=${encodeURIComponent(shopKey)}` : '';
        const [woRes, teamRes] = await Promise.all([
          fetch(`/api/shop/workorder-stats${shopQuery}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`/api/shop/team${shopQuery}`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const woData = woRes.ok ? await woRes.json() : {};
        const teamData = teamRes.ok ? await teamRes.json() : {};
        const statsPayload = woData.stats || {};
        const team = teamData.team || teamData.teamMembers || teamData.techs || [];
        setStats({
          activeJobs: statsPayload.openJobs ?? statsPayload.activeJobs ?? 0,
          unassigned: statsPayload.unassigned ?? statsPayload.pendingAssignments ?? 0,
          overdueJobs: statsPayload.overdueJobs ?? 0,
          completedToday: statsPayload.completedToday ?? 0,
          pendingQueue: statsPayload.pendingQueue ?? 0,
          teamMembers: Array.isArray(team) ? team.length : 0,
        });
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, [user]);

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  const cards = stats ? [
    { label: 'Active Jobs', value: stats.activeJobs, icon: <FaClipboardList />, color: '#e5332a' },
    { label: 'Awaiting Clock-In', value: stats.unassigned, icon: <FaClipboardList />, color: '#f59e0b' },
    { label: 'Pending Queue', value: stats.pendingQueue, icon: <FaClipboardList />, color: '#f59e0b' },
    { label: 'Overdue', value: stats.overdueJobs, icon: <FaClipboardList />, color: '#ef4444' },
    { label: 'Completed Today', value: stats.completedToday, icon: <FaClipboardList />, color: '#22c55e' },
    { label: 'Team Members', value: stats.teamMembers, icon: <FaUsers />, color: '#8b5cf6' },
  ] : [];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#000000' }}>
      <Sidebar role="manager" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopNavBar onMenuToggle={() => setSidebarOpen(o => !o)} showMenuButton />
        <main style={{ flex: 1, padding: 24, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
          <Breadcrumbs />
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', margin: '16px 0 24px' }}><FaChartBar style={{ marginRight: 8 }} />Shop Overview</h1>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#9aa3b2', padding: 40 }}>Loading...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
              {cards.map(c => (
                <div key={c.label} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 24 }}>
                  <div style={{ color: c.color, fontSize: 28, marginBottom: 8 }}>{c.icon}</div>
                  <div style={{ color: '#e5e7eb', fontSize: 32, fontWeight: 700 }}>{c.value}</div>
                  <div style={{ color: '#9aa3b2', fontSize: 14, marginTop: 4 }}>{c.label}</div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}


