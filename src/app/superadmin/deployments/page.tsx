'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRequireAuth } from '@/contexts/AuthContext';
import {
  FaRocket, FaArrowLeft, FaCheckCircle, FaClock, FaTimesCircle,
  FaSyncAlt, FaCalendarAlt,
} from 'react-icons/fa';

type Deployment = {
  id: string;
  version: string;
  environment: 'Production';
  status: 'success' | 'failed' | 'in-progress' | 'pending';
  timestamp: string;
  duration?: string;
  deployer: string;
  source?: string;
};

export default function SuperAdminDeployments() {
  const { user, isLoading } = useRequireAuth(['admin', 'superadmin']);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [currentVersion, setCurrentVersion] = useState('unknown');
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDeployments = async () => {
    if (!user) return;

    setDataLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/deployments', {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        throw new Error(`Failed to load deployments (${res.status})`);
      }

      const payload = await res.json();
      setCurrentVersion(payload?.currentVersion || 'unknown');
      setDeployments(Array.isArray(payload?.deployments) ? payload.deployments : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load deployments';
      setError(message);
      setDeployments([]);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (isLoading || !user) return;
    fetchDeployments();
  }, [user, isLoading]);

  if (isLoading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#000000]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#e5332a]" />
      </div>
    );
  }

  if (!user) return null;

  const statusConfig: Record<string, { icon: any; color: string; bg: string }> = {
    'success': { icon: FaCheckCircle, color: 'text-green-400', bg: 'bg-green-500/10' },
    'failed': { icon: FaTimesCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
    'in-progress': { icon: FaSyncAlt, color: 'text-[#ff6b64]', bg: 'bg-[#e5332a]/10' },
    'pending': { icon: FaClock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  };

  return (
    <div className="min-h-screen p-4 md:p-8 pt-20 md:pt-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href={"/superadmin/analytics" as Route} className="p-2 hover:bg-[rgba(255,255,255,0.08)] rounded-lg">
            <FaArrowLeft className="w-4 h-4 text-[#94a3b8]" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-white">Deployments</h1>
            <p className="text-[#94a3b8] mt-1">Release history &amp; deployment status</p>
          </div>
          <button
            onClick={fetchDeployments}
            disabled={dataLoading}
            className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            style={{ background: '#e5332a' }}
          >
            <FaSyncAlt className={`w-3.5 h-3.5 ${dataLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Current Version */}
        <div className="bg-[#000000] border border-[#1f2937] rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-[#e5332a] rounded-2xl flex items-center justify-center">
              <FaRocket className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-sm text-[#ff6b64] font-medium">Current Version</p>
              <p className="text-2xl font-bold text-white">{currentVersion}</p>
              <p className="text-sm text-[#94a3b8]">FixTray Work Order Platform</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl p-4 mb-6 text-sm text-red-300 border border-red-500/30 bg-red-500/10">
            {error}
          </div>
        )}

        {/* Deployment History */}
        <div className="rounded-2xl p-6" style={{background:"rgba(10,16,32,0.68)",border:"1px solid rgba(255,255,255,0.08)"}}>
          <h2 className="text-lg font-semibold text-white mb-4">Deployment History</h2>
          {deployments.length === 0 ? (
            <p className="text-sm text-[#94a3b8]">No deployment history available yet.</p>
          ) : (
            <div className="space-y-4">
              {deployments.map(dep => {
              const sc = statusConfig[dep.status] || statusConfig.pending;
              const Icon = sc.icon;
              return (
                <div key={dep.id} className="flex items-center gap-4 p-4 rounded-xl" style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.06)'}}>
                  <div className={`w-10 h-10 ${sc.bg} rounded-xl flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${sc.color} ${dep.status === 'in-progress' ? 'animate-spin' : ''}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[#f1f5f9]">{dep.version}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.bg} ${sc.color}`}>
                        {dep.status}
                      </span>
                      <span className="text-xs text-[#64748b] bg-[rgba(255,255,255,0.06)] px-2 py-0.5 rounded-full">
                        {dep.environment}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-[#94a3b8] mt-1">
                      <span>by {dep.deployer}</span>
                      {dep.duration && (
                        <span className="flex items-center gap-1">
                          <FaClock className="w-3 h-3" /> {dep.duration}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <FaCalendarAlt className="w-3 h-3" /> {new Date(dep.timestamp).toLocaleDateString()}
                      </span>
                      {dep.source && <span>{dep.source}</span>}
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
