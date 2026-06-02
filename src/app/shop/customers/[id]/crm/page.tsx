'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import { FaArrowLeft, FaCar, FaClipboardList, FaRegStar, FaStar, FaTag } from 'react-icons/fa';

interface CRMData {
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    company: string | null;
    internalNotes: string | null;
    tags: string[];
    createdAt: string;
  };
  stats: {
    totalSpend: number;
    totalJobs: number;
    completedJobs: number;
    averageJobValue: number;
    memberSince: string;
  };
  workOrders: Array<{
    id: string;
    status: string;
    vehicleType: string;
    estimatedCost: number | null;
    amountPaid: number | null;
    createdAt: string;
    completedAt: string | null;
  }>;
  vehicles: Array<{ id: string; make: string; model: string; year: number; licensePlate: string }>;
  reviews: Array<{ id: string; rating: number; comment: string | null; createdAt: string }>;
}

export default function CustomerCRMPage({ params }: { params: Promise<{ id: string }> }) {
  useRequireAuth(['shop', 'manager']);
  const router = useRouter();
  const [data, setData] = useState<CRMData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [customerId, setCustomerId] = useState<string>('');

  useEffect(() => {
    params.then(p => {
      setCustomerId(p.id);
      fetchCRM(p.id);
    });
  }, [params]);

  const fetchCRM = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/shop/customers/${id}/crm`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setData(d);
        setNotes(d.customer.internalNotes || '');
        setTags(d.customer.tags || []);
      }
    } catch (err) {
      console.error('Failed to fetch CRM:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveNotes = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/shop/customers/${customerId}/crm`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ internalNotes: notes, tags }),
      });
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const cardStyle = {
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 20,
  };

  const statusColors: Record<string, string> = {
    'pending': '#f59e0b', 'in-progress': '#3b82f6', 'waiting-for-payment': '#a855f7',
    'closed': '#22c55e', 'denied-estimate': '#e5332a',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'transparent' }}>
      <TopNavBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} showMenuButton />
      <Sidebar role="shop" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 32px' }}>
        <Link href="/shop/customer-reports" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: 14, display: 'inline-block', marginBottom: 16 }}><FaArrowLeft style={{marginRight:4}} /> Back to Customers</Link>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9aa3b2' }}>Loading...</div>
        ) : !data ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#e5332a' }}>Customer not found</div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div>
                <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb' }}>
                  {data.customer.firstName} {data.customer.lastName}
                </h1>
                <div style={{ fontSize: 14, color: '#9aa3b2', marginTop: 4 }}>
                  {data.customer.email}
                  {data.customer.phone && <span> - {data.customer.phone}</span>}
                  {data.customer.company && <span> - {data.customer.company}</span>}
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#9aa3b2' }}>
                Customer since {new Date(data.stats.memberSince).toLocaleDateString()}
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
              <div style={cardStyle}>
                <div style={{ fontSize: 12, color: '#9aa3b2', marginBottom: 6 }}>Total Spend</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#22c55e' }}>${data.stats.totalSpend.toFixed(2)}</div>
              </div>
              <div style={cardStyle}>
                <div style={{ fontSize: 12, color: '#9aa3b2', marginBottom: 6 }}>Total Jobs</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#3b82f6' }}>{data.stats.totalJobs}</div>
              </div>
              <div style={cardStyle}>
                <div style={{ fontSize: 12, color: '#9aa3b2', marginBottom: 6 }}>Completed</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#a855f7' }}>{data.stats.completedJobs}</div>
              </div>
              <div style={cardStyle}>
                <div style={{ fontSize: 12, color: '#9aa3b2', marginBottom: 6 }}>Avg Job Value</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b' }}>${data.stats.averageJobValue.toFixed(2)}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
              {/* Notes */}
              <div style={cardStyle}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e5e7eb', marginBottom: 12 }}><FaClipboardList style={{marginRight:4}} /> Internal Notes</h2>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={5}
                  placeholder="Add notes about this customer..."
                  style={{ width: '100%', padding: 12, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: '#e5e7eb', fontSize: 14, resize: 'vertical' }}
                />
                <button
                  onClick={saveNotes}
                  disabled={saving}
                  style={{ marginTop: 8, padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? 'Saving...' : 'Save Notes & Tags'}
                </button>
              </div>

              {/* Tags */}
              <div style={cardStyle}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e5e7eb', marginBottom: 12 }}><FaTag style={{marginRight:4}} /> Tags</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {tags.map(tag => (
                    <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 999, fontSize: 12, color: '#3b82f6' }}>
                      {tag}
                      <button onClick={() => removeTag(tag)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>├ù</button>
                    </span>
                  ))}
                  {tags.length === 0 && <span style={{ fontSize: 13, color: '#9aa3b2' }}>No tags yet</span>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    placeholder="Add tag..."
                    style={{ flex: 1, padding: '8px 12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: '#e5e7eb', fontSize: 13 }}
                  />
                  <button onClick={addTag} style={{ padding: '8px 12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Add</button>
                </div>
              </div>
            </div>

            {/* Vehicles */}
            {data.vehicles.length > 0 && (
              <div style={{ ...cardStyle, marginBottom: 24 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e5e7eb', marginBottom: 12 }}><FaCar style={{marginRight:4}} /> Vehicles</h2>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {data.vehicles.map(v => (
                    <div key={v.id} style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e7eb' }}>{v.year} {v.make} {v.model}</div>
                      <div style={{ fontSize: 12, color: '#9aa3b2' }}>{v.licensePlate}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Work Order History */}
            <div style={{ ...cardStyle, marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e5e7eb', marginBottom: 12 }}><FaClipboardList style={{marginRight:4}} /> Work Order History</h2>
              {data.workOrders.length === 0 ? (
                <div style={{ color: '#9aa3b2', fontSize: 14, textAlign: 'center', padding: 20 }}>No work orders yet</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: '#9aa3b2' }}>WO #</th>
                        <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: '#9aa3b2' }}>Date</th>
                        <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: '#9aa3b2' }}>Vehicle</th>
                        <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: '#9aa3b2' }}>Status</th>
                        <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 12, color: '#9aa3b2' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.workOrders.map(wo => (
                        <tr key={wo.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }} onClick={() => router.push(`/workorders/${wo.id}` as Route)}>
                          <td style={{ padding: '10px 12px', fontSize: 13, color: '#3b82f6' }}>{wo.id.slice(0, 8)}</td>
                          <td style={{ padding: '10px 12px', fontSize: 13, color: '#e5e7eb' }}>{new Date(wo.createdAt).toLocaleDateString()}</td>
                          <td style={{ padding: '10px 12px', fontSize: 13, color: '#e5e7eb' }}>{wo.vehicleType}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, color: statusColors[wo.status] || '#9aa3b2', background: `${statusColors[wo.status] || '#9aa3b2'}20` }}>
                              {wo.status.replace(/-/g, ' ')}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: 13, color: '#22c55e', textAlign: 'right' }}>${(wo.amountPaid || wo.estimatedCost || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Reviews */}
            {data.reviews.length > 0 && (
              <div style={cardStyle}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e5e7eb', marginBottom: 12 }}><FaStar style={{marginRight:4}} /> Reviews</h2>
                {data.reviews.map(r => (
                  <div key={r.id} style={{ padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 8, marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: '#f59e0b' }}>{Array.from({length: r.rating}, (_, i) => <FaStar key={i} />)}{Array.from({length: 5 - r.rating}, (_, i) => <FaRegStar key={i} />)}</span>
                      <span style={{ fontSize: 12, color: '#9aa3b2' }}>{new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                    {r.comment && <div style={{ fontSize: 13, color: '#e5e7eb' }}>{r.comment}</div>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
