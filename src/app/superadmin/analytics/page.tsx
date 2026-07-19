'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRequireAuth } from '@/contexts/AuthContext';
import {
  FaChartBar, FaArrowLeft, FaUsers, FaBuilding, FaClipboardList,
  FaDollarSign, FaArrowUp, FaShieldAlt, FaServer, FaCog, FaRocket,
} from 'react-icons/fa';

type Analytics = {
  totalUsers: number;
  totalShops: number;
  totalWorkOrders: number;
  completedWorkOrders: number;
  totalRevenue: number;
  avgCompletionRate: number;
};

export default function SuperAdminAnalytics() {
  const { user, isLoading } = useRequireAuth(['admin', 'superadmin']);
  const [analytics, setAnalytics] = useState<Analytics>({
    totalUsers: 0,
    totalShops: 0,
    totalWorkOrders: 0,
    completedWorkOrders: 0,
    totalRevenue: 0,
    avgCompletionRate: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

    const [userData, analyticsData] = await Promise.all([
      fetch('/api/admin/users', { headers, credentials: 'include' }).then(r => r.ok ? r.json() : { users: [] }),
      fetch('/api/admin/analytics', { headers, credentials: 'include' }).then(r => r.ok ? r.json() : null),
    ]);

    const users = Array.isArray(userData) ? userData : userData?.users || [];
    const totalUsers = typeof userData?.liveMetrics?.totalUsers === 'number' ? userData.liveMetrics.totalUsers : users.length;
    const totalShops = analyticsData?.totalShops || 0;
    const totalWorkOrders = analyticsData?.totalWorkOrders || 0;
    const completedWorkOrders = analyticsData?.completedWorkOrders || 0;
    const avgCompletionRate = totalWorkOrders > 0 ? Math.round((completedWorkOrders / totalWorkOrders) * 100) : 0;

    setAnalytics({
      totalUsers,
      totalShops,
      totalWorkOrders,
      completedWorkOrders,
      totalRevenue: analyticsData?.totalRevenue || 0,
      avgCompletionRate,
    });
  };

  useEffect(() => {
    if (isLoading || !user) return;
    fetchAnalytics()
      .catch(() => {})
      .finally(() => setLoading(false));

    const refresh = setInterval(() => {
      fetchAnalytics().catch(() => {});
    }, 60 * 1000);

    return () => clearInterval(refresh);
  }, [user, isLoading]);

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" />
      </div>
    );
  }

  if (!user) return null;

  const cards = [
    { label: 'Total Users', value: analytics.totalUsers, icon: FaUsers, color: 'bg-[#e5332a]', trend: null },
    { label: 'Total Shops', value: analytics.totalShops, icon: FaBuilding, color: 'bg-indigo-500', trend: null },
    { label: 'Work Orders', value: analytics.totalWorkOrders, icon: FaClipboardList, color: 'bg-green-500', trend: null },
    { label: 'Revenue', value: `$${analytics.totalRevenue.toLocaleString()}`, icon: FaDollarSign, color: 'bg-amber-500', trend: null },
  ];

  return (
    <div className="min-h-screen p-4 md:p-8 pt-20 md:pt-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href={"/admin/home" as Route} className="p-2 hover:bg-[rgba(255,255,255,0.08)] rounded-lg">
            <FaArrowLeft className="w-4 h-4 text-[#94a3b8]" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-white">Platform Analytics</h1>
            <p className="text-[#94a3b8] mt-1">Platform-wide metrics &amp; insights</p>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {cards.map(card => (
            <div key={card.label} className="rounded-2xl p-5" style={{background:"rgba(10,16,32,0.68)",border:"1px solid rgba(255,255,255,0.08)"}}>
              <div className={`w-10 h-10 ${card.color} rounded-xl flex items-center justify-center mb-3`}>
                <card.icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-2xl font-bold text-white">{card.value}</p>
              <p className="text-sm text-[#94a3b8]">{card.label}</p>
            </div>
          ))}
        </div>

        {/* Completion Rate */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="rounded-2xl p-6" style={{background:"rgba(10,16,32,0.68)",border:"1px solid rgba(255,255,255,0.08)"}}>
            <h3 className="text-lg font-semibold text-white mb-4">Completion Rate</h3>
            <div className="flex items-center gap-4">
              <div className="relative w-24 h-24">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                  <circle
                    cx="50" cy="50" r="40" fill="none"
                    stroke="#6366f1" strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={`${analytics.avgCompletionRate * 2.51} 251`}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-white">
                  {analytics.avgCompletionRate}%
                </span>
              </div>
              <div>
                <p className="text-sm text-[#94a3b8]">
                  {analytics.completedWorkOrders} of {analytics.totalWorkOrders} work orders completed
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl p-6" style={{background:"rgba(10,16,32,0.68)",border:"1px solid rgba(255,255,255,0.08)"}}>
            <h3 className="text-lg font-semibold text-white mb-4">Work Order Breakdown</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-[#94a3b8]">Completed</span>
                <span className="text-sm font-semibold text-green-600 flex items-center gap-1">
                  <FaArrowUp className="w-3 h-3" /> {analytics.completedWorkOrders}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-[#94a3b8]">Active</span>
                <span className="text-sm font-semibold text-[#ff6b64]">
                  {analytics.totalWorkOrders - analytics.completedWorkOrders}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-[#94a3b8]">Total</span>
                <span className="text-sm font-semibold text-[#f1f5f9]">{analytics.totalWorkOrders}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Deep Links */}
        <div className="grid md:grid-cols-2 gap-4">
          <Link href={"/superadmin/users" as Route} className="rounded-2xl p-5 transition-shadow flex items-center gap-4" style={{background:"rgba(10,16,32,0.68)",border:"1px solid rgba(255,255,255,0.08)"}}>
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
              <FaChartBar className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <p className="font-semibold text-[#f1f5f9]">User Management</p>
              <p className="text-sm text-[#94a3b8]">Inspect account activity and role distribution</p>
            </div>
          </Link>
          <Link href={"/superadmin/infrastructure" as Route} className="rounded-2xl p-5 transition-shadow flex items-center gap-4" style={{background:"rgba(10,16,32,0.68)",border:"1px solid rgba(255,255,255,0.08)"}}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{background:"rgba(245,158,11,0.15)"}}>
              <FaDollarSign className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <p className="font-semibold text-[#f1f5f9]">Infrastructure</p>
              <p className="text-sm text-[#94a3b8]">Runtime health and environment readiness</p>
            </div>
          </Link>
        </div>

        {/* Super Admin Navigation */}
        <div className="mt-8 rounded-2xl p-6" style={{background:"rgba(10,16,32,0.68)",border:"1px solid rgba(255,255,255,0.08)"}}>
          <h2 className="text-lg font-semibold text-white mb-4">Super Admin Controls</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Link href={"/superadmin/users" as Route} className="rounded-xl p-4 border border-white/10 hover:bg-white/5 transition-colors">
              <p className="font-medium text-white flex items-center gap-2"><FaUsers className="w-4 h-4 text-[#ff6b64]" /> Users</p>
              <p className="text-sm text-[#94a3b8] mt-1">Platform-wide user visibility</p>
            </Link>
            <Link href={"/admin/accepted-shops" as Route} className="rounded-xl p-4 border border-white/10 hover:bg-white/5 transition-colors">
              <p className="font-medium text-white flex items-center gap-2"><FaBuilding className="w-4 h-4 text-indigo-400" /> Shops</p>
              <p className="text-sm text-[#94a3b8] mt-1">Approved shops and profile readiness</p>
            </Link>
            <Link href={"/superadmin/security" as Route} className="rounded-xl p-4 border border-white/10 hover:bg-white/5 transition-colors">
              <p className="font-medium text-white flex items-center gap-2"><FaShieldAlt className="w-4 h-4 text-emerald-400" /> Security</p>
              <p className="text-sm text-[#94a3b8] mt-1">Audit and protection posture</p>
            </Link>
            <Link href={"/superadmin/infrastructure" as Route} className="rounded-xl p-4 border border-white/10 hover:bg-white/5 transition-colors">
              <p className="font-medium text-white flex items-center gap-2"><FaServer className="w-4 h-4 text-amber-400" /> Infrastructure</p>
              <p className="text-sm text-[#94a3b8] mt-1">Live runtime and environment checks</p>
            </Link>
            <Link href={"/superadmin/settings" as Route} className="rounded-xl p-4 border border-white/10 hover:bg-white/5 transition-colors">
              <p className="font-medium text-white flex items-center gap-2"><FaCog className="w-4 h-4 text-sky-400" /> Settings</p>
              <p className="text-sm text-[#94a3b8] mt-1">Global platform configuration</p>
            </Link>
            <Link href={"/superadmin/deployments" as Route} className="rounded-xl p-4 border border-white/10 hover:bg-white/5 transition-colors">
              <p className="font-medium text-white flex items-center gap-2"><FaRocket className="w-4 h-4 text-violet-400" /> Deployments</p>
              <p className="text-sm text-[#94a3b8] mt-1">Release timeline and history</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
