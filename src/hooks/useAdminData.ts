import { useEffect, useState, useCallback } from 'react';
import { useRequireAuth } from '@/contexts/AuthContext';

interface UserData {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status?: string;
  createdAt: string;
  lastLogin?: string;
  shopId?: string;
  totalOrders?: number;
  totalSpent?: number;
  lastOrderDate?: string;
  completedJobs?: number;
  totalJobs?: number;
  completionRate?: number;
  totalRevenue?: number;
}

interface UsersLiveMetrics {
  totalUsers: number;
  totalCustomers: number;
  totalTechs: number;
  totalShopOwners: number;
  newUsersThisMonth: number;
  newUsersLastMonth: number;
  newUsersThisWeek: number;
  userGrowth: string;
  activeUsers: number;
  activeRate: string;
  availableTechs: number;
  techAvailabilityRate: string;
  activeCustomers: number;
  customerEngagementRate: string;
  roleDistribution: Record<string, number>;
  userTrend: number[];
  activityHeatmap: number[][];
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  retentionRate: string;
  churnRate: string;
  featureAdoptionRate: number;
  onboardingRate: number;
  powerUserRate: number;
  powerUsers: number;
  onboardedUsers: number;
  dauMauRatio: number;
  avgCustomerValue: number;
  customerSatisfaction: number;
  totalReviewCount: number;
  totalWorkOrders: number;
  completedWorkOrders: number;
  accountVerificationRate: number | null;
  profileCompletionRate: number;
  onboardingCompletionRate: number;
  twoFactorAuthRate: number | null;
  activeSessions: number;
  failedLogins: number | null;
  accountLockouts: number | null;
  securityAlerts: number | null;
}

interface ShopsLiveMetrics {
  totalShops: number;
  activeShops: number;
  inactiveShops: number;
  approvedShops: number;
  pendingShops: number;
  suspendedShops: number;
  newShopsThisMonth: number;
  newShopsLastMonth: number;
  shopGrowth: string;
  totalUsers: number;
  totalCapacity: number;
  utilizationRate: string;
  avgTeamSize: number;
  totalPlatformRevenue: number;
  totalRevenueThisMonth: number;
  avgRevenuePerShop: number;
  totalJobs: number;
  completedJobs: number;
  avgCompletionRate: string;
  completedThisMonth: number;
  weeklyJobTrend: number[];
  serviceDistribution: Array<{ name: string; count: number; percentage: number }>;
  servicesToday: number;
  revenueToday: number;
  avgResponseTime: string;
  avgResponseMinutes: number;
  customerRating: number;
  totalReviews: number;
  jobCompletionRate: number;
  efficiencyRate: number;
  firstTimeFixRate: number;
  pendingActions: {
    shopApplications: number;
    pendingWorkOrders: number;
    customerMessages: number;
    overdueWorkOrders: number;
  };
}

interface PlatformStats {
  totalRevenue: string;
  totalShops: number;
  totalJobs: number;
  activeUsers: number;
  pendingShops: number;
  systemHealth: number | null;
  monthlyRevenue: string;
}

interface WeeklyOverview {
  weekStart: string;
  weekEnd: string;
  newClientsByDay: number[];
  totalNewClientsThisWeek: number;
}

interface ThreeMonthAverages {
  avgNewClientsPerMonth: number;
  avgJobIncomePerMonth: string;
  churnRate: string;
  churnRateRaw: number;
  totalClientsLast3Months: number;
  totalJobIncomeLast3Months: string;
}

interface LiveMetrics {
  revenueTrend: number[];
  revenueGrowth: string;
  monthOverMonthGrowth: string;
  avgRating: string;
  reviewsCount: number;
  websiteVisits: number;
  trialsCount: number;
  membersCount: number;
  convertedCustomersCount: number;
  totalShopsEver: number;
  trialSignups: number;
  activeTrials: number;
  convertedCustomers: number;
  conversionRate: string;
  weeklyConversionTrend: { label: string; value: number }[];
}

interface InfraHealth {
  heartbeat: 'online' | 'degraded' | 'offline';
  apiLatencyMs: number | null;
  statsLatencyMs: number | null;
  uptimeSeconds: number | null;
  lastHeartbeatAt: number | null;
  heartbeatAgeSeconds: number | null;
  dbConnected: boolean | null;
  dbCheckedAt: number | null;
  dbLastIssueAt: number | null;
  dbLastIssueAgeSeconds: number | null;
  dbStatusMessage: string | null;
}

interface TimedFetchResult {
  response: Response | null;
  latencyMs: number;
}

