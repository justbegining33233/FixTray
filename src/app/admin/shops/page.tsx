'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowRight, FaBuilding, FaChartLine, FaUsers, FaCheckCircle, FaClock, FaExclamationTriangle } from 'react-icons/fa';

interface Shop {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  status: string;
  activityStatus: 'active' | 'inactive';
  totalJobs: number;
  completedJobs: number;
  completionRate: number;
  totalRevenue: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  rating: number;
  techCount: number;
  activeTechs: number;
  lastLogin?: string;
}

interface ShopStats {
  totalShops: number;
  activeShops: number;
  inactiveShops: number;
  approvedShops: number;
  pendingShops: number;
  newShopsThisMonth: number;
  shopGrowth: number;
  totalPlatformRevenue: number;
  revenueThisMonth: number;
  revenueGrowth: number;
}

const statusStyles = {
  approved: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', text: 'Approved' },
  pending: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', text: 'Pending' },
  suspended: { bg: 'rgba(229,51,42,0.15)', color: '#e5332a', text: 'Suspended' },
};

const activityStyles = {
  active: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', icon: <FaCheckCircle /> },
  inactive: { bg: 'rgba(107,114,128,0.15)', color: '#9ca3af', icon: <FaClock /> },
};

export default function AdminShopsPage() {
  const { user, isLoading } = useRequireAuth(['admin', 'superadmin']);
  const router = useRouter();
  const [shops, setShops] = useState<Shop[]>([]);
  const [stats, setStats] = useState<ShopStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'revenue' | 'jobs' | 'rating' | 'activity'>('revenue');

  useEffect(() => {
    if (!user) return;
    loadShops();
  }, [user]);

  const loadShops = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/shops', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch shops');
      const data = await res.json();
      
      setShops(data.shops || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shops');
    } finally {
      setLoading(false);
    }
  };

  const filteredShops = shops.filter(shop => {
    if (filterStatus === 'all') return true;
    return shop.status === filterStatus;
  });

  const sortedShops = [...filteredShops].sort((a, b) => {
    switch (sortBy) {
      case 'revenue':
        return b.totalRevenue - a.totalRevenue;
      case 'jobs':
        return b.totalJobs - a.totalJobs;
      case 'rating':
        return b.rating - a.rating;
      case 'activity':
        return a.activityStatus === 'active' ? -1 : 1;
      default:
        return 0;
    }
  });

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#000000' }}>
      <Sidebar role="admin" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopNavBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} showMenuButton />
        <main style={{ flex: 1, padding: '24px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: '#e5e7eb', margin: '0 0 8px' }}>
              <FaBuilding style={{ marginRight: 12, verticalAlign: 'middle' }} />
              Shop Management
            </h1>
            <p style={{ color: '#9ca3af', margin: 0, fontSize: 14 }}>Monitor all shops on the platform</p>
          </div>

          {/* Stats Grid */}
          {stats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
              {[
                { label: 'Total Shops', value: stats.totalShops, color: '#3b82f6' },
                { label: 'Active', value: stats.activeShops, color: '#22c55e' },
                { label: 'Inactive', value: stats.inactiveShops, color: '#9ca3af' },
                { label: 'Pending', value: stats.pendingShops, color: '#f59e0b' },
                { label: 'Platform Revenue', value: `$${(stats.totalPlatformRevenue / 1000).toFixed(1)}K`, color: '#ec4899' },
                { label: 'Growth (This Month)', value: `${stats.shopGrowth > 0 ? '+' : ''}${stats.shopGrowth}%`, color: stats.shopGrowth > 0 ? '#22c55e' : '#e5332a' },
              ].map((stat, i) => (
                <div key={i} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 20 }}>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>{stat.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div style={{ background: 'rgba(229,51,42,0.15)', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 12, padding: 16, marginBottom: 24, color: '#fca5a5' }}>
              {error}
            </div>
          )}

          {/* Filters and Sort */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: 12, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Filter by Status</label>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(0,0,0,0.3)',
                  color: '#e5e7eb',
                  fontSize: 13,
                }}
              >
                <option value="all">All Statuses</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Sort by</label>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(0,0,0,0.3)',
                  color: '#e5e7eb',
                  fontSize: 13,
                }}
              >
                <option value="revenue">Revenue</option>
                <option value="jobs">Jobs Count</option>
                <option value="rating">Rating</option>
                <option value="activity">Activity Status</option>
              </select>
            </div>
          </div>

          {/* Shops Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading shops...</div>
          ) : sortedShops.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, background: 'rgba(0,0,0,0.3)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af' }}>
              No shops found
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>Shop Name</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>Activity</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>Jobs</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>Revenue</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>Rating</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedShops.map(shop => {
                    const statusStyle = statusStyles[shop.status as keyof typeof statusStyles] || statusStyles.approved;
                    const activityStyle = activityStyles[shop.activityStatus];
                    return (
                      <tr key={shop.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '16px', color: '#e5e7eb', fontWeight: 500 }}>
                          <div>{shop.name}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{shop.email}</div>
                        </td>
                        <td style={{ padding: '16px' }}>
                          <span style={{
                            background: statusStyle.bg,
                            color: statusStyle.color,
                            padding: '4px 10px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                          }}>
                            {statusStyle.text}
                          </span>
                        </td>
                        <td style={{ padding: '16px' }}>
                          <div style={{
                            background: activityStyle.bg,
                            color: activityStyle.color,
                            padding: '4px 10px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            width: 'fit-content',
                          }}>
                            {activityStyle.icon}
                            {shop.activityStatus === 'active' ? 'Active' : 'Inactive'}
                          </div>
                        </td>
                        <td style={{ padding: '16px', textAlign: 'center', color: '#e5e7eb' }}>
                          <div style={{ fontWeight: 600 }}>{shop.completedJobs}/{shop.totalJobs}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>{shop.completionRate}%</div>
                        </td>
                        <td style={{ padding: '16px', textAlign: 'center' }}>
                          <div style={{ fontWeight: 600, color: '#ec4899' }}>${(shop.totalRevenue / 1000).toFixed(1)}K</div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>Month: ${(shop.revenueThisMonth / 1000).toFixed(1)}K</div>
                        </td>
                        <td style={{ padding: '16px', textAlign: 'center', color: '#fbbf24', fontWeight: 600 }}>
                          {shop.rating.toFixed(1)} ⭐
                        </td>
                        <td style={{ padding: '16px', textAlign: 'center' }}>
                          <button
                            onClick={() => router.push(`/admin/shops/${shop.id}`)}
                            style={{
                              background: '#e5332a',
                              color: 'white',
                              border: 'none',
                              borderRadius: 6,
                              padding: '6px 12px',
                              cursor: 'pointer',
                              fontSize: 12,
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              margin: '0 auto',
                            }}
                          >
                            View <FaArrowRight />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
