'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRequireAuth } from '@/contexts/AuthContext';
import {
  FaArrowLeft, FaDatabase, FaMemory, FaMicrochip,
  FaCheckCircle, FaExclamationTriangle, FaSyncAlt,
} from 'react-icons/fa';

type HealthData = {
  status?: string;
  uptime?: number;
  database?: { status: string; responseTime?: number };
  memory?: { usage: number; total: number; free: number };
  cpu?: { usage: number };
  version?: string;
};

export default function SuperAdminInfrastructure() {
  const { user, isLoading } = useRequireAuth(['admin', 'superadmin']);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const fetchHealth = () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    fetch('/api/admin/health', { headers, credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setHealth(data);
        setLastCheck(new Date());
      })
      .catch(() => setHealth(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isLoading || !user) return;
    fetchHealth();
  }, [user, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" />
      </div>
    );
  }

  if (!user) return null;

  const formatUptime = (seconds?: number) => {
    if (!seconds) return '';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '';
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  };

  const dbOk = health?.database?.status === 'connected' || health?.database?.status === 'ok';

  return (
    <div className="min-h-screen p-4 md:p-8 pt-20 md:pt-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href={"/admin/home" as Route} className="p-2 hover:bg-[rgba(255,255,255,0.08)] rounded-lg">
              <FaArrowLeft className="w-4 h-4 text-[#94a3b8]" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white">Infrastructure</h1>
              <p className="text-[#94a3b8] mt-1">System health &amp; resources</p>
            </div>
          </div>
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-xl hover:opacity-90 disabled:opacity-50 transition-colors text-sm font-medium" style={{background:"#e5332a"}}
          >
            <FaSyncAlt className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {lastCheck && (
          <p className="text-sm text-gray-400 mb-6">Last checked: {lastCheck.toLocaleTimeString()}</p>
        )}

        {/* Status Banner */}
        <div className={`rounded-2xl p-6 mb-8 ${health?.status === 'healthy' || health?.status === 'ok' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-center gap-4">
            {health?.status === 'healthy' || health?.status === 'ok' ? (
              <FaCheckCircle className="w-8 h-8 text-green-500" />
            ) : (
              <FaExclamationTriangle className="w-8 h-8 text-red-500" />
            )}
            <div>
              <h2 className="text-xl font-bold text-white">
                {health?.status === 'healthy' || health?.status === 'ok' ? 'All Systems Operational' : 'System Issues Detected'}
              </h2>
              <p className="text-sm text-[#94a3b8]">Version: {health?.version || 'unknown'} &bull; Uptime: {formatUptime(health?.uptime)}</p>
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="rounded-2xl p-6" style={{background:"rgba(10,16,32,0.68)",border:"1px solid rgba(255,255,255,0.08)"}}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-[#e5332a]/10 rounded-xl flex items-center justify-center">
                <FaDatabase className="w-5 h-5 text-[#ff6b64]" />
              </div>
              <h3 className="font-semibold text-[#f1f5f9]">Database</h3>
            </div>
            <p className={`text-sm font-medium ${dbOk ? 'text-green-600' : 'text-red-600'}`}>
              {dbOk ? 'Connected' : 'Disconnected'}
            </p>
            {health?.database?.responseTime && (
              <p className="text-xs text-gray-400 mt-1">{health.database.responseTime}ms response</p>
            )}
          </div>
          <div className="rounded-2xl p-6" style={{background:"rgba(10,16,32,0.68)",border:"1px solid rgba(255,255,255,0.08)"}}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                <FaMemory className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="font-semibold text-[#f1f5f9]">Memory</h3>
            </div>
            <p className="text-sm text-gray-700">{formatBytes(health?.memory?.usage)} / {formatBytes(health?.memory?.total)}</p>
            <p className="text-xs text-gray-400 mt-1">{formatBytes(health?.memory?.free)} free</p>
          </div>
          <div className="rounded-2xl p-6" style={{background:"rgba(10,16,32,0.68)",border:"1px solid rgba(255,255,255,0.08)"}}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                <FaMicrochip className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="font-semibold text-[#f1f5f9]">CPU</h3>
            </div>
            <p className="text-sm text-gray-700">{health?.cpu?.usage != null ? `${health.cpu.usage.toFixed(1)}%` : ''}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

