'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { FaClipboardList } from 'react-icons/fa';
import { useRequireAuth } from '@/contexts/AuthContext';
import { unwrapWorkOrders } from '@/lib/workOrderList';
import { issueSummary } from '@/lib/waitingRoomBoard';
import { billWithServiceFee, FIXTRAY_SERVICE_FEE_LABEL } from '@/lib/serviceFeeBill';
import Sidebar from '@/components/Sidebar';
import TopNavBar from '@/components/TopNavBar';
import Breadcrumbs from '@/components/Breadcrumbs';
import MobileLayout from '@/components/MobileLayout';

interface TechJob {
  id: string;
  status?: string;
  estimatedCost?: number | null;
  issueDescription?: unknown;
  customer?: { firstName?: string; lastName?: string } | null;
  estimateBill?: { subtotal: number; serviceFee: number; total: number };
}

const CLOSED = new Set(['closed', 'cancelled', 'completed']);

export default function TechEstimatesPage() {
  const { user, isLoading } = useRequireAuth(['tech']);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [jobs, setJobs] = useState<TechJob[]>([]);
  const [serviceFeeUsd, setServiceFeeUsd] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('token');
    fetch('/api/workorders?limit=100', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => {
        if (typeof data?.fixtrayServiceFee === 'number' && Number.isFinite(data.fixtrayServiceFee)) {
          setServiceFeeUsd(data.fixtrayServiceFee);
        }
        const open = unwrapWorkOrders(data).filter((wo) => !CLOSED.has(String(wo.status || ''))) as TechJob[];
        setJobs(open);
      })
      .catch(() => setError('Unable to load work orders for this shop.'))
      .finally(() => setLoading(false));
  }, [user]);

  if (isLoading) {
    return <div style={{ minHeight: '100vh', color: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
  }
  if (!user) return null;

  return (
    <MobileLayout
      role="tech"
      showSidebar
      sidebarContent={<Sidebar role="tech" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
      topNavContent={
        <>
          <TopNavBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} showMenuButton />
          <Breadcrumbs />
        </>
      }
    >
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', marginBottom: 4 }}>
          <FaClipboardList style={{ marginRight: 8 }} /> Estimates
        </h1>
        <p style={{ color: '#9aa3b2', fontSize: 14, margin: 0 }}>
          Open a job to add parts and labor on the work order, then submit the estimate. The customer accepts and signs before a work authorization exists.
        </p>
      </div>

      {loading ? <div style={{ color: '#e5e7eb' }}>Loading work orders...</div> : null}
      {error ? <div style={{ color: '#fca5a5' }}>{error}</div> : null}
      {!loading && !error && jobs.length === 0 ? (
        <div style={{ color: '#f59e0b' }}>No open work orders. New jobs from the command center show up here.</div>
      ) : null}

      <div style={{ display: 'grid', gap: 10 }}>
        {jobs.map((job) => {
          const name = [job.customer?.firstName, job.customer?.lastName].filter(Boolean).join(' ') || 'Customer';
          return (
            <Link
              key={job.id}
              href={`/workorders/${job.id}#line-items` as Route}
              style={{
                display: 'block',
                textDecoration: 'none',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12,
                padding: '14px 16px',
                color: '#e5e7eb',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <strong>WO-{job.id.slice(-8).toUpperCase()}</strong>
                <span style={{ color: '#9aa3b2', fontSize: 13 }}>{job.status}</span>
              </div>
              <div style={{ marginTop: 6 }}>{name}</div>
              <div style={{ marginTop: 4, color: '#9aa3b2', fontSize: 13 }}>{issueSummary(job.issueDescription) || 'Service'}</div>
              {(() => {
                const bill = job.estimateBill && Number.isFinite(job.estimateBill.total)
                  ? job.estimateBill
                  : (typeof job.estimatedCost === 'number' && job.estimatedCost > 0
                    ? billWithServiceFee(job.estimatedCost, serviceFeeUsd)
                    : null);
                if (!bill || bill.subtotal <= 0) {
                  return <div style={{ marginTop: 8, color: '#60a5fa', fontSize: 13, fontWeight: 700 }}>Add parts and labor</div>;
                }
                return (
                  <div style={{ marginTop: 8, fontSize: 13 }}>
                    <div style={{ color: '#22c55e', fontWeight: 700 }}>Estimate ${bill.total.toFixed(2)}</div>
                    {bill.serviceFee > 0 && (
                      <div style={{ color: '#9aa3b2', marginTop: 2 }}>{FIXTRAY_SERVICE_FEE_LABEL} ${bill.serviceFee.toFixed(2)}</div>
                    )}
                  </div>
                );
              })()}
            </Link>
          );
        })}
      </div>
    </MobileLayout>
  );
}