interface AdminShopRow {
  id: string;
  name: string;
  location: string;
  status: string;
  activityStatus?: 'active' | 'inactive';
  totalJobs?: number;
  completionRate?: number;
  totalRevenue?: number;
  revenueThisMonth?: number;
  jobsThisMonth?: number;
  rating?: number;
  techCount?: number;
  activeTechs?: number;
}

interface AdminShopsPayload {
  success: boolean;
  shops: AdminShopRow[];
  liveMetrics?: {
    totalShops: number;
    activeShops: number;
    inactiveShops: number;
    approvedShops: number;
    pendingShops: number;
    suspendedShops: number;
    newShopsThisMonth: number;
    newShopsLastMonth: number;
    shopGrowth: string;
    totalPlatformRevenue: number;
    revenueThisMonth: number;
    totalJobs: number;
    totalJobsThisMonth: number;
    jobsGrowth: string;
    shopTrend: number[];
  };
}

export function useAdminData() {
  const { user: _user } = useRequireAuth(['admin', 'superadmin']);
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [platformStats, setPlatformStats] = useState<PlatformStats>({
    totalRevenue: 'Unavailable',
    totalShops: 0,
    totalJobs: 0,
    activeUsers: 0,
    pendingShops: 0,
    systemHealth: null,
    monthlyRevenue: 'Unavailable',
  });

  const [planDistribution, setPlanDistribution] = useState<Record<string, number>>({});
  const [weeklyOverview, setWeeklyOverview] = useState<WeeklyOverview>({
    weekStart: '',
    weekEnd: '',
    newClientsByDay: [0, 0, 0, 0, 0, 0, 0],
    totalNewClientsThisWeek: 0,
  });
  const [threeMonthAverages, setThreeMonthAverages] = useState<ThreeMonthAverages>({
    avgNewClientsPerMonth: 0,
    avgJobIncomePerMonth: 'Unavailable',
    churnRate: 'Unavailable',
    churnRateRaw: 0,
    totalClientsLast3Months: 0,
    totalJobIncomeLast3Months: 'Unavailable',
  });
  const [liveMetrics, setLiveMetrics] = useState<LiveMetrics>({
    revenueTrend: [],
    revenueGrowth: 'Unavailable',
    monthOverMonthGrowth: 'Unavailable',
    avgRating: '0.0',
    reviewsCount: 0,
    websiteVisits: 0,
    trialsCount: 0,
    membersCount: 0,
    convertedCustomersCount: 0,
    totalShopsEver: 0,
    trialSignups: 0,
    activeTrials: 0,
    convertedCustomers: 0,
    conversionRate: 'Unavailable',
    weeklyConversionTrend: [],
  });

  const [allUsers, setAllUsers] = useState<UserData[]>([]);
  const [pendingShops, setPendingShops] = useState<any[]>([]);
  const [approvedShops, setApprovedShops] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [usersLiveMetrics, setUsersLiveMetrics] = useState<UsersLiveMetrics | null>(null);
  const [shopsLiveMetrics, setShopsLiveMetrics] = useState<ShopsLiveMetrics | null>(null);
  const [infraHealth, setInfraHealth] = useState<InfraHealth>({
    heartbeat: 'offline',
    apiLatencyMs: null,
    statsLatencyMs: null,
    uptimeSeconds: null,
    lastHeartbeatAt: null,
    heartbeatAgeSeconds: null,
    dbConnected: null,
    dbCheckedAt: null,
    dbLastIssueAt: null,
    dbLastIssueAgeSeconds: null,
    dbStatusMessage: null,
  });

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('token');
      setToken(storedToken);
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (!token) return;

    const headers: Record<string, string> = {};
    headers.Authorization = `Bearer ${token}`;

    const timedFetch = async (url: string, init?: RequestInit): Promise<TimedFetchResult> => {
      const start = Date.now();
      try {
        const response = await fetch(url, init);
        return { response, latencyMs: Date.now() - start };
      } catch {
        return { response: null, latencyMs: Date.now() - start };
      }
    };

    try {
      const [healthResult, statsResult, commandCenterRes, adminShopsRes, usersRes] = await Promise.all([
        timedFetch('/api/health', { cache: 'no-store', credentials: 'include' }),
        timedFetch('/api/admin/stats', { cache: 'no-store', credentials: 'include', headers }),
        fetch('/api/admin/command-center', { cache: 'no-store', credentials: 'include', headers }),
        fetch('/api/admin/shops', { cache: 'no-store', credentials: 'include', headers }),
        fetch('/api/admin/users', { cache: 'no-store', credentials: 'include', headers }),
      ]);

      const healthRes = healthResult.response;
      const statsRes = statsResult.response;
      let commandCenterPendingActions = {
        shopApplications: 0,
        pendingWorkOrders: 0,
        customerMessages: 0,
        overdueWorkOrders: 0,
      };

      if (healthRes?.ok) {
        const healthData = await healthRes.json();
        const dbConnected = healthData?.db?.connected === true;
        const heartbeat: InfraHealth['heartbeat'] =
          !dbConnected
            ? 'offline'
            : healthResult.latencyMs > 1200
            ? 'degraded'
            : 'online';

        setInfraHealth({
          heartbeat,
          apiLatencyMs: healthResult.latencyMs,
          statsLatencyMs: statsResult.response ? statsResult.latencyMs : null,
          uptimeSeconds: typeof healthData?.db?.healthyForSeconds === 'number' ? healthData.db.healthyForSeconds : null,
          lastHeartbeatAt: typeof healthData.timestamp === 'number' ? healthData.timestamp : Date.now(),
          heartbeatAgeSeconds:
            typeof healthData.timestamp === 'number'
              ? Math.max(0, Math.round((Date.now() - healthData.timestamp) / 1000))
              : null,
          dbConnected,
          dbCheckedAt: typeof healthData?.db?.checkedAt === 'number' ? healthData.db.checkedAt : null,
          dbLastIssueAt: typeof healthData?.db?.lastIssueAt === 'number' ? healthData.db.lastIssueAt : null,
          dbLastIssueAgeSeconds: typeof healthData?.db?.lastIssueAgeSeconds === 'number' ? healthData.db.lastIssueAgeSeconds : null,
          dbStatusMessage: typeof healthData?.db?.statusMessage === 'string' ? healthData.db.statusMessage : null,
        });
      } else {
        setInfraHealth({
          heartbeat: 'offline',
          apiLatencyMs: healthResult.latencyMs,
          statsLatencyMs: statsResult.response ? statsResult.latencyMs : null,
          uptimeSeconds: null,
          lastHeartbeatAt: null,
          heartbeatAgeSeconds: null,
          dbConnected: false,
          dbCheckedAt: null,
          dbLastIssueAt: null,
          dbLastIssueAgeSeconds: null,
          dbStatusMessage: 'Health endpoint unavailable',
        });
      }

      if (statsRes?.ok) {
        const statsData = await statsRes.json();
        setPlatformStats({
          totalRevenue: statsData.totalRevenue || 'Unavailable',
          totalShops: statsData.totalShops || 0,
          totalJobs: statsData.totalJobs || 0,
          activeUsers: statsData.activeUsers || 0,
          pendingShops: statsData.pendingShops || 0,
          systemHealth: statsData.systemHealth ?? null,
          monthlyRevenue: statsData.monthlyRevenue || 'Unavailable',
        });

        if (statsData.recentActivity) setRecentActivity(statsData.recentActivity);
        if (statsData.planDistribution) setPlanDistribution(statsData.planDistribution);
        if (statsData.weeklyOverview) setWeeklyOverview(statsData.weeklyOverview);
        if (statsData.threeMonthAverages) setThreeMonthAverages(statsData.threeMonthAverages);
        if (statsData.liveMetrics) setLiveMetrics(statsData.liveMetrics);
      }

      if (commandCenterRes.ok) {
        const commandCenterData = await commandCenterRes.json();
        if (commandCenterData?.success) {
          commandCenterPendingActions = {
            shopApplications: commandCenterData?.shopHealth?.pendingApproval || 0,
            pendingWorkOrders: commandCenterData?.realTimeOps?.activeWorkOrders || 0,
            customerMessages: commandCenterData?.communication?.unreadAdminMessages || 0,
            overdueWorkOrders: commandCenterData?.realTimeOps?.overdueWorkOrders || 0,
          };
        }
      }

      if (adminShopsRes.ok) {
        const shopsData: AdminShopsPayload = await adminShopsRes.json();
        if (shopsData?.success && Array.isArray(shopsData.shops)) {
          const allShops = shopsData.shops;
          const approved = allShops.filter((shop) => shop.status === 'approved');
          const pending = allShops.filter((shop) => shop.status === 'pending');

          // Keep full lists for downstream cards/tables; do not truncate to a preview subset.
          setPendingShops(pending);
          setApprovedShops(
            approved.map((shop) => ({
              ...shop,
              shopName: shop.name,
              jobs: shop.totalJobs || 0,
              revenue: `$${(shop.totalRevenue || 0).toLocaleString()}`,
            }))
          );

          const totalTechs = allShops.reduce((sum, shop) => sum + (shop.techCount || 0), 0);
          const activeTechs = allShops.reduce((sum, shop) => sum + (shop.activeTechs || 0), 0);
          const avgTeamSize = allShops.length > 0 ? Number((totalTechs / allShops.length).toFixed(1)) : 0;
          const totalJobs = allShops.reduce((sum, shop) => sum + (shop.totalJobs || 0), 0);
          const avgCompletionRate = totalJobs > 0
            ? `${Math.round(allShops.reduce((sum, shop) => sum + ((shop.totalJobs || 0) * ((shop.completionRate || 0) / 100)), 0) / totalJobs * 100)}%`
            : '0%';
          const ratingBase = approved.filter((shop) => (shop.rating || 0) > 0);
          const customerRating = ratingBase.length > 0
            ? Number((ratingBase.reduce((sum, shop) => sum + (shop.rating || 0), 0) / ratingBase.length).toFixed(1))
            : 0;

          const sourceMetrics = shopsData.liveMetrics;
          setShopsLiveMetrics({
            totalShops: sourceMetrics?.totalShops ?? allShops.length,
            activeShops: sourceMetrics?.activeShops ?? allShops.filter((shop) => shop.activityStatus === 'active').length,
            inactiveShops: sourceMetrics?.inactiveShops ?? allShops.filter((shop) => (shop.activityStatus || 'inactive') === 'inactive').length,
            approvedShops: sourceMetrics?.approvedShops ?? approved.length,
            pendingShops: sourceMetrics?.pendingShops ?? pending.length,
            suspendedShops: sourceMetrics?.suspendedShops ?? allShops.filter((shop) => shop.status === 'suspended').length,
            newShopsThisMonth: sourceMetrics?.newShopsThisMonth ?? 0,
            newShopsLastMonth: sourceMetrics?.newShopsLastMonth ?? 0,
            shopGrowth: sourceMetrics?.shopGrowth ?? '0%',
            totalUsers: totalTechs,
            totalCapacity: totalTechs,
            utilizationRate: `${totalTechs > 0 ? Math.round((activeTechs / totalTechs) * 100) : 0}%`,
            avgTeamSize,
            totalPlatformRevenue: sourceMetrics?.totalPlatformRevenue ?? allShops.reduce((sum, shop) => sum + (shop.totalRevenue || 0), 0),
            totalRevenueThisMonth: sourceMetrics?.revenueThisMonth ?? allShops.reduce((sum, shop) => sum + (shop.revenueThisMonth || 0), 0),
            avgRevenuePerShop: allShops.length > 0
              ? Math.round((sourceMetrics?.totalPlatformRevenue ?? allShops.reduce((sum, shop) => sum + (shop.totalRevenue || 0), 0)) / allShops.length)
              : 0,
            totalJobs: sourceMetrics?.totalJobs ?? totalJobs,
            completedJobs: Math.round(totalJobs * (parseInt(avgCompletionRate, 10) / 100 || 0)),
            avgCompletionRate,
            completedThisMonth: sourceMetrics?.totalJobsThisMonth ?? allShops.reduce((sum, shop) => sum + (shop.jobsThisMonth || 0), 0),
            weeklyJobTrend: sourceMetrics?.shopTrend ?? [],
            serviceDistribution: [],
            servicesToday: 0,
            revenueToday: 0,
            avgResponseTime: 'Unavailable',
            avgResponseMinutes: 0,
            customerRating,
            totalReviews: ratingBase.length,
            jobCompletionRate: parseInt(avgCompletionRate, 10) || 0,
            efficiencyRate: 0,
            firstTimeFixRate: 0,
            pendingActions: {
              shopApplications: commandCenterPendingActions.shopApplications || sourceMetrics?.pendingShops || pending.length,
              pendingWorkOrders: commandCenterPendingActions.pendingWorkOrders,
              customerMessages: commandCenterPendingActions.customerMessages,
              overdueWorkOrders: commandCenterPendingActions.overdueWorkOrders,
            },
          });
        }
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setAllUsers(usersData.users || []);
        if (usersData.liveMetrics) setUsersLiveMetrics(usersData.liveMetrics);
      }

      setDataLoaded(true);
    } catch (error) {
      console.error('Error fetching admin data:', error);
      setDataLoaded(true);
    }
  }, [token]);

  useEffect(() => {
    if (mounted && token) fetchData();
  }, [mounted, token, fetchData]);

  useEffect(() => {
    if (!mounted || !token) return;

    const intervalId = setInterval(() => {
      fetchData();
    }, 2 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [mounted, token, fetchData]);

  return {
    platformStats,
    allUsers,
    pendingShops,
    approvedShops,
    recentActivity,
    planDistribution,
    weeklyOverview,
    threeMonthAverages,
    liveMetrics,
    usersLiveMetrics,
    shopsLiveMetrics,
    infraHealth,
    dataLoaded,
  };
}
