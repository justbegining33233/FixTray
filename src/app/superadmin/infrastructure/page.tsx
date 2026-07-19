'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRequireAuth } from '@/contexts/AuthContext';
import {
  FaArrowLeft, FaDatabase, FaMemory, FaMicrochip,
  FaCheckCircle, FaExclamationTriangle, FaSyncAlt,
} from 'react-icons/fa';

type RuntimeHealth = {
  status?: string;
  timestamp?: number;
  uptimeSeconds?: number;
  memory?: {
    rssMb?: number;
    heapUsedMb?: number;
  };
};

type EnvHealth = {
  checks?: Array<{
    name: string;
    category: string;
    status: 'ok' | 'missing' | 'warning';
    hint: string;
  }>;
  summary?: {
    total: number;
    ok: number;
    missing: number;
    warning: number;
  };
};

export default function SuperAdminInfrastructure() {
  const { user, isLoading } = useRequireAuth(['admin', 'superadmin']);
  const [runtimeHealth, setRuntimeHealth] = useState<RuntimeHealth | null>(null);
  const [envHealth, setEnvHealth] = useState<EnvHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      const [runtimeRes, envRes] = await Promise.all([
        fetch('/api/health', { credentials: 'include' }),
        fetch('/api/admin/health', { headers, credentials: 'include' }),
      ]);

      const runtimeData = runtimeRes.ok ? await runtimeRes.json() : null;
      const envData = envRes.ok ? await envRes.json() : null;

      setRuntimeHealth(runtimeData);
      setEnvHealth(envData);
      setLastCheck(new Date());
    } catch {
      setRuntimeHealth(null);
      setEnvHealth(null);
    } finally {
      setLoading(false);
    }
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
    if (!seconds) return '-';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '-';
    return `${bytes.toFixed(0)} MB`;
  };

  const runtimeOk = runtimeHealth?.status === 'ok';
  const missingChecks = envHealth?.summary?.missing ?? 0;
  const warningChecks = envHealth?.summary?.warning ?? 0;
  const envOk = missingChecks === 0;
  const systemOk = runtimeOk && envOk;

  return (
    <div className="min-h-screen p-4 md:p-8 pt-20 md:pt-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href={"/superadmin/analytics" as Route} className="p-2 hover:bg-[rgba(255,255,255,0.08)] rounded-lg">
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
        <div className={`rounded-2xl p-6 mb-8 ${systemOk ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-center gap-4">
            {systemOk ? (
              <FaCheckCircle className="w-8 h-8 text-green-500" />
            ) : (
              <FaExclamationTriangle className="w-8 h-8 text-red-500" />
            )}
            <div>
              <h2 className="text-xl font-bold text-white">
                {systemOk ? 'All Systems Operational' : 'System Issues Detected'}
              </h2>
              <p className="text-sm text-[#94a3b8]">
                Runtime: {runtimeOk ? 'OK' : 'Unavailable'} &bull; Uptime: {formatUptime(runtimeHealth?.uptimeSeconds)}
              </p>
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
              <h3 className="font-semibold text-[#f1f5f9]">Environment Checks</h3>
            </div>
            <p className={`text-sm font-medium ${envOk ? 'text-green-600' : 'text-red-600'}`}>
              {envOk ? 'No missing requirements' : `${missingChecks} required missing`}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {envHealth?.summary?.ok ?? 0} ok, {warningChecks} warnings
            </p>
          </div>
          <div className="rounded-2xl p-6" style={{background:"rgba(10,16,32,0.68)",border:"1px solid rgba(255,255,255,0.08)"}}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                <FaMemory className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="font-semibold text-[#f1f5f9]">Runtime Memory</h3>
            </div>
            <p className="text-sm text-gray-700">Heap: {formatBytes(runtimeHealth?.memory?.heapUsedMb)}</p>
            <p className="text-xs text-gray-400 mt-1">RSS: {formatBytes(runtimeHealth?.memory?.rssMb)}</p>
          </div>
          <div className="rounded-2xl p-6" style={{background:"rgba(10,16,32,0.68)",border:"1px solid rgba(255,255,255,0.08)"}}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                <FaMicrochip className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="font-semibold text-[#f1f5f9]">Runtime Status</h3>
            </div>
            <p className={`text-sm font-medium ${runtimeOk ? 'text-green-600' : 'text-red-600'}`}>
              {runtimeOk ? 'Healthy' : 'Unavailable'}
            </p>
            <p className="text-xs text-gray-400 mt-1">Last timestamp: {runtimeHealth?.timestamp ? new Date(runtimeHealth.timestamp).toLocaleString() : '-'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
