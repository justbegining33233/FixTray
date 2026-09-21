'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { FaPlus, FaRoad } from 'react-icons/fa';
import { useAuth } from '@/contexts/AuthContext';
import { portalDashboardHref, techJobCreateHref } from '@/lib/portalHome';

type RoadsideJob = {
  id: string;
  status?: string;
  vehicleType?: string;
  serviceLocation?: string;
  createdAt?: string;
  customer?: { firstName?: string; lastName?: string; phone?: string } | null;
  issueDescription?: { symptoms?: unknown } | string | null;
};

function jobSummary(job: RoadsideJob): string {
  const issue = job.issueDescription;
  if (typeof issue === 'string' && issue.trim()) return issue;
  if (issue && typeof issue === 'object') {
    const symptoms = (issue as { symptoms?: unknown }).symptoms;
    if (typeof symptoms === 'string' && symptoms.trim()) return symptoms;
  }
  return 'Roadside service';
}

function customerName(job: RoadsideJob): string {
  const first = job.customer?.firstName || '';
  const last = job.customer?.lastName || '';
  const name = `${first} ${last}`.trim();
  return name || 'Walk-in';
}

/**
 * VIS-002: /workorders/roadside is the roadside jobs queue.
 * Creating a job stays on the role-specific new-roadside-job form.
 */
export default function RoadsideJobsQueuePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<RoadsideJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/auth/login?redirect=%2Fworkorders%2Froadside' as Route);
      return;
    }
    if (user.role === 'customer') {
      router.replace('/customer/workorders' as Route);
      return;
    }
    if (user.role === 'admin' || user.role === 'superadmin') {
      router.replace('/admin/home' as Route);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoadingJobs(true);
      setLoadError('');
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/workorders?limit=100&serviceLocation=roadside', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: 'no-store',
        });
        if (!response.ok) {
          if (!cancelled) setLoadError('Could not load roadside jobs.');
          return;
        }
        const data = await response.json();
        if (!cancelled) setJobs(Array.isArray(data.workOrders) ? data.workOrders : []);
      } catch {
        if (!cancelled) setLoadError('Could not load roadside jobs.');
      } finally {
        if (!cancelled) setLoadingJobs(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user, isLoading, router]);

  if (isLoading || !user || user.role === 'customer' || user.role === 'admin' || user.role === 'superadmin') {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#000', color: '#e5e7eb' }}>
        Loading roadside jobs...
      </main>
    );
  }

  const newHref = techJobCreateHref('roadside', user.role) as Route;
  const homeHref = portalDashboardHref(user.role) as Route;

  return (
    <main style={{ minHeight: '100vh', background: '#000', color: '#e5e7eb', padding: '32px 20px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <Link href={homeHref} style={{ color: '#93c5fd', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
          Back to dashboard
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginTop: 16, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 8px' }}>
              <FaRoad style={{ marginRight: 8 }} />
              Roadside Jobs
            </h1>
            <p style={{ margin: 0, color: '#9aa3b2' }}>Open and recent roadside work orders for this shop.</p>
          </div>
          <Link
            href={newHref}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 16px',
              background: '#e5332a',
              color: '#fff',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 700,
            }}
          >
            <FaPlus /> New roadside job
          </Link>
        </div>

        {loadingJobs ? (
          <div style={{ padding: 32, border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 12, color: '#9aa3b2' }}>
            Loading roadside jobs...
          </div>
        ) : loadError ? (
          <div style={{ padding: 32, border: '1px solid rgba(239,68,68,0.4)', borderRadius: 12, color: '#fca5a5' }}>{loadError}</div>
        ) : jobs.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 12 }}>
            <p style={{ color: '#9aa3b2', marginBottom: 16 }}>No roadside jobs yet.</p>
            <Link href={newHref} style={{ color: '#fff', background: '#e5332a', padding: '10px 16px', borderRadius: 8, textDecoration: 'none', fontWeight: 700 }}>
              New roadside job
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {jobs.map((job) => (
              <Link
                key={job.id}
                href={`/workorders/${job.id}` as Route}
                style={{
                  display: 'block',
                  textDecoration: 'none',
                  color: 'inherit',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 700 }}>{jobSummary(job)}</div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase' }}>{job.status || 'pending'}</span>
                </div>
                <div style={{ marginTop: 6, color: '#9aa3b2', fontSize: 13 }}>
                  {customerName(job)}
                  {job.vehicleType ? ` · ${job.vehicleType}` : ''}
                  {job.createdAt ? ` · ${new Date(job.createdAt).toLocaleString()}` : ''}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
