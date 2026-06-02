'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowDown, FaArrowLeft, FaArrowRight, FaArrowUp, FaBolt, FaChartBar, FaChartLine, FaCheck, FaCheckSquare, FaCircle, FaDollarSign, FaDotCircle, FaExclamationTriangle, FaExternalLinkAlt, FaRegCircle, FaRegStar, FaStar, FaSyncAlt } from 'react-icons/fa';

interface CommandCenterData {
  timestamp: string;
  realTimeOps: {
    clockedInNow: number;
    clockedInDetails: Array<{
      name: string;
      shop: string;
      since: string;
      onBreak: boolean;
    }>;
    activeWorkOrders: number;
    workOrdersByStatus: Record<string, number>;
    todayWorkOrders: number;
    overdueWorkOrders: number;
    todayAppointments: number;
    noShowsThisWeek: number;
  };
  financials: {
    todayRevenue: number;
    weekRevenue: number;
    pendingPayments: { count: number; amount: number };
  };
  shopHealth: {
    pendingApproval: number;
    pendingShops: Array<any>;
    totalApproved: number;
    activeThisWeek: number;
    inactiveShops: number;
    inactiveList: Array<any>;
  };
  customers: {
    total: number;
    newToday: number;
    newThisWeek: number;
  };
  reviews: {
    averageRating: number;
    totalReviews: number;
    recentBadReviews: Array<any>;
  };
  communication: {
    unreadAdminMessages: number;
    messagesToday: number;
  };
  inventory: {
    lowStockAlerts: number;
    lowStockItems: Array<any>;
  };
  workforce: {
    totalTechs: number;
    activeTechsToday: number;
    totalHoursToday: number;
  };
  staffTeam: {
    totalStaff: number;
    activeStaff: number;
    inactiveStaff: number;
    staffWithLiveSession: number;
    newThisMonth: number;
    members: Array<{
      id: string;
      username: string;
      email: string;
      isSuperAdmin: boolean;
      isOwner: boolean;
      createdAt: string;
      lastLogin: string | null;
      hasActiveSession: boolean;
      activityStatus: 'active' | 'inactive';
    }>;
  };
  serviceBreakdown: Record<string, number>;
  workOrderFees: {
    feePerWorkOrder: number;
    totalFees: number;
    feesToday: number;
    feesThisWeek: number;
    feesThisMonth: number;
    feesLastMonth: number;
    momGrowth: number;
    totalPaidWorkOrders: number;
    paidWorkOrdersToday: number;
    paidWorkOrdersThisWeek: number;
    paidWorkOrdersThisMonth: number;
    feesByShop: Array<{
      shopName: string;
      count: number;
      fees: number;
    }>;
    recentTransactions: Array<{
      id: string;
      shopName: string;
      customerName: string;
      description: string;
      amountPaid: number;
      fee: number;
      date: string;
    }>;
  };
  businessMetrics: {
    mrr: number;
    arr: number;
    totalShopsCreated: number;
    shopsByStatus: Record<string, number>;
  };
}

interface LiveShopsData {
  liveMetrics: {
    totalShops: number;
    activeShops: number;
    inactiveShops: number;
    pendingShops: number;
    approvedShops: number;
  };
  shops: Array<{
    id: string;
    name: string;
    email: string | null;
    status: string;
    activityStatus: 'active' | 'inactive';
  }>;
}

interface LiveRevenueData {
  workOrderFees: CommandCenterData['workOrderFees'];
}

