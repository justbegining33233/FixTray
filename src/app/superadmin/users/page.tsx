'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRequireAuth } from '@/contexts/AuthContext';
import {
  FaSearch, FaArrowLeft, FaUserShield, FaStore,
  FaUser, FaWrench, FaUserTie,
} from 'react-icons/fa';

type PlatformUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status?: string;
  createdAt?: string;
  lastLogin?: string;
  shopName?: string;
};

const ROLE_BADGES: Record<string, { bg: string; text: string; icon: any }> = {
  admin: { bg: 'bg-[rgba(249,115,22,0.15)]', text: 'text-orange-400', icon: FaUserShield },
  superadmin: { bg: 'bg-[rgba(99,102,241,0.15)]', text: 'text-[#ff6b64]', icon: FaUserShield },
  shop: { bg: 'bg-[rgba(34,197,94,0.15)]', text: 'text-green-400', icon: FaStore },
  technician: { bg: 'bg-[rgba(229,51,42,0.15)]', text: 'text-[#ff6b64]', icon: FaWrench },
  manager: { bg: 'bg-[rgba(139,92,246,0.15)]', text: 'text-purple-400', icon: FaUserTie },
  customer: { bg: 'bg-[rgba(255,255,255,0.08)]', text: 'text-[#94a3b8]', icon: FaUser },
};

export default function SuperAdminUsers() {
  const { user, isLoading } = useRequireAuth(['admin', 'superadmin']);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoading || !user) return;
    const token = localStorage.getItem('token');
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    fetch('/api/admin/users', { headers, credentials: 'include' })
      .then(r => r.ok ? r.json() : { users: [] })
      .then(data => {
        const u = Array.isArray(data) ? data : data?.users || [];
        setUsers(u);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, isLoading]);

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" />
      </div>
    );
  }

  if (!user) return null;

  const filtered = users.filter(u => {
    const matchSearch = !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === 'all' || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const roleCounts = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen p-4 md:p-8 pt-20 md:pt-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href={"/admin/home" as Route} className="p-2 hover:bg-[rgba(255,255,255,0.08)] rounded-lg">
            <FaArrowLeft className="w-4 h-4 text-[#94a3b8]" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-white">User Management</h1>
            <p className="text-[#94a3b8] mt-1">{users.length} total users</p>
          </div>
        </div>

        {/* Role Summary */}
        <div className="flex flex-wrap gap-2 mb-6">
          {Object.entries(roleCounts).map(([role, count]) => {
            const badge = ROLE_BADGES[role] || ROLE_BADGES.customer;
            return (
              <button
                key={role}
                onClick={() => setFilterRole(filterRole === role ? 'all' : role)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filterRole === role ? 'bg-[#e5332a]/100 text-white' : `${badge.bg} ${badge.text}`
                }`}
              >
                {role}: {count}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl focus:ring-2 focus:ring-[#e5332a] focus:border-transparent text-[#f1f5f9]" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.14)"}}
          />
        </div>

        {/* Users Table */}
        <div className="rounded-2xl overflow-hidden" style={{background:'rgba(10,16,32,0.68)',border:'1px solid rgba(255,255,255,0.08)'}}>
          <table className="w-full">
            <thead className="border-b border-[rgba(255,255,255,0.08)]">
              <tr>
                <th className="text-left px-5 py-3 text-sm font-medium text-[#94a3b8]">User</th>
                <th className="text-left px-5 py-3 text-sm font-medium text-[#94a3b8]">Role</th>
                <th className="text-left px-5 py-3 text-sm font-medium text-[#94a3b8]">Shop</th>
                <th className="text-left px-5 py-3 text-sm font-medium text-[#94a3b8]">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.05)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-gray-400">No users found</td>
                </tr>
              ) : (
                filtered.map(u => {
                  const badge = ROLE_BADGES[u.role] || ROLE_BADGES.customer;
                  const RoleIcon = badge.icon;
                  return (
                    <tr key={u.id} className="hover:bg-[rgba(255,255,255,0.05)]">
                      <td className="px-5 py-3">
                        <div>
                          <p className="font-medium text-[#f1f5f9]">{u.name || ''}</p>
                          <p className="text-xs text-[#94a3b8]">{u.email}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${badge.bg} ${badge.text}`}>
                          <RoleIcon className="w-3 h-3" /> {u.role}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-[#94a3b8]">{u.shopName || ''}</td>
                      <td className="px-5 py-3 text-sm text-gray-400">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : ''}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

