'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaChartBar, FaChartLine, FaCreditCard, FaDollarSign, FaStore, FaUniversity, FaWrench } from 'react-icons/fa';

interface StripeLinks {
  dashboard: string;
  payments: string;
  payouts: string;
  balances: string;
}

interface WorkOrderFees {
  feePerWorkOrder: number;
  totalFees: number;
  feesToday: number;
  feesThisWeek: number;
  feesThisMonth: number;
  feesLastMonth: number;
  feesLast3Months: number;
  momGrowth: number;
  totalPaidWorkOrders: number;
  paidWorkOrdersToday: number;
  paidWorkOrdersThisWeek: number;
  paidWorkOrdersThisMonth: number;
  totalWorkOrderRevenue: number;
  thisMonthWorkOrderRevenue: number;
  lastMonthWorkOrderRevenue: number;
  averageTicket: number;
  dailyFeesTrend: number[];
  dailyPaidOrdersTrend: number[];
  dailyRevenueTrend: number[];
  feesByShop: Array<{ shopId: string; shopName: string; count: number; fees: number; totalRevenue: number }>;
  recentTransactions: Array<{
    id: string;
    shopName: string;
    customerName: string;
    description: string;
    amountPaid: number;
    fee: number;
    date: string;
  }>;
}

// Mini chart component
function MiniLineChart({ data, color, height = 40 }: { data: number[]; color: string; height?: number }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 100;
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={`rev-gradient-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke={color} strokeWidth="2" points={points} strokeLinecap="round" strokeLinejoin="round" />
      <polygon fill={`url(#rev-gradient-${color.replace('#', '')})`} points={`0,${height} ${points} ${width},${height}`} />
    </svg>
  );
}

export default function AdminRevenuePage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useRequireAuth(['admin', 'superadmin']);
  const [loading, setLoading] = useState(true);
  const [stripeLinks, setStripeLinks] = useState<StripeLinks | null>(null);
  const [workOrderFees, setWorkOrderFees] = useState<WorkOrderFees | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && user) {
      fetchRevenueData();
      
      // Auto-refresh every 2 minutes
      const interval = setInterval(() => {
        fetchRevenueData();
      }, 2 * 60 * 1000);
      
      return () => clearInterval(interval);
    }
  }, [authLoading, user]);

  const fetchRevenueData = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/revenue', {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.status === 401 || res.status === 403) {
        router.push('/auth/login' as Route);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setStripeLinks(data.stripeLinks || null);
        setWorkOrderFees(data.workOrderFees || null);
      } else {
        setError(data.error || 'Failed to load revenue data');
      }
    } catch {
      setError('Failed to fetch revenue data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const momLabel = workOrderFees
    ? `${workOrderFees.momGrowth >= 0 ? '+' : ''}${workOrderFees.momGrowth.toFixed(1)}%`
    : '0.0%';

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#000000] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-stone-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#000000] flex items-center justify-center">
        <div className="bg-[#000000] border border-[#1f2937] rounded-lg px-6 py-4 text-stone-400 text-sm">
          Redirecting to login...
        </div>
      </div>
    );
  }

  if (!user.isOwner) {
    return (
      <div className="min-h-screen bg-[#000000] text-stone-100 flex items-center justify-center px-6">
        <div className="max-w-xl w-full bg-[#000000] border border-[#1f2937] rounded-xl p-6 text-center">
          <h1 className="text-xl font-semibold mb-2">Owner Access Required</h1>
          <p className="text-stone-400 text-sm mb-5">
            Platform revenue and FixTray earnings are visible only to the FixTray Owner account.
          </p>
          <Link
            href="/admin/home"
            className="inline-flex items-center gap-2 bg-[#e5332a] hover:bg-[#c62822] text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <FaArrowLeft style={{marginRight:4}} /> Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#000000] text-stone-100">
      <header className="bg-[#000000] border-b border-[#1f2937] px-5 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/admin/home"
              className="text-stone-400 hover:text-stone-100 transition-colors text-sm"
            >
              <FaArrowLeft style={{marginRight:4}} /> Back to Dashboard
            </Link>
            <h1 className="text-2xl font-semibold text-stone-100"><FaDollarSign style={{marginRight:4}} /> Shop Fee Revenue</h1>
          </div>
          <a
            href={stripeLinks?.dashboard || 'https://dashboard.stripe.com'}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#e5332a] hover:bg-[#c62822] text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/>
            </svg>
            Open Stripe Dashboard
          </a>
        </div>
      </header>

      <main className="px-5 py-8 max-w-7xl mx-auto">
        {error && (
          <div className="bg-red-500/10 border border-red-500/40 text-red-300 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {!workOrderFees && !error && (
          <div className="bg-[#000000] border border-[#1f2937] rounded-lg px-6 py-4 text-stone-400 text-sm">
            No fee data available yet.
          </div>
        )}

        {workOrderFees && (
          <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-[#000000] to-[#000000] border border-[#1f2937] rounded-2xl p-6 shadow-lg shadow-black/30">
            <div className="flex items-center justify-between mb-2">
              <div className="text-stone-400 text-sm">Total Shop Fees Collected</div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  workOrderFees.momGrowth >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {momLabel}
                </span>
            </div>
            <div className="text-3xl font-bold text-green-400">
              {formatCurrency(workOrderFees.totalFees)}
            </div>
            <div className="text-stone-500 text-sm mt-1">{workOrderFees.totalPaidWorkOrders.toLocaleString()} paid work orders</div>
            <MiniLineChart data={workOrderFees.dailyFeesTrend} color="#22C55E" height={35} />
          </div>

          <div className="bg-gradient-to-br from-[#000000] to-[#000000] border border-[#1f2937] rounded-2xl p-6 shadow-lg shadow-black/30">
            <div className="text-stone-400 text-sm mb-1">Fees This Month</div>
            <div className="text-3xl font-bold text-[#ff6b64]">{formatCurrency(workOrderFees.feesThisMonth)}</div>
            <div className="text-stone-500 text-sm mt-1">{workOrderFees.paidWorkOrdersThisMonth.toLocaleString()} paid work orders</div>
          </div>

          <div className="bg-gradient-to-br from-[#000000] to-[#000000] border border-[#1f2937] rounded-2xl p-6 shadow-lg shadow-black/30">
            <div className="text-stone-400 text-sm mb-1">Fees This Week</div>
            <div className="text-3xl font-bold text-orange-400">{formatCurrency(workOrderFees.feesThisWeek)}</div>
            <div className="text-stone-500 text-sm mt-1">{workOrderFees.paidWorkOrdersThisWeek.toLocaleString()} paid work orders</div>
          </div>

          <div className="bg-gradient-to-br from-[#000000] to-[#000000] border border-[#1f2937] rounded-2xl p-6 shadow-lg shadow-black/30">
            <div className="text-stone-400 text-sm mb-1">Fee Per Paid Work Order</div>
            <div className="text-3xl font-bold text-purple-400">{formatCurrency(workOrderFees.feePerWorkOrder)}</div>
            <div className="text-stone-500 text-sm mt-1">Configured platform service fee</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-[#000000] border border-[#1f2937] rounded-2xl p-4 text-center">
              <div className="text-2xl font-bold text-green-400">{formatCurrency(workOrderFees.feesToday)}</div>
              <div className="text-stone-400 text-xs">Fees Today</div>
            </div>
            <div className="bg-[#000000] border border-[#1f2937] rounded-2xl p-4 text-center">
              <div className="text-2xl font-bold text-red-400">{formatCurrency(workOrderFees.feesLastMonth)}</div>
              <div className="text-stone-400 text-xs">Fees Last Month</div>
            </div>
            <div className="bg-[#000000] border border-[#1f2937] rounded-2xl p-4 text-center">
              <div className="text-2xl font-bold text-[#ff6b64]">{formatCurrency(workOrderFees.feesLast3Months)}</div>
              <div className="text-stone-400 text-xs">Fees Last 3 Months</div>
            </div>
            <div className="bg-[#000000] border border-[#1f2937] rounded-2xl p-4 text-center">
              <div className="text-2xl font-bold text-purple-400">{formatCurrency(workOrderFees.totalWorkOrderRevenue)}</div>
              <div className="text-stone-400 text-xs">Total Paid Work Order Revenue</div>
            </div>
            <div className="bg-[#000000] border border-[#1f2937] rounded-2xl p-4 text-center">
              <div className="text-2xl font-bold text-orange-400">{formatCurrency(workOrderFees.thisMonthWorkOrderRevenue)}</div>
              <div className="text-stone-400 text-xs">This Month Work Order Revenue</div>
            </div>
            <div className="bg-[#000000] border border-[#1f2937] rounded-2xl p-4 text-center">
              <div className="text-2xl font-bold text-cyan-400">{formatCurrency(workOrderFees.averageTicket)}</div>
              <div className="text-stone-400 text-xs">Average Ticket</div>
            </div>
          </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-[#000000] border border-[#1f2937] rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-stone-400 text-sm">Fees Trend (7 days)</div>
                  <div className="text-2xl font-bold text-green-400">{formatCurrency(workOrderFees.dailyFeesTrend.reduce((a, b) => a + b, 0))}</div>
                </div>
                <div className="w-10 h-10 bg-green-500/15 rounded-lg flex items-center justify-center">
                  <span className="text-xl"><FaChartLine style={{marginRight:4}} /></span>
                </div>
              </div>
              <MiniLineChart data={workOrderFees.dailyFeesTrend} color="#22C55E" height={32} />
            </div>
            <div className="bg-[#000000] border border-[#1f2937] rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-stone-400 text-sm">Paid Work Orders (7 days)</div>
                  <div className="text-2xl font-bold text-yellow-400">{workOrderFees.dailyPaidOrdersTrend.reduce((a, b) => a + b, 0)}</div>
                </div>
                <div className="w-10 h-10 bg-yellow-500/15 rounded-lg flex items-center justify-center">
                  <span className="text-xl"><FaWrench style={{marginRight:4}} /></span>
                </div>
              </div>
              <MiniLineChart data={workOrderFees.dailyPaidOrdersTrend} color="#EAB308" height={32} />
            </div>
            <div className="bg-[#000000] border border-[#1f2937] rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-stone-400 text-sm">Work Order Revenue (7 days)</div>
                  <div className="text-2xl font-bold text-[#ff6b64]">{formatCurrency(workOrderFees.dailyRevenueTrend.reduce((a, b) => a + b, 0))}</div>
                </div>
                <div className="w-10 h-10 bg-[#e5332a]/15 rounded-lg flex items-center justify-center">
                  <span className="text-xl"><FaDollarSign style={{marginRight:4}} /></span>
                </div>
              </div>
              <MiniLineChart data={workOrderFees.dailyRevenueTrend} color="#FF6B64" height={32} />
            </div>
          </div>

        <div className="bg-[#000000] border border-[#1f2937] rounded-2xl p-6 mb-8 shadow-lg shadow-black/30">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="text-[#635BFF]"><FaCreditCard style={{marginRight:4}} /></span> Stripe Quick Actions
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <a
              href={stripeLinks?.payouts || 'https://dashboard.stripe.com/payouts'}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#000000] hover:bg-[#000000] border border-[#1f2937] rounded-xl p-4 text-center transition-colors"
            >
              <div className="text-2xl mb-2"><FaUniversity style={{marginRight:4}} /></div>
              <div className="font-medium">Payouts</div>
              <div className="text-stone-400 text-sm">View bank transfers</div>
            </a>
            <a
              href={stripeLinks?.balances || 'https://dashboard.stripe.com/balance/overview'}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#000000] hover:bg-[#000000] border border-[#1f2937] rounded-xl p-4 text-center transition-colors"
            >
              <div className="text-2xl mb-2"><FaDollarSign style={{marginRight:4}} /></div>
              <div className="font-medium">Balance</div>
              <div className="text-stone-400 text-sm">Available funds</div>
            </a>
            <a
              href={stripeLinks?.payments || 'https://dashboard.stripe.com/payments'}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#000000] hover:bg-[#000000] border border-[#1f2937] rounded-xl p-4 text-center transition-colors"
            >
              <div className="text-2xl mb-2"><FaCreditCard style={{marginRight:4}} /></div>
              <div className="font-medium">Payments</div>
              <div className="text-stone-400 text-sm">Transaction history</div>
            </a>
            <div className="bg-[#000000] border border-[#1f2937] rounded-xl p-4 text-center">
              <div className="text-2xl mb-2"><FaChartBar style={{marginRight:4}} /></div>
              <div className="font-medium">Shop Fees</div>
              <div className="text-stone-400 text-sm">Based on paid work orders only</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#000000] border border-[#1f2937] rounded-2xl p-6 shadow-lg shadow-black/30">
            <h2 className="text-lg font-semibold mb-4"><FaStore style={{marginRight:4}} /> Fees by Shop</h2>
            {workOrderFees.feesByShop.length > 0 ? (
              <div className="space-y-4">
                {workOrderFees.feesByShop.slice(0, 12).map((shop) => (
                  <div key={shop.shopId} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <div>
                        <div className="font-medium">{shop.shopName}</div>
                        <div className="text-stone-400 text-sm">{shop.count} paid work orders</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-green-400">{formatCurrency(shop.fees)}</div>
                      <div className="text-stone-500 text-xs">Jobs {formatCurrency(shop.totalRevenue)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-stone-500 text-center py-8">
                No shop fee data yet
              </div>
            )}
          </div>

          <div className="bg-[#000000] border border-[#1f2937] rounded-2xl p-6 shadow-lg shadow-black/30">
            <h2 className="text-lg font-semibold mb-4"><FaWrench style={{marginRight:4}} /> Recent Fee Transactions</h2>
            {workOrderFees.recentTransactions.length > 0 ? (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {workOrderFees.recentTransactions.map((txn) => (
                  <div key={txn.id} className="flex items-center justify-between py-2 border-b border-[#1f2937] last:border-0">
                    <div>
                      <div className="font-medium">{txn.shopName}</div>
                      <div className="text-stone-400 text-sm">{txn.customerName}</div>
                      <div className="text-stone-500 text-xs">{formatDate(txn.date)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-green-400">+{formatCurrency(txn.fee)}</div>
                      <div className="text-stone-500 text-xs">Job {formatCurrency(txn.amountPaid)}</div>
                      <div className="text-stone-500 text-xs">{txn.description.slice(0, 28)}</div>
                      </div>
                    </div>
                ))}
              </div>
            ) : (
              <div className="text-stone-500 text-center py-8">
                No fee transactions recorded yet
              </div>
            )}
          </div>
        </div>
        </>
        )}
      </main>
    </div>
  );
}



