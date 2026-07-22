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
  activityStatus?: 'active' | 'inactive';
  hasActiveSession?: boolean;
  createdAt?: string;
  lastLogin?: string;
  shopName?: string;
};

const ROLE_BADGES: Record<string, { bg: string; text: string; icon: any }> = {
  admin: { bg: 'bg-orange-50', text: 'text-orange-600', icon: FaUserShield },
  superadmin: { bg: 'bg-indigo-50', text: 'text-indigo-600', icon: FaUserShield },
  shop: { bg: 'bg-green-50', text: 'text-green-600', icon: FaStore },
  tech: { bg: 'bg-[#e5332a]/10', text: 'text-[#ff6b64]', icon: FaWrench },
  technician: { bg: 'bg-[#e5332a]/10', text: 'text-[#ff6b64]', icon: FaWrench },
  manager: { bg: 'bg-purple-50', text: 'text-purple-600', icon: FaUserTie },
  customer: { bg: 'bg-zinc-800', text: 'text-zinc-300', icon: FaUser },
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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#e5332a]" />
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
    <div className="min-h-screen bg-black p-4 md:p-8 pt-20 md:pt-8 text-white">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href={"/superadmin/analytics" as Route} className="p-2 hover:bg-white/5 rounded-lg">
            <FaArrowLeft className="w-4 h-4 text-zinc-400" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-white">User Management</h1>
            <p className="text-zinc-400 mt-1">{users.length} total users</p>
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
                  filterRole === role ? 'bg-[#e5332a] text-white' : `${badge.bg} ${badge.text}`
                }`}
              >
                {role}: {count}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#000000] border border-[#1f2937] rounded-xl focus:ring-2 focus:ring-[#e5332a] focus:border-transparent text-white"
          />
        </div>

        {/* Users Table */}
        <div className="bg-[#000000] rounded-2xl shadow-sm overflow-hidden border border-[#1f2937]">
          <table className="w-full">
            <thead className="bg-[#000000]">
              <tr>
                <th className="text-left px-5 py-3 text-sm font-medium text-zinc-400">User</th>
                <th className="text-left px-5 py-3 text-sm font-medium text-zinc-400">Role</th>
                <th className="text-left px-5 py-3 text-sm font-medium text-zinc-400">Activity</th>
                <th className="text-left px-5 py-3 text-sm font-medium text-zinc-400">Last Login</th>
                <th className="text-left px-5 py-3 text-sm font-medium text-zinc-400">Shop</th>
                <th className="text-left px-5 py-3 text-sm font-medium text-zinc-400">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-zinc-400">No users found</td>
                </tr>
              ) : (
                filtered.map(u => {
                  const badge = ROLE_BADGES[u.role] || ROLE_BADGES.customer;
                  const RoleIcon = badge.icon;
                  return (
                    <tr key={u.id} className="hover:bg-white/5">
                      <td className="px-5 py-3">
                        <div>
                          <p className="font-medium text-white">{u.name || '—'}</p>
                          <p className="text-xs text-zinc-400">{u.email}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${badge.bg} ${badge.text}`}>
                          <RoleIcon className="w-3 h-3" /> {u.role}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {(() => {
                          const activity = u.activityStatus || 'inactive';
                          const active = activity === 'active';
                          return (
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${active ? 'bg-green-50 text-green-600' : 'bg-slate-700 text-slate-300'}`}>
                              {active ? 'Active' : 'Inactive'}{u.hasActiveSession ? ' (session)' : ''}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-5 py-3 text-sm text-zinc-300">{u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never'}</td>
                      <td className="px-5 py-3 text-sm text-zinc-300">{u.shopName || '—'}</td>
                      <td className="px-5 py-3 text-sm text-zinc-400">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
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
