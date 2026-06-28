'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRequireAuth } from '@/contexts/AuthContext';
import {
  FaBuilding, FaSearch, FaCheckCircle,
  FaExclamationTriangle, FaArrowLeft,
} from 'react-icons/fa';

type Tenant = {
  id: string;
  name?: string;
  shopName?: string;
  ownerName?: string;
  email?: string;
  phone?: string;
  location?: string;
  totalJobs?: number;
  completedJobs?: number;
  totalRevenue?: number;
  teamMembers?: number;
  healthScore?: number;
  rating?: number;
  createdAt?: string;
};

export default function SuperAdminTenants() {
  const { user, isLoading } = useRequireAuth(['superadmin']);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoading || !user) return;
    const token = localStorage.getItem('token');
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    fetch('/api/admin/tenants', { headers, credentials: 'include' })
      .then(r => r.ok ? r.json() : { tenants: [] })
      .then(data => {
        const t = Array.isArray(data) ? data : data?.tenants || [];
        setTenants(t);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, isLoading]);

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" />
      </div>
    );
  }

  if (!user) return null;

  const filtered = tenants.filter(t => {
    const name = (t.name || t.shopName || '').toLowerCase();
    const owner = (t.ownerName || '').toLowerCase();
    return !search || name.includes(search.toLowerCase()) || owner.includes(search.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 pt-20 md:pt-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href={"/superadmin/dashboard" as Route} className="p-2 hover:bg-gray-100 rounded-lg">
            <FaArrowLeft className="w-4 h-4 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Tenant Management</h1>
            <p className="text-gray-500 mt-1">{tenants.length} registered shops</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input type="text" placeholder="Search shops or owners..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <FaBuilding className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">{search ? 'No matching tenants found' : 'No tenants registered yet'}</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(t => (
              <div key={t.id} className="bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                      <FaBuilding className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{t.name || t.shopName || 'Unnamed Shop'}</p>
                      <p className="text-sm text-gray-500">{t.ownerName || t.email || ''}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium bg-gray-100 text-gray-500`}>
                    Active
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center py-3 border-t border-gray-100">
                  <div><p className="text-lg font-bold text-gray-900">{t.totalJobs ?? 0}</p><p className="text-xs text-gray-400">Jobs</p></div>
                  <div><p className="text-lg font-bold text-gray-900">{t.teamMembers ?? 0}</p><p className="text-xs text-gray-400">Team</p></div>
                  <div><p className="text-lg font-bold text-gray-900">{t.rating ? t.rating.toFixed(1) : '\u2014'}</p><p className="text-xs text-gray-400">Rating</p></div>
                </div>
                {t.healthScore !== undefined && (
                  <div className="mt-3 flex items-center gap-2">
                    {t.healthScore >= 70 ? <FaCheckCircle className="w-4 h-4 text-green-500" /> : <FaExclamationTriangle className="w-4 h-4 text-amber-500" />}
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className={`h-2 rounded-full ${t.healthScore >= 70 ? 'bg-green-500' : t.healthScore >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${t.healthScore}%` }} />
                    </div>
                    <span className="text-xs text-gray-500">{t.healthScore}%</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
