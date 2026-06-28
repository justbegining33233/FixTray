'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRequireAuth } from '@/contexts/AuthContext';
import {
  FaBuilding, FaUsers, FaShieldAlt, FaServer, FaRocket,
  FaChartBar, FaExclamationTriangle, FaCheckCircle, FaClock,
  FaArrowRight,
} from 'react-icons/fa';

type Stats = {
  totalShops: number;
  totalUsers: number;
  activeWorkOrders: number;
  systemHealth: string;
};

export default function SuperAdminDashboard() {
  const { user, isLoading } = useRequireAuth(['superadmin']);
  const [stats, setStats] = useState<Stats>({ totalShops: 0, totalUsers: 0, activeWorkOrders: 0, systemHealth: 'healthy' });
  const [tenants, setTenants] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    if (isLoading || !user) return;

    const token = localStorage.getItem('token');
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

    Promise.all([
      fetch('/api/admin/tenants', { headers, credentials: 'include' }).then(r => r.ok ? r.json() : { tenants: [] }),
      fetch('/api/admin/users', { headers, credentials: 'include' }).then(r => r.ok ? r.json() : { users: [] }),
      fetch('/api/admin/activity-logs', { headers, credentials: 'include' }).then(r => r.ok ? r.json() : { logs: [] }),
    ]).then(([tenantData, userData, activityData]) => {
      const t = Array.isArray(tenantData) ? tenantData : tenantData?.tenants || [];
      const u = Array.isArray(userData) ? userData : userData?.users || [];
      const logs = Array.isArray(activityData) ? activityData : activityData?.logs || [];
      setTenants(t.slice(0, 5));
      setRecentActivity(logs.slice(0, 8));
      setStats({
        totalShops: t.length,
        totalUsers: u.length,
        activeWorkOrders: 0,
        systemHealth: 'healthy',
      });
    }).catch(() => {});

    fetch('/api/workorders', { headers, credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const wos = Array.isArray(data) ? data : data?.workOrders || [];
        setStats(s => ({ ...s, activeWorkOrders: wos.filter((w: any) => w.status !== 'completed' && w.status !== 'cancelled').length }));
      })
      .catch(() => {});
  }, [user, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" />
      </div>
    );
  }

  if (!user) return null;

  const statCards = [
    { label: 'Total Shops', value: stats.totalShops, icon: FaBuilding, color: 'bg-indigo-500', href: '/superadmin/tenants' },
    { label: 'Total Users', value: stats.totalUsers, icon: FaUsers, color: 'bg-blue-500', href: '/superadmin/users' },
    { label: 'Active Work Orders', value: stats.activeWorkOrders, icon: FaClock, color: 'bg-amber-500', href: '/superadmin/analytics' },
    { label: 'System Health', value: stats.systemHealth === 'healthy' ? 'Healthy' : 'Issues', icon: stats.systemHealth === 'healthy' ? FaCheckCircle : FaExclamationTriangle, color: stats.systemHealth === 'healthy' ? 'bg-green-500' : 'bg-red-500', href: '/superadmin/infrastructure' },
  ];

  const quickLinks = [
    { label: 'Tenants', icon: FaBuilding, href: '/superadmin/tenants', desc: 'Manage shops & tenants' },
    { label: 'Users', icon: FaUsers, href: '/superadmin/users', desc: 'All platform users' },
    { label: 'Security', icon: FaShieldAlt, href: '/superadmin/security', desc: 'Security & audit' },
    { label: 'Infrastructure', icon: FaServer, href: '/superadmin/infrastructure', desc: 'System health' },
    { label: 'Deployments', icon: FaRocket, href: '/superadmin/deployments', desc: 'Deploy history' },
    { label: 'Analytics', icon: FaChartBar, href: '/superadmin/analytics', desc: 'Platform analytics' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 pt-20 md:pt-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Super Admin Dashboard</h1>
          <p className="text-gray-500 mt-1">Platform overview &amp; system monitoring</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map(card => (
            <Link key={card.label} href={card.href as Route} className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className={`w-10 h-10 ${card.color} rounded-xl flex items-center justify-center mb-3`}>
                <card.icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="text-sm text-gray-500">{card.label}</p>
            </Link>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Recent Tenants</h2>
              <Link href={"/superadmin/tenants" as Route} className="text-indigo-600 text-sm hover:underline flex items-center gap-1">
                View all <FaArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {tenants.length === 0 ? (
              <p className="text-gray-400 text-sm py-8 text-center">No tenants found</p>
            ) : (
              <div className="space-y-3">
                {tenants.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div>
                      <p className="font-medium text-gray-900">{t.name || t.shopName || 'Unnamed'}</p>
                      <p className="text-sm text-gray-500">{t.ownerName || t.email || ''}</p>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
            {recentActivity.length === 0 ? (
              <p className="text-gray-400 text-sm py-8 text-center">No activity recorded</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((a: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                    <div>
                      <p className="text-gray-700">{a.action || a.message || 'Activity'}</p>
                      <p className="text-gray-400 text-xs">{a.timestamp ? new Date(a.timestamp).toLocaleString() : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Access</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {quickLinks.map(link => (
              <Link key={link.label} href={link.href as Route} className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all hover:scale-[1.02] text-center">
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <link.icon className="w-6 h-6 text-indigo-600" />
                </div>
                <p className="font-medium text-gray-900 text-sm">{link.label}</p>
                <p className="text-xs text-gray-400 mt-1">{link.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
