'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaChartBar, FaHeart, FaHourglassHalf, FaStar, FaTimes, FaUser, FaUsers } from 'react-icons/fa';

type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  location: string;
  profileComplete: boolean;
  createdAt: string;
  totalJobs: number;
  completedJobs: number;
  completionRate: number;
  totalRevenue: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  totalFixtrayFees: number;
  feesThisMonth: number;
  feesLastMonth: number;
  paidWorkOrders: number;
  paidWorkOrdersThisMonth: number;
  paidWorkOrdersLastMonth: number;
  jobsThisMonth: number;
  jobsLastMonth: number;
  rating: number;
  reviewCount: number;
  healthScore: number;
  lifetimeMonths: number;
  vehiclesCount: number;
  favoriteShopsCount: number;
  emailVerified: boolean;
};

type LiveMetrics = {
  totalCustomers: number;
  newCustomersThisMonth: number;
  newCustomersLastMonth: number;
  customerGrowth: string;
  feePerWorkOrder: number;
  totalFixtrayFees: number;
  fixtrayFeesThisMonth: number;
  fixtrayFeesLastMonth: number;
  feeGrowth: string;
  totalPaidWorkOrders: number;
  paidWorkOrdersThisMonth: number;
  avgLifetimeMonths: number;
  totalWorkOrderRevenue: number;
  workOrderRevenueThisMonth: number;
  workOrderRevenueLastMonth: number;
  totalJobs: number;
  totalJobsThisMonth: number;
  totalJobsLastMonth: number;
  jobsGrowth: string;
  healthDistribution: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
  topCustomers: Customer[];
  atRiskCustomers: Customer[];
  customerTrend: number[];
  revenueTrend: number[];
  feeTrend: number[];
};

