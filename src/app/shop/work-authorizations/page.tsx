'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import useRequireAuth from '@/lib/useRequireAuth';
import { FaPencilAlt } from 'react-icons/fa';

interface WorkAuthorization {
  id: string;
  status: string;
  workSummary: string;
  estimateTotal?: number;
  signerName?: string;
  signedAt?: string;
  createdAt: string;
  workOrderId?: string;
}

export default function WorkAuthorizationsPage() {
  const { user, isLoading } = useRequireAuth(['shop']);
  const [auths, setAuths] = useState<WorkAuthorization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('token');
    fetch('/api/work-authorizations', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.json() : [])
      .then((rows) => setAuths(Array.isArray(rows) ? rows.filter((row) => row.status === 'signed') : []))
      .finally(() => setLoading(false));
  }, [user]);

  if (isLoading) return <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  return (
    <div className="centered-app-page" style={{ minHeight: '100vh', background: 'transparent', color: '#e5e7eb', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}><FaPencilAlt style={{ marginRight: 4 }} /> Work Authorizations</h1>
        <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: 14 }}>
          A work authorization appears here only after the customer accepts the estimate and signs. Submitting a quote does not create one. A denied quote closes with no authorization.
        </p>
      </div>

      <div style={{ padding: '24px 32px 0', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {[{ label: 'Signed', value: auths.length, icon: '' }].map((stat) => (
          <div key={stat.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 24px', minWidth: 120 }}>
            <div style={{ fontSize: 28, fontWeight: 800, margin: '4px 0' }}>{stat.value}</div>
            <div style={{ fontSize: 13, color: '#9ca3af' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '24px 32px' }}>
        {loading ? <div style={{ color: '#6b7280' }}>Loading...</div> :
          auths.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 80 }}>
              <div style={{ fontSize: 64 }}><FaPencilAlt /></div>
              <div style={{ fontSize: 18, fontWeight: 600, margin: '16px 0 8px' }}>No signed authorizations yet</div>
              <div style={{ color: '#9ca3af', maxWidth: 520, margin: '0 auto' }}>
                Send the estimate from the work order or Shop Estimates. The customer signs when they accept. There is no separate create step, and a quote waiting on the customer is not a pending authorization.
              </div>
            </div>
          ) : (
            <div>
              {auths.map((auth) => (
                <div key={auth.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 20px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 15 }}>
                        {auth.workOrderId ? (
                          <Link href={`/workorders/${auth.workOrderId}` as Route} style={{ color: '#e5e7eb' }}>
                            Work Order #{auth.workOrderId}
                          </Link>
                        ) : `Auth ${auth.id.slice(-6).toUpperCase()}`}
                      </div>
                      <div style={{ color: '#9ca3af', fontSize: 13, marginBottom: 6 }}>
                        {new Date(auth.createdAt).toLocaleDateString()} - {auth.workSummary.slice(0, 80)}{auth.workSummary.length > 80 ? '...' : ''}
                      </div>
                      {auth.estimateTotal ? <div style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b' }}>${Number(auth.estimateTotal).toFixed(2)}</div> : null}
                      {auth.signerName ? (
                        <div style={{ fontSize: 13, color: '#22c55e', marginTop: 4 }}>
                          Signed by {auth.signerName}{auth.signedAt ? ` on ${new Date(auth.signedAt).toLocaleDateString()}` : ''}
                        </div>
                      ) : null}
                    </div>
                    <span style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid #22c55e', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>Signed</span>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}