export default function CommandCenterPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useRequireAuth(['admin']);
  const [data, setData] = useState<CommandCenterData | null>(null);
  const [liveShopsData, setLiveShopsData] = useState<LiveShopsData | null>(null);
  const [liveRevenueData, setLiveRevenueData] = useState<LiveRevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeTab, setActiveTab] = useState('business');
  const [employeeForm, setEmployeeForm] = useState({ username: '', email: '', password: '' });
  const [isCreatingEmployee, setIsCreatingEmployee] = useState(false);
  const [teamMessage, setTeamMessage] = useState('');


  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('No authentication token found');
        return;
      }

      const [commandCenterRes, shopsRes, revenueRes] = await Promise.all([
        fetch('/api/admin/command-center', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch('/api/admin/shops', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }),
        user?.isOwner
          ? fetch('/api/admin/revenue', {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            })
          : Promise.resolve(null)
      ]);

      if (!commandCenterRes.ok) throw new Error('Failed to fetch command center data');

      const commandCenterResult = await commandCenterRes.json();
      if (commandCenterResult.success) {
        setData(commandCenterResult);
        setLastUpdate(new Date());
        setError('');
      }

      if (shopsRes.ok) {
        const shopsResult = await shopsRes.json();
        if (shopsResult?.success) {
          setLiveShopsData({
            liveMetrics: shopsResult.liveMetrics,
            shops: shopsResult.shops,
          });
        }
      }

      if (revenueRes?.ok) {
        const revenueResult = await revenueRes.json();
        if (revenueResult?.success && revenueResult?.workOrderFees) {
          setLiveRevenueData({
            workOrderFees: revenueResult.workOrderFees,
          });
        }
      } else if (!user?.isOwner) {
        setLiveRevenueData(null);
      }
    } catch {
      setError('Failed to load command center data');
    } finally {
      setLoading(false);
    }
  }, [user?.isOwner]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchData();
    }
  }, [authLoading, user, fetchData]);

  useEffect(() => {
    if (!autoRefresh || !user) return;
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, user, fetchData]);

  useEffect(() => {
    if (!user?.isOwner && activeTab === 'business') {
      setActiveTab('overview');
      return;
    }

    const validTabs = user?.isOwner
      ? ['business', 'overview', 'operations', 'shops', 'team']
      : ['overview', 'operations', 'shops', 'team'];

    if (!validTabs.includes(activeTab)) {
      setActiveTab(user?.isOwner ? 'business' : 'overview');
    }
  }, [activeTab, user?.isOwner]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSignOut = () => {
    localStorage.clear();
    router.push('/auth/login' as Route);
  };

  const createEmployee = async () => {
    if (!user?.isOwner) {
      setTeamMessage('Only FixTray Owner can create FixTray Admin employees.');
      return;
    }

    const username = employeeForm.username.trim();
    const email = employeeForm.email.trim();
    const password = employeeForm.password;

    if (!username || !email || !password) {
      setTeamMessage('Username, email, and password are required.');
      return;
    }

    if (password.length < 8) {
      setTeamMessage('Password must be at least 8 characters.');
      return;
    }

    setIsCreatingEmployee(true);
    setTeamMessage('');
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setTeamMessage('You are not authenticated. Please sign in again.');
        return;
      }

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTeamMessage(payload?.error || 'Failed to create employee account.');
        return;
      }

      setEmployeeForm({ username: '', email: '', password: '' });
      setTeamMessage('FixTray employee created successfully.');
      await fetchData();
    } catch {
      setTeamMessage('Failed to create employee account.');
    } finally {
      setIsCreatingEmployee(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-orange-500/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-orange-500 animate-spin"></div>
            <div className="absolute inset-3 rounded-full border-4 border-transparent border-t-orange-400 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
          </div>
          <p className="text-stone-400 font-medium">Initializing Command Center...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-stone-400">Redirecting to login...</div>
      </div>
    );
  }

  const liveShopMetrics = liveShopsData?.liveMetrics;
  const liveInactiveShops = (liveShopsData?.shops || []).filter(
    (shop) => shop.activityStatus === 'inactive' && shop.status === 'approved'
  );
  const liveFees = liveRevenueData?.workOrderFees ?? data?.workOrderFees;
  const pendingApprovalsCount = liveShopMetrics?.pendingShops ?? data?.shopHealth.pendingApproval ?? 0;

  const alertCount = (data?.realTimeOps.overdueWorkOrders || 0) +
                     pendingApprovalsCount +
                     (data?.communication.unreadAdminMessages || 0);

  const tabs = [
    ...(user?.isOwner ? [{ id: 'business', label: 'Business', icon: <FaDollarSign style={{marginRight:4}} /> }] : []),
    { id: 'overview', label: 'Overview', icon: <FaDotCircle style={{marginRight:4}} /> },
    { id: 'operations', label: 'Operations', icon: <FaBolt style={{marginRight:4}} /> },
    { id: 'shops', label: 'Shops', icon: <FaCheckSquare style={{marginRight:4}} /> },
    { id: 'team', label: 'Team', icon: <FaRegCircle style={{marginRight:4}} /> },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Ambient Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-[#e5332a]/100/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 right-1/3 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 backdrop-blur-xl bg-black/60">
        <div className="max-w-[1920px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/admin/home" className="group flex items-center gap-2 text-stone-400 hover:text-white transition-all">
                <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors"><FaArrowLeft style={{marginRight:4}} /></span>
              </Link>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
                    <span className="text-xl">Cmd</span>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-stone-900 animate-pulse"></div>
                </div>
                <div>
                  <h1 className="text-lg font-semibold">Command Center</h1>
                  <p className="text-xs text-stone-500">Real-time platform monitoring</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {alertCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  <span className="text-sm text-red-400 font-medium">{alertCount} alerts</span>
                </div>
              )}
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  autoRefresh 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                    : 'bg-white/5 text-stone-400 border border-white/10'
                }`}
              >
                {autoRefresh ? <><FaCircle style={{marginRight:4}} /> Live</> : <><FaRegCircle style={{marginRight:4}} /> Paused</>}
              </button>
              <button
                onClick={fetchData}
                className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all hover:scale-105"
              >
                <FaSyncAlt style={{marginRight:4}} />
              </button>
              <div className="w-px h-8 bg-white/10"></div>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-stone-400 hover:text-red-400 text-sm font-medium border border-white/10 hover:border-red-500/20 transition-all"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1 mt-4 -mb-4 pb-4">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-t-xl text-sm font-medium transition-all flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-white/10 text-white border-t border-x border-white/10'
                    : 'text-stone-500 hover:text-stone-300 hover:bg-white/5'
                }`}
              >
                <span className="opacity-50">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {error && (
        <div className="relative z-10 max-w-[1920px] mx-auto px-6 pt-6">
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
            {error}
          </div>
        </div>
      )}

      <main className="relative z-10 max-w-[1920px] mx-auto px-6 py-6">
        {/* Critical Alerts */}
        {alertCount > 0 && (
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-red-500/10 via-orange-500/10 to-yellow-500/10 border border-red-500/20 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400">!</span>
                <span className="font-semibold">Attention Required</span>
              </div>
              <span className="text-xs text-stone-500">Click to resolve</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {(data?.realTimeOps?.overdueWorkOrders || 0) > 0 && (
                <span className="px-3 py-1.5 rounded-xl bg-red-500/20 text-red-300 text-sm font-medium border border-red-500/20">
                  {data?.realTimeOps?.overdueWorkOrders || 0} Overdue Jobs
                </span>
              )}
              {pendingApprovalsCount > 0 && (
                <Link href="/admin/pending-shops" className="px-3 py-1.5 rounded-xl bg-yellow-500/20 text-yellow-300 text-sm font-medium border border-yellow-500/20 hover:bg-yellow-500/30 transition-colors">
                  {pendingApprovalsCount} Pending Approvals <FaArrowRight style={{marginRight:4}} />
                </Link>
              )}
              {(data?.communication?.unreadAdminMessages || 0) > 0 && (
                <span className="px-3 py-1.5 rounded-xl bg-[#e5332a]/20 text-[#ffb4ad] text-sm font-medium border border-[#e5332a]/20">
                  {data?.communication?.unreadAdminMessages || 0} Unread Messages
                </span>
              )}
            </div>
          </div>
        )}

        {/* ==================== BUSINESS TAB - YOUR APP REVENUE ==================== */}
        {user?.isOwner && activeTab === 'business' && (
          <>
            {/* Fee Analytics Hero Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="p-8 rounded-2xl bg-gradient-to-br from-emerald-600/20 via-emerald-500/10 to-emerald-400/5 border border-emerald-500/30 backdrop-blur-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl"></div>
                <div className="relative">
                  <div className="flex items-center gap-2 text-emerald-400/70 text-sm mb-2">
                    <span><FaDollarSign style={{marginRight:4}} /></span> FixTray Fees This Month
                  </div>
                  <div className="text-5xl font-bold text-emerald-400 mb-2">
                    {formatCurrency(liveFees?.feesThisMonth || 0)}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className={`flex items-center gap-1 ${(liveFees?.momGrowth || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {(liveFees?.momGrowth || 0) >= 0 ? <FaArrowUp style={{marginRight:4}} /> : <FaArrowDown style={{marginRight:4}} />} {Math.abs(liveFees?.momGrowth || 0)}% MoM
                    </span>
                    <span className="text-stone-500">|</span>
                    <span className="text-stone-400">{liveFees?.paidWorkOrdersThisMonth || 0} paid work orders</span>
                  </div>
                </div>
              </div>

              <div className="p-8 rounded-2xl bg-gradient-to-br from-blue-600/20 via-blue-500/10 to-blue-400/5 border border-[#e5332a]/30 backdrop-blur-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#e5332a]/100/10 rounded-full blur-3xl"></div>
                <div className="relative">
                  <div className="flex items-center gap-2 text-[#ff6b64]/70 text-sm mb-2">
                    <span><FaChartLine style={{marginRight:4}} /></span> Total Fees Collected
                  </div>
                  <div className="text-5xl font-bold text-[#ff6b64] mb-2">
                    {formatCurrency(liveFees?.totalFees || 0)}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-[#ff6b64]">{formatCurrency(liveFees?.feePerWorkOrder || 0)} per paid work order</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Key Business Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
              <MetricCard
                label="Total Shops"
                value={data?.businessMetrics?.totalShopsCreated || 0}
                sublabel="registered"
                color="violet"
                icon=""
              />
              <MetricCard
                label="Paid Work Orders"
                value={liveFees?.totalPaidWorkOrders || 0}
                sublabel="all time"
                color="emerald"
                icon=""
              />
              <MetricCard
                label="Fees Today"
                value={formatCurrency(liveFees?.feesToday || 0)}
                sublabel="collected"
                color="cyan"
                icon="$"
                isString
              />
              <MetricCard
                label="Fees This Week"
                value={formatCurrency(liveFees?.feesThisWeek || 0)}
                sublabel="collected"
                color="green"
                icon="$"
                isString
              />
              <MetricCard
                label="Fee Per Paid WO"
                value={formatCurrency(liveFees?.feePerWorkOrder || 0)}
                sublabel="flat"
                color="orange"
                icon="$"
                isString
              />
              <MetricCard
                label="Customers"
                value={data?.customers?.total || 0}
                sublabel="total"
                color="blue"
                icon=""
              />
            </div>

            {/* Fees by Shop & Shops Status */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <GlassCard title="FixTray Fees by Shop" icon="">
                <div className="space-y-4">
                  {liveFees?.feesByShop && liveFees.feesByShop
                    .slice(0, 8)
                    .map((shop) => {
                      const totalFees = liveFees.feesByShop.reduce((sum, row) => sum + row.fees, 0);
                      const percentage = totalFees > 0 ? (shop.fees / totalFees) * 100 : 0;
                      return (
                        <div key={shop.shopName}>
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                              <span className="capitalize font-medium">{shop.shopName}</span>
                              <span className="text-xs text-stone-500 bg-white/5 px-2 py-0.5 rounded-full">{shop.count} paid WOs</span>
                            </div>
                            <span className="text-lg font-bold text-emerald-400">{formatCurrency(shop.fees)}</span>
                          </div>
                          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  {(!liveFees?.feesByShop || liveFees.feesByShop.length === 0) && (
                    <div className="text-center py-8 text-stone-500">
                      <span className="text-4xl mb-2 block opacity-20"><FaChartBar style={{marginRight:4}} /></span>
                      <span>No paid work orders yet</span>
                    </div>
                  )}
                </div>
              </GlassCard>

              <GlassCard title="Shop Status Breakdown" icon="">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                    <div className="text-4xl font-bold text-emerald-400 mb-1">{data?.businessMetrics?.shopsByStatus?.approved || 0}</div>
                    <div className="text-sm text-emerald-400/70">Approved</div>
                  </div>
                  <div className="p-5 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-center">
                    <div className="text-4xl font-bold text-yellow-400 mb-1">{data?.businessMetrics?.shopsByStatus?.pending || 0}</div>
                    <div className="text-sm text-yellow-400/70">Pending</div>
                  </div>
                  <div className="p-5 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                    <div className="text-4xl font-bold text-red-400 mb-1">{data?.businessMetrics?.shopsByStatus?.rejected || 0}</div>
                    <div className="text-sm text-red-400/70">Rejected</div>
                  </div>
                  <div className="p-5 rounded-xl bg-stone-500/10 border border-stone-500/20 text-center">
                    <div className="text-4xl font-bold text-stone-400 mb-1">{data?.businessMetrics?.shopsByStatus?.suspended || 0}</div>
                    <div className="text-sm text-stone-400/70">Suspended</div>
                  </div>
                </div>
                <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex justify-between items-center">
                    <span className="text-stone-400">Total Shops Created</span>
                    <span className="text-2xl font-bold">{data?.businessMetrics?.totalShopsCreated || 0}</span>
                  </div>
                </div>
              </GlassCard>
            </div>

            {/* Recent Fee Transactions */}
            <GlassCard title="Recent Work Order Fee Transactions" icon="" badge={liveFees?.recentTransactions?.length || 0}>
              {liveFees?.recentTransactions && liveFees.recentTransactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-xs text-stone-500 border-b border-white/5">
                        <th className="pb-3 font-medium">Shop</th>
                        <th className="pb-3 font-medium">Customer</th>
                        <th className="pb-3 font-medium">Fee</th>
                        <th className="pb-3 font-medium">Date</th>
                        <th className="pb-3 font-medium text-right">Amount Paid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {liveFees.recentTransactions.map((tx, i) => (
                        <tr key={i} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 font-medium">{tx.shopName || 'Unknown Shop'}</td>
                          <td className="py-3 text-stone-400 text-sm">{tx.customerName || '-'}</td>
                          <td className="py-3 text-emerald-400 font-semibold">{formatCurrency(tx.fee)}</td>
                          <td className="py-3 text-stone-400 text-sm">{new Date(tx.date).toLocaleDateString()}</td>
                          <td className="py-3 text-right font-semibold text-emerald-400">
                            {formatCurrency(tx.amountPaid)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-stone-500">
                  <span className="text-5xl mb-3 block opacity-20"></span>
                  <span className="block mb-2">No paid work-order fee transactions yet</span>
                  <span className="text-xs text-stone-600">Transactions will appear here when paid work orders are recorded</span>
                </div>
              )}
            </GlassCard>

            {/* Quick Actions for Business */}
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/admin/pending-shops" className="px-4 py-2 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 text-sm font-medium border border-yellow-500/20 transition-all">
                Review Pending Shops ({pendingApprovalsCount})
              </Link>
              <Link href="/admin/revenue" className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-sm font-medium border border-emerald-500/20 transition-all">
                Revenue Details <FaArrowRight style={{marginRight:4}} />
              </Link>
              <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 text-sm font-medium border border-violet-500/20 transition-all">
                Open Stripe Dashboard <FaExternalLinkAlt style={{marginRight:4}} />
              </a>
            </div>
          </>
        )}

        {activeTab === 'overview' && (
          <>
            {/* Key Metrics Row */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              <MetricCard
                label="Active Now"
                value={data?.realTimeOps.clockedInNow || 0}
                sublabel="employees"
                color="emerald"
                icon="*"
                pulse
              />
              <MetricCard
                label="Live Jobs"
                value={data?.realTimeOps.activeWorkOrders || 0}
                sublabel="in progress"
                color="blue"
                icon="*"
              />
              <MetricCard
                label="Today's Jobs"
                value={data?.realTimeOps.todayWorkOrders || 0}
                sublabel="created"
                color="violet"
                icon="^"
              />
              <MetricCard
                label="Revenue Today"
                value={formatCurrency(data?.financials.todayRevenue || 0)}
                sublabel="collected"
                color="green"
                icon="$"
                isString
              />
              <MetricCard
                label="Appointments"
                value={data?.realTimeOps.todayAppointments || 0}
                sublabel="scheduled"
                color="orange"
                icon="o"
              />
              <MetricCard
                label="New Customers"
                value={data?.customers.newToday || 0}
                sublabel="signed up"
                color="cyan"
                icon="+"
              />
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* Work Order Pipeline */}
              <div className="lg:col-span-1">
                <GlassCard title="Work Order Pipeline" icon="">
                  <div className="space-y-3">
                    {data?.realTimeOps.workOrdersByStatus && Object.entries(data.realTimeOps.workOrdersByStatus).map(([status, count]) => (
                      <StatusBar key={status} status={status} count={count} total={Object.values(data.realTimeOps.workOrdersByStatus).reduce((a, b) => a + b, 0)} />
                    ))}
                  </div>
                </GlassCard>
              </div>

              {/* Fee Summary */}
              <div className="lg:col-span-1">
                <GlassCard title="FixTray Fee Summary" icon="">
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                      <span className="text-stone-400 text-sm">Fee per paid work order</span>
                      <span className="text-xl font-bold text-emerald-400">{formatCurrency(liveFees?.feePerWorkOrder || 0)}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                      <span className="text-stone-400 text-sm">Paid work orders today</span>
                      <span className="text-xl font-bold">{liveFees?.paidWorkOrdersToday || 0}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                      <span className="text-stone-400 text-sm">Paid work orders this week</span>
                      <span className="text-xl font-bold">{liveFees?.paidWorkOrdersThisWeek || 0}</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center">
                    <span className="text-stone-500 text-sm">Total paid work orders</span>
                    <span className="text-xl font-bold text-emerald-400">{liveFees?.totalPaidWorkOrders || 0}</span>
                  </div>
                </GlassCard>
              </div>

              {/* Financial Quick View */}
              <div className="lg:col-span-1">
                <GlassCard title="Revenue" icon="$">
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20">
                      <div className="text-sm text-emerald-400/70 mb-1">Today</div>
                      <div className="text-3xl font-bold text-emerald-400">{formatCurrency(data?.financials.todayRevenue || 0)}</div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1 p-3 rounded-xl bg-white/5 border border-white/5">
                        <div className="text-xs text-stone-500 mb-1">This Week</div>
                        <div className="text-lg font-semibold">{formatCurrency(data?.financials.weekRevenue || 0)}</div>
                      </div>
                      <div className="flex-1 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                        <div className="text-xs text-yellow-400/70 mb-1">Pending</div>
                        <div className="text-lg font-semibold text-yellow-400">{formatCurrency(data?.financials.pendingPayments.amount || 0)}</div>
                      </div>
                    </div>
                  </div>
                  <Link href="/admin/revenue" className="mt-4 flex items-center justify-center gap-2 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-stone-400 hover:text-white transition-all">
                    View Details <span><FaArrowRight style={{marginRight:4}} /></span>
                  </Link>
                </GlassCard>
              </div>
            </div>

            {/* Secondary Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Active Employees */}
              <GlassCard title="Currently Working" icon="*" badge={data?.realTimeOps.clockedInNow || 0}>
                {data?.realTimeOps.clockedInDetails && data.realTimeOps.clockedInDetails.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                    {data.realTimeOps.clockedInDetails.map((emp, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                            <span className="text-emerald-400 font-semibold">{emp.name.charAt(0)}</span>
                          </div>
                          <div>
                            <div className="font-medium">{emp.name}</div>
                            <div className="text-xs text-stone-500">{emp.shop}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-stone-400">Since {formatTime(emp.since)}</div>
                          {emp.onBreak && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">Break</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-stone-500">
                    <span className="text-4xl mb-2 opacity-20"><FaRegCircle style={{marginRight:4}} /></span>
                    <span>No active employees</span>
                  </div>
                )}
              </GlassCard>

              {/* Shop Health */}
              <GlassCard title="Shop Health" icon="">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <div className="text-3xl font-bold">{liveShopMetrics?.totalShops ?? data?.businessMetrics?.totalShopsCreated ?? data?.shopHealth.totalApproved ?? 0}</div>
                    <div className="text-xs text-stone-500">Total Shops</div>
                  </div>
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="text-3xl font-bold text-emerald-400">{liveShopMetrics?.activeShops ?? data?.shopHealth.activeThisWeek ?? 0}</div>
                    <div className="text-xs text-emerald-400/70">Active</div>
                  </div>
                  <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                    <div className="text-3xl font-bold text-yellow-400">{pendingApprovalsCount}</div>
                    <div className="text-xs text-yellow-400/70">Pending Approval</div>
                  </div>
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                    <div className="text-3xl font-bold text-red-400">{liveShopMetrics?.inactiveShops ?? data?.shopHealth.inactiveShops ?? 0}</div>
                    <div className="text-xs text-red-400/70">Inactive</div>
                  </div>
                </div>
                {(liveInactiveShops.length > 0 || (data?.shopHealth.inactiveList && data.shopHealth.inactiveList.length > 0)) && (
                  <div className="pt-3 border-t border-white/5">
                    <div className="text-xs text-stone-500 mb-2">Inactive shops needing outreach:</div>
                    <div className="flex flex-wrap gap-2">
                      {(liveInactiveShops.length > 0 ? liveInactiveShops : (data?.shopHealth.inactiveList || [])).slice(0, 5).map((shop: any, i: number) => (
                        <span key={i} className="px-2 py-1 rounded-lg bg-red-500/10 text-red-400 text-xs">{shop.shopName || shop.name}</span>
                      ))}
                    </div>
                  </div>
                )}
              </GlassCard>
            </div>
          </>
        )}

        {activeTab === 'operations' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GlassCard title="Work Order Status" icon="">
              <div className="space-y-4">
                {data?.realTimeOps.workOrdersByStatus && Object.entries(data.realTimeOps.workOrdersByStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-3">
                      <StatusDot status={status} />
                      <span className="capitalize font-medium">{status.replace('-', ' ')}</span>
                    </div>
                    <span className="text-2xl font-bold">{count}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-between">
                <span className="text-red-400">Overdue Work Orders</span>
                <span className="text-2xl font-bold text-red-400">{data?.realTimeOps.overdueWorkOrders || 0}</span>
              </div>
            </GlassCard>

            <GlassCard title="Service Types" icon="*">
              <div className="space-y-4">
                {data?.serviceBreakdown && Object.entries(data.serviceBreakdown).map(([type, count]) => {
                  const total = Object.values(data.serviceBreakdown).reduce((a, b) => a + b, 0);
                  const percentage = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <div key={type}>
                      <div className="flex justify-between mb-2">
                        <span className="capitalize text-stone-300">{type}</span>
                        <span className="font-semibold">{count}</span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </GlassCard>

            <GlassCard title="Appointments" icon="o">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 rounded-xl bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20 text-center">
                  <div className="text-4xl font-bold text-orange-400 mb-1">{data?.realTimeOps.todayAppointments || 0}</div>
                  <div className="text-sm text-orange-400/70">Scheduled Today</div>
                </div>
                <div className="p-6 rounded-xl bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-500/20 text-center">
                  <div className="text-4xl font-bold text-red-400 mb-1">{data?.realTimeOps.noShowsThisWeek || 0}</div>
                  <div className="text-sm text-red-400/70">No-Shows (Week)</div>
                </div>
              </div>
            </GlassCard>

            <GlassCard title="Customer Feedback" icon="">
              <div className="flex items-center gap-6 mb-6">
                <div className="text-center">
                  <div className="text-5xl font-bold text-yellow-400">{data?.reviews.averageRating || 0}</div>
                  <div className="text-yellow-400 mt-1">{Array.from({length: Math.round(data?.reviews.averageRating || 0)}, (_, i) => <FaStar key={i} />)}</div>
                </div>
                <div className="flex-1">
                  <div className="text-stone-500 text-sm">Based on</div>
                  <div className="text-2xl font-semibold">{data?.reviews.totalReviews || 0} reviews</div>
                </div>
              </div>
              {data?.reviews.recentBadReviews && data.reviews.recentBadReviews.length > 0 && (
                <div className="pt-4 border-t border-white/5">
                  <div className="text-xs text-red-400 mb-3"><FaExclamationTriangle style={{marginRight:4}} /> Recent Low Ratings</div>
                  <div className="space-y-2">
                    {data.reviews.recentBadReviews.slice(0, 3).map((review: any, i: number) => (
                      <div key={i} className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                        <div className="flex justify-between mb-1">
                          <span className="text-red-400 text-sm">{Array.from({length: review.rating}, (_, i) => <FaStar key={i} />)}{Array.from({length: 5 - review.rating}, (_, i) => <FaRegStar key={i} />)}</span>
                          <span className="text-xs text-stone-500">{review.shop}</span>
                        </div>
                        {review.comment && <div className="text-xs text-stone-400 truncate">{review.comment}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </GlassCard>
          </div>
        )}

        {activeTab === 'shops' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GlassCard title="Shop Overview" icon="">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 rounded-xl bg-white/5 border border-white/5 text-center">
                  <div className="text-4xl font-bold mb-1">{liveShopMetrics?.totalShops ?? data?.businessMetrics?.totalShopsCreated ?? data?.shopHealth.totalApproved ?? 0}</div>
                  <div className="text-sm text-stone-500">Total Shops</div>
                </div>
                <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <div className="text-4xl font-bold text-emerald-400 mb-1">{liveShopMetrics?.activeShops ?? data?.shopHealth.activeThisWeek ?? 0}</div>
                  <div className="text-sm text-emerald-400/70">Active</div>
                </div>
                <div className="p-6 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-center">
                  <div className="text-4xl font-bold text-yellow-400 mb-1">{liveShopMetrics?.pendingShops ?? data?.shopHealth.pendingApproval ?? 0}</div>
                  <div className="text-sm text-yellow-400/70">Pending</div>
                </div>
                <div className="p-6 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                  <div className="text-4xl font-bold text-red-400 mb-1">{liveShopMetrics?.inactiveShops ?? data?.shopHealth.inactiveShops ?? 0}</div>
                  <div className="text-sm text-red-400/70">Inactive</div>
                </div>
              </div>
            </GlassCard>

            <GlassCard title="Pending Approvals" icon="">
              {data?.shopHealth.pendingShops && data.shopHealth.pendingShops.length > 0 ? (
                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                  {data.shopHealth.pendingShops.map((shop: any, i: number) => (
                    <div key={i} className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-medium">{shop.shopName || 'Unnamed Shop'}</div>
                        <span className="text-xs text-yellow-400">{shop.shopType}</span>
                      </div>
                      <div className="text-sm text-stone-500">{shop.ownerName}</div>
                      <div className="text-xs text-stone-600">{shop.email}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-stone-500">
                  <span className="text-4xl mb-2 opacity-20"><FaCheck style={{marginRight:4}} /></span>
                  <span>No pending approvals</span>
                </div>
              )}
              {(data?.shopHealth?.pendingApproval || 0) > 0 && (
                <Link href="/admin/pending-shops" className="mt-4 flex items-center justify-center gap-2 py-3 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 font-medium transition-all">
                  Review Approvals <FaArrowRight style={{marginRight:4}} />
                </Link>
              )}
            </GlassCard>

            <GlassCard title="Inactive Shops" icon="" className="lg:col-span-2">
              {liveInactiveShops.length > 0 || (data?.shopHealth.inactiveList && data.shopHealth.inactiveList.length > 0) ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(liveInactiveShops.length > 0 ? liveInactiveShops : (data?.shopHealth.inactiveList || [])).map((shop: any, i: number) => (
                    <div key={i} className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                      <div className="font-medium text-red-400">{shop.shopName || shop.name}</div>
                      <div className="text-xs text-stone-500 mt-1">{shop.email}</div>
                      <div className="text-xs text-red-400/50 mt-2">No recent activity</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-stone-500">
                  <span className="text-4xl mb-2 opacity-20"><FaCheck style={{marginRight:4}} /></span>
                  <span>All shops are active</span>
                </div>
              )}
            </GlassCard>
          </div>
        )}

        {activeTab === 'team' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <GlassCard title="FixTray Staff" icon="">
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex justify-between items-center">
                  <span className="text-stone-400">Total Employees</span>
                  <span className="text-2xl font-bold">{data?.staffTeam.totalStaff || 0}</span>
                </div>
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex justify-between items-center">
                  <span className="text-emerald-400">Active Employees</span>
                  <span className="text-2xl font-bold text-emerald-400">{data?.staffTeam.activeStaff || 0}</span>
                </div>
                <div className="p-4 rounded-xl bg-[#e5332a]/100/10 border border-[#e5332a]/20 flex justify-between items-center">
                  <span className="text-[#ff6b64]">Inactive Employees</span>
                  <span className="text-2xl font-bold text-[#ff6b64]">{data?.staffTeam.inactiveStaff || 0}</span>
                </div>
                <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex justify-between items-center">
                  <span className="text-cyan-400">Live Sessions</span>
                  <span className="text-2xl font-bold text-cyan-400">{data?.staffTeam.staffWithLiveSession || 0}</span>
                </div>
                <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20 flex justify-between items-center">
                  <span className="text-violet-400">New This Month</span>
                  <span className="text-2xl font-bold text-violet-400">{data?.staffTeam.newThisMonth || 0}</span>
                </div>
              </div>
            </GlassCard>

            <GlassCard title="FixTray Employee Directory" icon="*" className="lg:col-span-2" badge={data?.staffTeam.members?.length || 0}>
              {data?.staffTeam.members && data.staffTeam.members.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto custom-scrollbar">
                  {data.staffTeam.members.map((emp, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/5">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                        <span className="text-lg text-cyan-400 font-semibold">{emp.username.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium flex items-center gap-2">
                          {emp.username}
                          {emp.isOwner && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">Owner</span>}
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300">FixTray Admin</span>
                        </div>
                        <div className="text-xs text-stone-500">{emp.email}</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-xs px-2 py-0.5 rounded-full ${emp.activityStatus === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                          {emp.activityStatus}
                        </div>
                        <div className="text-[11px] text-stone-500 mt-1">
                          {emp.lastLogin ? `Last login ${formatTime(emp.lastLogin)}` : 'No login data'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-stone-500">
                  <span className="text-5xl mb-3 opacity-20"><FaRegCircle style={{marginRight:4}} /></span>
                  <span>No FixTray employees found</span>
                </div>
              )}
            </GlassCard>

            <GlassCard title="Create FixTray Employee" icon="*" className="lg:col-span-3">
              {user?.isOwner ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-1">
                      <label className="text-xs text-stone-400 block mb-1">Username</label>
                      <input
                        value={employeeForm.username}
                        onChange={(e) => setEmployeeForm((prev) => ({ ...prev, username: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm"
                        placeholder="fixtray.employee"
                      />
                    </div>
                    <div className="md:col-span-1">
                      <label className="text-xs text-stone-400 block mb-1">Email</label>
                      <input
                        type="email"
                        value={employeeForm.email}
                        onChange={(e) => setEmployeeForm((prev) => ({ ...prev, email: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm"
                        placeholder="employee@fixtray.app"
                      />
                    </div>
                    <div className="md:col-span-1">
                      <label className="text-xs text-stone-400 block mb-1">Temporary Password</label>
                      <input
                        type="password"
                        value={employeeForm.password}
                        onChange={(e) => setEmployeeForm((prev) => ({ ...prev, password: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm"
                        placeholder="Minimum 8 characters"
                      />
                    </div>
                    <div className="md:col-span-1 flex items-end gap-3">
                      <button
                        onClick={createEmployee}
                        disabled={isCreatingEmployee}
                        className="px-4 py-2 rounded-xl bg-[#e5332a]/90 hover:bg-[#e5332a] text-white text-sm font-semibold disabled:opacity-60"
                      >
                        {isCreatingEmployee ? 'Creating...' : 'Create Employee'}
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-stone-400">
                    This Team tab is for FixTray internal staff accounts only. New employees are created as FixTray Admin and use the FixTray dashboard.
                  </div>
                </>
              ) : (
                <div className="text-sm text-stone-400">
                  Only the FixTray Owner (supadm) can create FixTray Admin employees.
                </div>
              )}
              {teamMessage && (
                <div className={`mt-3 text-sm ${teamMessage.toLowerCase().includes('success') ? 'text-emerald-400' : 'text-red-400'}`}>
                  {teamMessage}
                </div>
              )}
              <Link href="/admin/user-management" className="mt-4 inline-flex items-center gap-2 text-sm text-cyan-300 hover:text-cyan-200">
                Open full user management <FaExternalLinkAlt style={{marginRight:4}} />
              </Link>
            </GlassCard>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 flex items-center justify-between text-xs text-stone-600">
          <div>Last updated: {lastUpdate?.toLocaleString()}</div>
          <div className="flex items-center gap-4">
            <Link href="/admin/home" className="hover:text-stone-400 transition-colors">Dashboard</Link>
            <Link href="/admin/revenue" className="hover:text-stone-400 transition-colors">Revenue</Link>
            <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer" className="hover:text-stone-400 transition-colors">Stripe</a>
          </div>
        </div>
      </main>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.2);
        }
      `}</style>
    </div>
  );
}

function MetricCard({ label, value, sublabel, color, icon, pulse, isString }: {
  label: string;
  value: number | string;
  sublabel: string;
  color: string;
  icon: string;
  pulse?: boolean;
  isString?: boolean;
}) {
  const colors: Record<string, string> = {
    emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-400',
    blue: 'from-blue-500/20 to-blue-500/5 border-[#e5332a]/20 text-[#ff6b64]',
    violet: 'from-violet-500/20 to-violet-500/5 border-violet-500/20 text-violet-400',
    green: 'from-green-500/20 to-green-500/5 border-green-500/20 text-green-400',
    orange: 'from-orange-500/20 to-orange-500/5 border-orange-500/20 text-orange-400',
    cyan: 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/20 text-cyan-400',
  };

  return (
    <div className={`relative p-4 rounded-2xl bg-gradient-to-br ${colors[color]} border backdrop-blur-sm overflow-hidden`}>
      {pulse && (
        <div className="absolute top-3 right-3 w-2 h-2 bg-current rounded-full animate-pulse"></div>
      )}
      <div className="text-xs text-stone-400 mb-1 flex items-center gap-1">
        <span className="opacity-50">{icon}</span>
        {label}
      </div>
      <div className={`text-2xl font-bold ${isString ? '' : ''}`}>{value}</div>
      <div className="text-xs text-stone-500">{sublabel}</div>
    </div>
  );
}

function GlassCard({ title, icon, children, badge, className = '' }: {
  title: string;
  icon: string;
  children: React.ReactNode;
  badge?: number;
  className?: string;
}) {
  return (
    <div className={`p-5 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-sm ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-stone-400">{icon}</span>
          <h3 className="font-semibold text-stone-200">{title}</h3>
        </div>
        {badge !== undefined && (
          <span className="px-2 py-1 rounded-lg bg-white/5 text-xs font-medium text-stone-400">{badge}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function StatusBar({ status, count, total }: { status: string; count: number; total: number }) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  const colors: Record<string, string> = {
    pending: 'bg-yellow-500',
    'in-progress': 'bg-[#e5332a]/100',
    completed: 'bg-emerald-500',
    cancelled: 'bg-red-500',
    'on-hold': 'bg-purple-500',
  };

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="capitalize text-stone-400">{status.replace('-', ' ')}</span>
        <span className="font-medium">{count}</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${colors[status] || 'bg-stone-500'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-500',
    'in-progress': 'bg-[#e5332a]/100',
    completed: 'bg-emerald-500',
    cancelled: 'bg-red-500',
    'on-hold': 'bg-purple-500',
  };

  return (
    <span className={`w-3 h-3 rounded-full ${colors[status] || 'bg-stone-500'}`}></span>
  );
}











