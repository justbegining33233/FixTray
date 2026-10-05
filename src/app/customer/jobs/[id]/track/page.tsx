'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRequireAuth } from '@/contexts/AuthContext';

interface TrackView {
  workOrderId: string;
  status: string;
  paymentStanding: string;
  vehicle: string;
  services: string[];
  estimateUsd: number | null;
  invoiceUsd: number | null;
  feeUsd: number | null;
  notes: string[];
  timeline: Array<{ at: string; label: string }>;
  shopName: string;
}

function money(value: number | null): string {
  return value == null ? 'Not issued' : `$${value.toFixed(2)}`;
}

export default function CustomerJobTrackPage() {
  useRequireAuth(['customer']);
  const params = useParams<{ id: string }>();
  const id = params?.id || '';
  const [job, setJob] = useState<TrackView | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('token');
    fetch(`/api/customers/jobs/${id}/track`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError(body.error || 'Could not load this job.');
          return;
        }
        setJob(body);
      })
      .catch(() => setError('Could not load this job.'));
  }, [id]);

  return (
    <main style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e7eb', padding: 24, fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link href="/customer/appointments" style={{ color: '#9aa3b2' }}>Back to appointments</Link>
        <h1 style={{ marginBottom: 8 }}>Job track</h1>
        {error && <p style={{ color: '#fca5a5' }}>{error}</p>}
        {!job && !error && <p>Loading the job…</p>}
        {job && (
          <>
            <p>{job.shopName}</p>
            <p>Status: {job.status.replace(/-/g, ' ')}</p>
            <p>Vehicle: {job.vehicle}</p>
            <p>Services: {job.services.length ? job.services.join(', ') : 'None listed yet'}</p>
            <p>Estimate: {money(job.estimateUsd)}</p>
            <p>Invoice: {money(job.invoiceUsd)}</p>
            <p>FixTray fee: {job.feeUsd == null ? 'None on this job' : money(job.feeUsd)}</p>
            <p>Payment: {job.paymentStanding.replace(/-/g, ' ')}</p>
            {job.notes.length > 0 && (
              <section>
                <h2>Notes</h2>
                {job.notes.map((note) => <p key={note}>{note}</p>)}
              </section>
            )}
            <section>
              <h2>Where the job is</h2>
              {job.timeline.map((step) => (
                <p key={`${step.at}-${step.label}`}>
                  {step.at ? new Date(step.at).toLocaleString() : ''} — {step.label}
                </p>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
