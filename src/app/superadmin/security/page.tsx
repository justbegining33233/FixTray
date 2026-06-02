'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRequireAuth } from '@/contexts/AuthContext';
import {
  FaShieldAlt, FaArrowLeft, FaLock, FaUserShield, FaKey,
  FaExclamationTriangle, FaCheckCircle, FaHistory,
} from 'react-icons/fa';

type AuditEntry = {
  id?: string;
  action: string;
  user?: string;
  userName?: string;
  ip?: string;
  timestamp?: string;
  createdAt?: string;
  details?: string;
};

export default function SuperAdminSecurity() {
  const { user, isLoading } = useRequireAuth(['admin', 'superadmin']);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoading || !user) return;
    const token = localStorage.getItem('token');
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    fetch('/api/admin/audit-logs', { headers, credentials: 'include' })
      .then(r => r.ok ? r.json() : { logs: [] })
      .then(data => {
        const logs = Array.isArray(data) ? data : data?.logs || [];
        setAuditLogs(logs.slice(0, 50));
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

  const securityCards = [
    {
      title: 'Authentication',
      icon: FaLock,
      desc: 'JWT tokens, session management, password policies',
      status: 'Active',
      ok: true,
    },
    {
      title: 'Access Control',
      icon: FaUserShield,
      desc: 'Role-based access, route protection, middleware',
      status: 'Enforced',
      ok: true,
    },
    {
      title: 'API Security',
      icon: FaKey,
      desc: 'Rate limiting, CSRF protection, input validation',
      status: 'Active',
      ok: true,
    },
    {
      title: 'Data Protection',
      icon: FaShieldAlt,
      desc: 'Encryption at rest, bcrypt password hashing',
      status: 'Active',
      ok: true,
    },
  ];

  return (
    <div className="min-h-screen p-4 md:p-8 pt-20 md:pt-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href={"/admin/home" as Route} className="p-2 hover:bg-[rgba(255,255,255,0.08)] rounded-lg">
            <FaArrowLeft className="w-4 h-4 text-[#94a3b8]" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-white">Security Center</h1>
            <p className="text-[#94a3b8] mt-1">Security posture &amp; audit logs</p>
          </div>
        </div>

        {/* Security Status */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {securityCards.map(card => (
            <div key={card.title} className="rounded-2xl p-5" style={{background:"rgba(10,16,32,0.68)",border:"1px solid rgba(255,255,255,0.08)"}}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:"rgba(99,102,241,0.15)"}}>
                  <card.icon className="w-5 h-5 text-[#ff6b64]" />
                </div>
                <h3 className="font-semibold text-[#f1f5f9]">{card.title}</h3>
              </div>
              <p className="text-sm text-gray-500 mb-3">{card.desc}</p>
              <div className="flex items-center gap-1.5">
                {card.ok ? (
                  <FaCheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <FaExclamationTriangle className="w-4 h-4 text-amber-500" />
                )}
                <span className={`text-sm font-medium ${card.ok ? 'text-green-600' : 'text-amber-600'}`}>{card.status}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Links */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <Link href={"/admin/security-settings" as Route} className="rounded-2xl p-5 transition-shadow flex items-center gap-4" style={{background:"rgba(10,16,32,0.68)",border:"1px solid rgba(255,255,255,0.08)"}}>
            <div className="w-12 h-12 bg-[#e5332a]/10 rounded-xl flex items-center justify-center">
              <FaLock className="w-6 h-6 text-[#ff6b64]" />
            </div>
            <div>
              <p className="font-semibold text-[#f1f5f9]">Security Settings</p>
              <p className="text-sm text-[#94a3b8]">Configure password policies, 2FA, session timeouts</p>
            </div>
          </Link>
          <Link href={"/admin/activity-logs" as Route} className="rounded-2xl p-5 transition-shadow flex items-center gap-4" style={{background:"rgba(10,16,32,0.68)",border:"1px solid rgba(255,255,255,0.08)"}}>
            <div className="w-12 h-12 bg-[#e5332a]/10 rounded-xl flex items-center justify-center">
              <FaHistory className="w-6 h-6 text-[#ff6b64]" />
            </div>
            <div>
              <p className="font-semibold text-[#f1f5f9]">Activity Logs</p>
              <p className="text-sm text-[#94a3b8]">Full searchable activity log with filters</p>
            </div>
          </Link>
        </div>

        {/* Audit Log */}
        <div className="rounded-2xl p-6" style={{background:"rgba(10,16,32,0.68)",border:"1px solid rgba(255,255,255,0.08)"}}>
          <div className="flex items-center gap-2 mb-4">
            <FaHistory className="w-5 h-5 text-[#ff6b64]" />
            <h2 className="text-lg font-semibold text-white">Recent Audit Logs</h2>
          </div>
          {auditLogs.length === 0 ? (
            <p className="text-gray-400 text-sm">No audit entries found</p>
          ) : (
            <div className="space-y-2">
              {auditLogs.map((e, i) => (
                <div key={e.id || i} className="flex items-start gap-3 p-3 rounded-xl text-sm" style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.06)'}}>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#f1f5f9]">{e.action}</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {e.userName || e.user || 'System'} {e.ip ? ` ${e.ip}` : ''}  {new Date(e.timestamp || e.createdAt || '').toLocaleString()}
                    </p>
                    {e.details && <p className="text-gray-400 text-xs mt-1">{e.details}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