function MiniLineChart({ data, color, height = 40 }: { data: number[]; color: string; height?: number }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const width = 100;
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      <polyline fill="none" stroke={color} strokeWidth="2" points={points} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ManageCustomers() {
  const { user, isLoading } = useRequireAuth(['admin', 'superadmin']);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [liveMetrics, setLiveMetrics] = useState<LiveMetrics | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [filterHealth, setFilterHealth] = useState<string>('all');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  useEffect(() => {
    if (isLoading || !user) return;

    const fetchCustomers = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/customers', {
          credentials: 'include',
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setCustomers(data.customers || []);
            setLiveMetrics(data.liveMetrics || null);
          }
        }
      } catch (error) {
        console.error('Error fetching customers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
    const interval = setInterval(fetchCustomers, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isLoading, user]);

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb', fontSize: '18px' }}>
        Loading...
      </div>
    );
  }

  if (!user) return null;

  const getHealthColor = (score: number) => {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#e5332a';
    if (score >= 40) return '#f59e0b';
    return '#e5332a';
  };

  const getHealthLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'At Risk';
  };

  let filteredCustomers = [...customers];
  if (filterHealth !== 'all') {
    filteredCustomers = filteredCustomers.filter((c) => {
      if (filterHealth === 'excellent') return c.healthScore >= 80;
      if (filterHealth === 'good') return c.healthScore >= 60 && c.healthScore < 80;
      if (filterHealth === 'fair') return c.healthScore >= 40 && c.healthScore < 60;
      if (filterHealth === 'poor') return c.healthScore < 40;
      return true;
    });
  }

  return (
    <div style={{ minHeight: '100vh', background: 'transparent' }}>
      <div style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(229,51,42,0.3)', padding: '20px 32px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <Link href="/admin/home" style={{ color: '#e5332a', textDecoration: 'none', fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'inline-block' }}>
            <FaArrowLeft style={{ marginRight: 4 }} /> Back to Dashboard
          </Link>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', marginBottom: 8 }}><FaUsers style={{ marginRight: 4 }} /> Manage Customers</h1>
          <p style={{ fontSize: 14, color: '#9aa3b2' }}>View and manage real FixTray app customers</p>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: 32 }}>
        {liveMetrics && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#9aa3b2', marginBottom: 4 }}>Total Customers</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#22c55e' }}>{liveMetrics.totalCustomers}</div>
                  </div>
                  <span style={{ padding: '4px 8px', background: 'rgba(34,197,94,0.2)', color: '#22c55e', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                    {liveMetrics.customerGrowth}
                  </span>
                </div>
                <MiniLineChart data={liveMetrics.customerTrend} color="#22c55e" height={30} />
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 12, color: '#9aa3b2', marginBottom: 4 }}>FixTray Fees Collected</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#e5332a' }}>{formatCurrency(liveMetrics.totalFixtrayFees)}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Growth: {liveMetrics.feeGrowth}</div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 12, color: '#9aa3b2', marginBottom: 4 }}>FixTray Fees This Month</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#8b5cf6' }}>{formatCurrency(liveMetrics.fixtrayFeesThisMonth)}</div>
                <MiniLineChart data={liveMetrics.feeTrend} color="#8b5cf6" height={30} />
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(6,182,212,0.3)', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 12, color: '#9aa3b2', marginBottom: 4 }}>Total Jobs</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#06b6d4' }}>{liveMetrics.totalJobs}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>This month: {liveMetrics.totalJobsThisMonth}</div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 12, color: '#9aa3b2', marginBottom: 4 }}>Fee Per Paid Work Order</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b' }}>{formatCurrency(liveMetrics.feePerWorkOrder)}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Paid this month: {liveMetrics.paidWorkOrdersThisMonth}</div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 12, color: '#9aa3b2', marginBottom: 4 }}>Paid Work Orders</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#22c55e' }}>{liveMetrics.totalPaidWorkOrders}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Last month fees: {formatCurrency(liveMetrics.fixtrayFeesLastMonth)}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 12, padding: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e5e7eb', marginBottom: 16 }}><FaChartBar style={{ marginRight: 4 }} /> Fee Distribution</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  <div style={{ background: 'rgba(34,197,94,0.1)', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#22c55e' }}>{formatCurrency(liveMetrics.fixtrayFeesThisMonth)}</div>
                    <div style={{ fontSize: 10, color: '#9aa3b2' }}>This Month Fees</div>
                  </div>
                  <div style={{ background: 'rgba(139,92,246,0.1)', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#8b5cf6' }}>{formatCurrency(liveMetrics.totalFixtrayFees)}</div>
                    <div style={{ fontSize: 10, color: '#9aa3b2' }}>All-Time Fees</div>
                  </div>
                  <div style={{ background: 'rgba(245,158,11,0.1)', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#f59e0b' }}>{formatCurrency(liveMetrics.feePerWorkOrder)}</div>
                    <div style={{ fontSize: 10, color: '#9aa3b2' }}>Fee Per Job</div>
                  </div>
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 12, padding: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e5e7eb', marginBottom: 16 }}><FaHeart style={{ marginRight: 4 }} /> Health Distribution</h3>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ background: 'rgba(34,197,94,0.1)', borderRadius: 8, padding: '8px 16px', textAlign: 'center', flex: 1 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#22c55e' }}>{liveMetrics.healthDistribution.excellent}</div>
                    <div style={{ fontSize: 10, color: '#9aa3b2' }}>Excellent</div>
                  </div>
                  <div style={{ background: 'rgba(229,51,42,0.1)', borderRadius: 8, padding: '8px 16px', textAlign: 'center', flex: 1 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#e5332a' }}>{liveMetrics.healthDistribution.good}</div>
                    <div style={{ fontSize: 10, color: '#9aa3b2' }}>Good</div>
                  </div>
                  <div style={{ background: 'rgba(245,158,11,0.1)', borderRadius: 8, padding: '8px 16px', textAlign: 'center', flex: 1 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#f59e0b' }}>{liveMetrics.healthDistribution.fair}</div>
                    <div style={{ fontSize: 10, color: '#9aa3b2' }}>Fair</div>
                  </div>
                  <div style={{ background: 'rgba(229,51,42,0.1)', borderRadius: 8, padding: '8px 16px', textAlign: 'center', flex: 1 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#e5332a' }}>{liveMetrics.healthDistribution.poor}</div>
                    <div style={{ fontSize: 10, color: '#9aa3b2' }}>At Risk</div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#9aa3b2', marginBottom: 8, fontWeight: 600 }}>Filter by Health</label>
            <select
              value={filterHealth}
              onChange={(e) => setFilterHealth(e.target.value)}
              style={{ padding: '10px 16px', background: 'rgba(0,0,0,0.3)', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', minWidth: 150 }}
            >
              <option value="all">All Health</option>
              <option value="excellent">Excellent (80+)</option>
              <option value="good">Good (60-79)</option>
              <option value="fair">Fair (40-59)</option>
              <option value="poor">At Risk (&lt;40)</option>
            </select>
          </div>
          <div style={{ marginLeft: 'auto', alignSelf: 'flex-end' }}>
            <span style={{ fontSize: 14, color: '#9aa3b2' }}>{filteredCustomers.length} customers</span>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#9aa3b2' }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}><FaHourglassHalf style={{ marginRight: 4 }} /></div>
            <div>Loading customers...</div>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#9aa3b2' }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}><FaUsers style={{ marginRight: 4 }} /></div>
            <div>No customers found</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {filteredCustomers.map((customer) => (
              <div key={customer.id} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 12, padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e5e7eb' }}>{customer.name}</h2>
                      <span style={{ padding: '4px 12px', background: `${getHealthColor(customer.healthScore)}20`, color: getHealthColor(customer.healthScore), borderRadius: 8, fontSize: 11, fontWeight: 600 }}>
                        {getHealthLabel(customer.healthScore)} ({customer.healthScore})
                      </span>
                    </div>
                    <div style={{ fontSize: 14, color: '#9aa3b2' }}>
                      {customer.company}  •  Member for {customer.lifetimeMonths} months
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 16, padding: 16, background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Email</div>
                    <div style={{ fontSize: 13, color: '#e5e7eb', fontWeight: 600, wordBreak: 'break-all' }}>{customer.email}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Phone</div>
                    <div style={{ fontSize: 13, color: '#e5e7eb', fontWeight: 600 }}>{customer.phone}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Jobs</div>
                    <div style={{ fontSize: 18, color: '#e5332a', fontWeight: 700 }}>{customer.completedJobs}/{customer.totalJobs}</div>
                    <div style={{ fontSize: 10, color: '#6b7280' }}>({customer.completionRate}% done)</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>FixTray Fees</div>
                    <div style={{ fontSize: 18, color: '#22c55e', fontWeight: 700 }}>{formatCurrency(customer.totalFixtrayFees)}</div>
                    <div style={{ fontSize: 10, color: '#6b7280' }}>This mo: {formatCurrency(customer.feesThisMonth)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Work Order Revenue</div>
                    <div style={{ fontSize: 18, color: '#22c55e', fontWeight: 700 }}>{formatCurrency(customer.totalRevenue)}</div>
                    <div style={{ fontSize: 10, color: '#6b7280' }}>This mo: {formatCurrency(customer.revenueThisMonth)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Vehicles</div>
                    <div style={{ fontSize: 18, color: '#8b5cf6', fontWeight: 700 }}>{customer.vehiclesCount}</div>
                    <div style={{ fontSize: 10, color: '#6b7280' }}>Favorite shops: {customer.favoriteShopsCount}</div>
                  </div>
                  {customer.rating > 0 && (
                    <div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Rating</div>
                      <div style={{ fontSize: 18, color: '#fbbf24', fontWeight: 700 }}><FaStar style={{ marginRight: 4 }} /> {customer.rating}</div>
                      <div style={{ fontSize: 10, color: '#6b7280' }}>{customer.reviewCount} reviews</div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={() => { setSelectedCustomer(customer); setShowDetails(true); }}
                    style={{ flex: 1, padding: '12px', background: 'rgba(229,51,42,0.2)', color: '#e5332a', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showDetails && selectedCustomer && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 32 }}>
          <div style={{ background: '#000000', border: '2px solid rgba(229,51,42,0.3)', borderRadius: 16, padding: 32, maxWidth: 700, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: '#e5e7eb' }}><FaUser style={{ marginRight: 4 }} /> Customer Details</h2>
              <button onClick={() => setShowDetails(false)} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.1)', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                <FaTimes style={{ marginRight: 4 }} /> Close
              </button>
            </div>

            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: '#e5e7eb', marginBottom: 12 }}>Basic Info</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><span style={{ color: '#6b7280' }}>Name:</span> <span style={{ color: '#e5e7eb', fontWeight: 600 }}>{selectedCustomer.name}</span></div>
                  <div><span style={{ color: '#6b7280' }}>Company:</span> <span style={{ color: '#e5e7eb', fontWeight: 600 }}>{selectedCustomer.company}</span></div>
                  <div><span style={{ color: '#6b7280' }}>Email:</span> <span style={{ color: '#e5e7eb', fontWeight: 600 }}>{selectedCustomer.email}</span></div>
                  <div><span style={{ color: '#6b7280' }}>Phone:</span> <span style={{ color: '#e5e7eb', fontWeight: 600 }}>{selectedCustomer.phone}</span></div>
                  <div><span style={{ color: '#6b7280' }}>Member Since:</span> <span style={{ color: '#e5e7eb', fontWeight: 600 }}>{formatDate(selectedCustomer.createdAt)}</span></div>
                  <div><span style={{ color: '#6b7280' }}>Email Verified:</span> <span style={{ color: '#e5e7eb', fontWeight: 600 }}>{selectedCustomer.emailVerified ? 'Yes' : 'No'}</span></div>
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: '#e5e7eb', marginBottom: 12 }}><FaChartBar style={{ marginRight: 4 }} /> Activity & Fees</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  <div style={{ textAlign: 'center', padding: 12, background: 'rgba(229,51,42,0.1)', borderRadius: 8 }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#e5332a' }}>{selectedCustomer.completedJobs}</div>
                    <div style={{ fontSize: 11, color: '#9aa3b2' }}>Jobs Done</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: 12, background: 'rgba(34,197,94,0.1)', borderRadius: 8 }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#22c55e' }}>{formatCurrency(selectedCustomer.totalFixtrayFees)}</div>
                    <div style={{ fontSize: 11, color: '#9aa3b2' }}>FixTray Fees</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: 12, background: 'rgba(139,92,246,0.1)', borderRadius: 8 }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#8b5cf6' }}>{formatCurrency(selectedCustomer.totalRevenue)}</div>
                    <div style={{ fontSize: 11, color: '#9aa3b2' }}>Total Revenue</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: 12, background: `${getHealthColor(selectedCustomer.healthScore)}15`, borderRadius: 8 }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: getHealthColor(selectedCustomer.healthScore) }}>{selectedCustomer.healthScore}</div>
                    <div style={{ fontSize: 11, color: '#9aa3b2' }}>Health Score</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
