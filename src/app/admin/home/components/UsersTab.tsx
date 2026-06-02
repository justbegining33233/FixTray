'use client';
import { FaArrowRight, FaArrowUp, FaCrown } from 'react-icons/fa';

import React from 'react';

interface UserData {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  createdAt: string;
  lastLogin?: string;
  status?: string;
  shopId?: string;
  // Role-specific metrics
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
  // Adoption metrics
  featureAdoptionRate?: number;
  onboardingRate?: number;
  powerUserRate?: number;
  powerUsers?: number;
  onboardedUsers?: number;
  dauMauRatio?: number;
  // Customer metrics
  avgCustomerValue?: number;
  customerSatisfaction?: number;
  totalReviewCount?: number;
  totalWorkOrders?: number;
  completedWorkOrders?: number;
  // User health indicators
  accountVerificationRate?: number | null;
  profileCompletionRate?: number;
  onboardingCompletionRate?: number;
  twoFactorAuthRate?: number | null;
  // Security metrics
  activeSessions?: number;
  failedLogins?: number | null;
  accountLockouts?: number | null;
  securityAlerts?: number | null;
}

interface UsersTabProps {
  users: UserData[];
  liveMetrics?: UsersLiveMetrics | null;
}

// Chart Components
function MiniLineChart({ data, color, height = 40 }: { data: number[]; color: string; height?: number }) {
  if (!data.length) {
    data = [0, 0];
  }
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
        <linearGradient id={`user-gradient-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke={color} strokeWidth="2" points={points} strokeLinecap="round" strokeLinejoin="round" />
      <polygon fill={`url(#user-gradient-${color.replace('#', '')})`} points={`0,${height} ${points} ${width},${height}`} />
    </svg>
  );
}

function DonutChart({ segments, size = 100 }: { segments: { value: number; color: string; label: string }[]; size?: number }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;

  const segmentsWithOffset = segments.reduce<{ segment: typeof segments[0]; offset: number }[]>((acc, segment) => {
    const prevOffset = acc.length > 0 ? acc[acc.length - 1].offset + acc[acc.length - 1].segment.value / total : 0;
    acc.push({ segment, offset: prevOffset });
    return acc;
  }, []);

  return (
    <div className="relative">
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#27272A" strokeWidth="12" />
        {segmentsWithOffset.map(({ segment, offset }, i) => {
          const strokeDasharray = `${(segment.value / total) * circumference} ${circumference}`;
          const rotation = offset * 360 - 90;
          return (
            <circle
              key={i}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth="12"
              strokeDasharray={strokeDasharray}
              strokeDashoffset="0"
              transform={`rotate(${rotation} 50 50)`}
              className="transition-all duration-700"
            />
          );
        })}
        <text x="50" y="46" textAnchor="middle" fill="#FAFAFA" fontSize="18" fontWeight="700">
          {total}
        </text>
        <text x="50" y="60" textAnchor="middle" fill="#71717A" fontSize="9">
          total users
        </text>
      </svg>
    </div>
  );
}

function ActivityHeatmap({ data }: { data: number[][] }) {
  const maxValue = Math.max(...data.flat());
  return (
    <div className="space-y-1">
      {data.map((week, weekIndex) => (
        <div key={weekIndex} className="flex gap-1">
          {week.map((value, dayIndex) => (
            <div
              key={dayIndex}
              className="w-3 h-3 rounded-sm transition-colors"
              style={{
                backgroundColor: value === 0 ? '#27272A' : `rgba(249, 115, 22, ${0.2 + (value / maxValue) * 0.8})`
              }}
              title={`${value} active users`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

const ROLE_CONFIG: Record<string, { name: string; icon: React.ReactNode; color: string; bgColor: string }> = {
  admin: { name: 'Admin', icon: <FaCrown style={{marginRight:4}} />, color: '#EF4444', bgColor: 'bg-[#EF4444]/10' },
  shop: { name: 'Shop Owner', icon: '', color: '#e5332a', bgColor: 'bg-[#e5332a]/10' },
  tech: { name: 'Technician', icon: '', color: '#22C55E', bgColor: 'bg-[#22C55E]/10' },
  manager: { name: 'Manager', icon: '', color: '#F97316', bgColor: 'bg-[#F97316]/10' },
  customer: { name: 'Customer', icon: '', color: '#8B5CF6', bgColor: 'bg-[#8B5CF6]/10' }
};

export function UsersTab({ users, liveMetrics }: UsersTabProps) {
  // Use live metrics from API if available, otherwise calculate from users array
  const totalUsers = liveMetrics?.totalUsers || users.length;
  const totalCustomers = liveMetrics?.totalCustomers || users.filter(u => u.role === 'customer').length;
  const _totalTechs = liveMetrics?.totalTechs || users.filter(u => u.role === 'tech' || u.role === 'manager').length;
  const totalShopOwners = liveMetrics?.totalShopOwners || users.filter(u => u.role === 'shop' || u.role === 'admin').length;
  
  const newUsersThisMonthCount = liveMetrics?.newUsersThisMonth || 0;
  const newUsersThisWeekCount = liveMetrics?.newUsersThisWeek || 0;
  const userGrowth = liveMetrics?.userGrowth || '+0%';
  
  const activeUsersCount = liveMetrics?.activeUsers || users.filter(u => u.status === 'active').length;
  const activeRate = liveMetrics?.activeRate || `${Math.round((activeUsersCount / Math.max(totalUsers, 1)) * 100)}%`;
  
  // Role distribution from live metrics
  const roleDistribution = liveMetrics?.roleDistribution || {
    customer: totalCustomers,
    tech: users.filter(u => u.role === 'tech').length,
    manager: users.filter(u => u.role === 'manager').length,
    shop: totalShopOwners,
  };

  const roleStats = Object.entries(ROLE_CONFIG)
    .map(([key, config]) => {
      const count = roleDistribution[key] || 0;
      return { key, ...config, count };
    })
    .filter(r => r.count > 0);

  // Use live trend data only.
  const userGrowthTrend = liveMetrics?.userTrend || [];
  const activeUsersTrend = liveMetrics?.activityHeatmap?.length
    ? liveMetrics.activityHeatmap[liveMetrics.activityHeatmap.length - 1]
    : [];
  
  // Activity heatmap from API or empty state
  const activityData = liveMetrics?.activityHeatmap || [
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0]
  ];

  const formatNullableMetric = (value?: number | null, suffix = '') => {
    if (value === null || value === undefined) {
      return 'Unavailable';
    }

    return `${value}${suffix}`;
  };

  // Engagement metrics from live data
  const engagementMetrics = {
    dailyActiveUsers: liveMetrics?.dailyActiveUsers ?? 0,
    weeklyActiveUsers: liveMetrics?.weeklyActiveUsers ?? 0,
    monthlyActiveUsers: liveMetrics?.monthlyActiveUsers ?? 0,
    featureAdoptionRate: liveMetrics?.featureAdoptionRate || 0,
    userRetentionRate: parseFloat(liveMetrics?.retentionRate?.replace('%', '') || '0'),
    churnRate: parseFloat(liveMetrics?.churnRate?.replace('%', '') || '0'),
    onboardingRate: liveMetrics?.onboardingRate || 0,
    powerUserRate: liveMetrics?.powerUserRate || 0,
    dauMauRatio: liveMetrics?.dauMauRatio || 0,
    customerSatisfaction: liveMetrics?.customerSatisfaction || 0,
    totalReviewCount: liveMetrics?.totalReviewCount || 0,
    avgCustomerValue: liveMetrics?.avgCustomerValue || 0,
    totalWorkOrders: liveMetrics?.totalWorkOrders || 0,
  };

  // Get recent users from the users array for the table
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const newUsersArray = users.filter(u => new Date(u.createdAt) >= thirtyDaysAgo);

  return (
    <div className="space-y-6">
      {/* Section 1: Key User Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-5 hover:border-[#3F3F46] transition-all duration-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-[#71717A] uppercase tracking-wider font-medium">Total Users</p>
              <p className="text-2xl font-bold text-[#FAFAFA] mt-1">{totalUsers}</p>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 bg-[#22C55E]/10 rounded-full">
              <svg className="w-3 h-3 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              <span className="text-xs font-medium text-[#22C55E]">{userGrowth}</span>
            </div>
          </div>
          <MiniLineChart data={userGrowthTrend} color="#22C55E" height={50} />
          <p className="text-[10px] text-[#52525B] mt-2">+{newUsersThisMonthCount} this month - +{newUsersThisWeekCount} this week</p>
        </div>

        <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-5 hover:border-[#3F3F46] transition-all duration-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-[#71717A] uppercase tracking-wider font-medium">Active Users</p>
              <p className="text-2xl font-bold text-[#FAFAFA] mt-1">{activeUsersCount}</p>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 bg-[#e5332a]/10 rounded-full">
              <svg className="w-3 h-3 text-[#e5332a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              <span className="text-xs font-medium text-[#e5332a]">{activeRate}</span>
            </div>
          </div>
          <MiniLineChart data={activeUsersTrend} color="#e5332a" height={50} />
          <p className="text-[10px] text-[#52525B] mt-2">Weekly active users</p>
        </div>

        <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-5 hover:border-[#3F3F46] transition-all duration-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-[#71717A] uppercase tracking-wider font-medium">Retention Rate</p>
              <p className="text-2xl font-bold text-[#FAFAFA] mt-1">{engagementMetrics.userRetentionRate}%</p>
              <p className="text-xs text-[#22C55E] mt-1"><FaArrowUp style={{marginRight:4}} /> Live 30-day rate</p>
            </div>
            <div className="w-16 h-16 rounded-full border-4 border-[#8B5CF6] flex items-center justify-center">
              <span className="text-sm font-bold text-[#8B5CF6]">{engagementMetrics.userRetentionRate}%</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-[#27272A]">
            <div>
              <p className="text-[10px] text-[#52525B]">Churn Rate</p>
              <p className="text-sm font-medium text-[#EF4444]">{engagementMetrics.churnRate}%</p>
            </div>
            <div>
              <p className="text-[10px] text-[#52525B]">New This Week</p>
              <p className="text-sm font-medium text-[#22C55E]">{newUsersThisWeekCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-5 hover:border-[#3F3F46] transition-all duration-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-[#71717A] uppercase tracking-wider font-medium">Engagement</p>
              <p className="text-2xl font-bold text-[#FAFAFA] mt-1">{engagementMetrics.featureAdoptionRate}%</p>
              <p className="text-xs text-[#22C55E] mt-1">Feature adoption rate</p>
            </div>
            <div className="w-16 h-16 rounded-full border-4 border-[#F97316] flex items-center justify-center">
              <span className="text-sm font-bold text-[#F97316]">{engagementMetrics.featureAdoptionRate}%</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-[#27272A]">
            <div>
              <p className="text-[10px] text-[#52525B]">Work Orders</p>
              <p className="text-sm font-medium text-[#A1A1AA]">{engagementMetrics.totalWorkOrders}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#52525B]">DAU/MAU</p>
              <p className="text-sm font-medium text-[#A1A1AA]">{engagementMetrics.dauMauRatio}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: User Distribution & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Role Distribution */}
        <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-5 hover:border-[#3F3F46] transition-all duration-200">
          <h3 className="text-sm font-semibold text-[#FAFAFA] mb-5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
            User Distribution
          </h3>
          <div className="flex items-center justify-center mb-5">
            <DonutChart 
              segments={roleStats.map(r => ({ value: r.count, color: r.color, label: r.name }))} 
              size={120}
            />
          </div>
          <div className="space-y-3">
            {roleStats.map((role) => (
              <div key={role.key} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{role.icon}</span>
                  <span className="text-sm text-[#A1A1AA]">{role.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#FAFAFA]">{role.count}</span>
                  <span className="text-xs text-[#52525B]">
                    ({totalUsers > 0 ? Math.round((role.count / totalUsers) * 100) : 0}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Heatmap */}
        <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-5 hover:border-[#3F3F46] transition-all duration-200">
          <h3 className="text-sm font-semibold text-[#FAFAFA] mb-5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#F97316]" />
            Activity Heatmap
          </h3>
          <div className="flex items-center justify-center mb-4">
            <ActivityHeatmap data={activityData} />
          </div>
          <div className="flex justify-between text-[9px] text-[#52525B] mb-4">
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
            <span>Sun</span>
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-[#27272A]">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#52525B]">Less</span>
              <div className="flex gap-1">
                {[0.2, 0.4, 0.6, 0.8, 1].map((opacity, i) => (
                  <div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: `rgba(249, 115, 22, ${opacity})` }} />
                ))}
              </div>
              <span className="text-[10px] text-[#52525B]">More</span>
            </div>
            <span className="text-xs text-[#71717A]">Last 4 weeks</span>
          </div>
        </div>

        {/* Engagement Funnel */}
        <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-5 hover:border-[#3F3F46] transition-all duration-200">
          <h3 className="text-sm font-semibold text-[#FAFAFA] mb-5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
            Engagement Funnel
          </h3>
          <div className="space-y-4">
            <FunnelStep label="Registered Users" value={totalUsers} percent={100} color="#e5332a" />
            <FunnelStep label="Onboarded" value={liveMetrics?.onboardedUsers || 0} percent={engagementMetrics.onboardingRate} color="#8B5CF6" />
            <FunnelStep label="Feature Adoption" value={Math.round(totalUsers * engagementMetrics.featureAdoptionRate / 100)} percent={engagementMetrics.featureAdoptionRate} color="#F97316" />
            <FunnelStep label="Power Users" value={liveMetrics?.powerUsers || 0} percent={engagementMetrics.powerUserRate} color="#22C55E" />
          </div>
          <div className="mt-5 pt-4 border-t border-[#27272A] grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-[#27272A]/30 rounded-lg">
              <p className="text-lg font-bold text-[#22C55E]">{engagementMetrics.powerUserRate}%</p>
              <p className="text-[10px] text-[#52525B]">Power Users</p>
            </div>
            <div className="text-center p-3 bg-[#27272A]/30 rounded-lg">
              <p className="text-lg font-bold text-[#e5332a]">{engagementMetrics.onboardingRate}%</p>
              <p className="text-[10px] text-[#52525B]">Onboarding</p>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Activity Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-5 hover:border-[#3F3F46] transition-all duration-200">
          <h3 className="text-sm font-semibold text-[#FAFAFA] mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#e5332a]" />
            Daily Activity
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <MetricBox label="DAU" value={engagementMetrics.dailyActiveUsers.toString()} color="#e5332a" />
            <MetricBox label="DAU/MAU" value={`${liveMetrics?.dauMauRatio || 0}%`} color="#22C55E" />
            <MetricBox label="Avg Value" value={`$${(liveMetrics?.avgCustomerValue || 0).toFixed(0)}`} color="#8B5CF6" />
            <MetricBox label="Total Orders" value={(liveMetrics?.totalWorkOrders || 0).toLocaleString()} color="#F97316" />
          </div>
        </div>

        <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-5 hover:border-[#3F3F46] transition-all duration-200">
          <h3 className="text-sm font-semibold text-[#FAFAFA] mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
            Weekly Activity
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <MetricBox label="WAU" value={engagementMetrics.weeklyActiveUsers.toString()} color="#8B5CF6" />
            <MetricBox label="Feature Usage" value={`${liveMetrics?.featureAdoptionRate || 0}%`} color="#22C55E" />
            <MetricBox label="Completed" value={(liveMetrics?.completedWorkOrders || 0).toString()} color="#F97316" />
            <MetricBox label="Reviews" value={(liveMetrics?.totalReviewCount || 0).toString()} color="#e5332a" />
          </div>
        </div>

        <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-5 hover:border-[#3F3F46] transition-all duration-200">
          <h3 className="text-sm font-semibold text-[#FAFAFA] mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
            Monthly Activity
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <MetricBox label="MAU" value={engagementMetrics.monthlyActiveUsers.toString()} color="#22C55E" />
            <MetricBox label="Retention" value={liveMetrics?.retentionRate || '0%'} color="#8B5CF6" />
            <MetricBox label="Churn" value={liveMetrics?.churnRate || '0%'} color="#e5332a" />
            <MetricBox label="Satisfaction" value={`${(liveMetrics?.customerSatisfaction || 0).toFixed(1)}/5`} color="#F97316" />
          </div>
        </div>
      </div>

      {/* Section 4: Recent Users Table */}
      <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-5 hover:border-[#3F3F46] transition-all duration-200">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-[#FAFAFA] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#F97316]" />
            Recent Registrations
          </h3>
          <div className="flex gap-2">
            <button className="text-xs px-3 py-1.5 bg-[#27272A] hover:bg-[#3F3F46] text-[#A1A1AA] rounded-lg transition-colors">
              Export
            </button>
            <button className="text-xs px-3 py-1.5 bg-[#22C55E]/10 hover:bg-[#22C55E]/20 text-[#22C55E] rounded-lg transition-colors">
              + Invite Users
            </button>
          </div>
        </div>

        {newUsersArray.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-14 h-14 rounded-xl bg-[#27272A] flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-[#52525B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <p className="text-sm text-[#71717A]">No recent registrations</p>
            <p className="text-xs text-[#52525B] mt-1">New users will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#27272A]">
                  <th className="text-left text-xs text-[#71717A] font-medium pb-3 pr-4">User</th>
                  <th className="text-left text-xs text-[#71717A] font-medium pb-3 pr-4">Email</th>
                  <th className="text-center text-xs text-[#71717A] font-medium pb-3 pr-4">Role</th>
                  <th className="text-center text-xs text-[#71717A] font-medium pb-3 pr-4">Joined</th>
                  <th className="text-center text-xs text-[#71717A] font-medium pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {newUsersArray.slice(0, 8).map((user: UserData) => {
                  const roleConfig = ROLE_CONFIG[user.role as keyof typeof ROLE_CONFIG] || ROLE_CONFIG.customer;
                  return (
                    <tr key={user.id} className="border-b border-[#27272A]/50 last:border-0 hover:bg-[#27272A]/30 transition-colors">
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
                            style={{ backgroundColor: `${roleConfig.color}15` }}
                          >
                            {roleConfig.icon}
                          </div>
                          <span className="text-sm text-[#FAFAFA] font-medium">
                            {user.firstName} {user.lastName}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 pr-4 text-sm text-[#71717A]">{user.email}</td>
                      <td className="py-4 pr-4 text-center">
                        <span 
                          className="text-xs px-2 py-1 rounded-full font-medium"
                          style={{ backgroundColor: `${roleConfig.color}15`, color: roleConfig.color }}
                        >
                          {roleConfig.name}
                        </span>
                      </td>
                      <td className="py-4 pr-4 text-sm text-[#71717A] text-center">
                        {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="py-4 text-center">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          user.status === 'active' ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#F97316]/10 text-[#F97316]'
                        }`}>
                          {user.status || 'active'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {newUsersArray.length > 8 && (
          <div className="text-center mt-4 pt-4 border-t border-[#27272A]">
            <button className="text-xs text-[#F97316] hover:text-[#FB923C] font-medium">
              View all {newUsersArray.length} new users <FaArrowRight style={{marginRight:4}} />
            </button>
          </div>
        )}
      </div>

      {/* Section 5: User Health & Security */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-5 hover:border-[#3F3F46] transition-all duration-200">
          <h3 className="text-sm font-semibold text-[#FAFAFA] mb-5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
            User Health Indicators
          </h3>
          <div className="space-y-4">
            <HealthBar label="Account Verification" value={liveMetrics?.accountVerificationRate ?? null} color="#22C55E" />
            <HealthBar label="Profile Completion" value={liveMetrics?.profileCompletionRate || 0} color="#e5332a" />
            <HealthBar label="Onboarding Completion" value={liveMetrics?.onboardingCompletionRate || 0} color="#8B5CF6" />
            <HealthBar label="Two-Factor Auth" value={liveMetrics?.twoFactorAuthRate ?? null} color="#F97316" />
          </div>
        </div>

        <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-5 hover:border-[#3F3F46] transition-all duration-200">
          <h3 className="text-sm font-semibold text-[#FAFAFA] mb-5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#e5332a]" />
            Security Overview
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-[#22C55E]/5 border border-[#22C55E]/20 rounded-xl text-center">
              <p className="text-2xl font-bold text-[#22C55E]">{liveMetrics?.activeSessions || 0}</p>
              <p className="text-xs text-[#71717A]">Active Sessions</p>
            </div>
            <div className="p-4 bg-[#F97316]/5 border border-[#F97316]/20 rounded-xl text-center">
              <p className="text-2xl font-bold text-[#F97316]">{formatNullableMetric(liveMetrics?.failedLogins)}</p>
              <p className="text-xs text-[#71717A]">Failed Logins</p>
            </div>
            <div className="p-4 bg-[#EF4444]/5 border border-[#EF4444]/20 rounded-xl text-center">
              <p className="text-2xl font-bold text-[#EF4444]">{formatNullableMetric(liveMetrics?.accountLockouts)}</p>
              <p className="text-xs text-[#71717A]">Account Lockouts</p>
            </div>
            <div className="p-4 bg-[#22C55E]/5 border border-[#22C55E]/20 rounded-xl text-center">
              <p className="text-2xl font-bold text-[#22C55E]">{formatNullableMetric(liveMetrics?.securityAlerts)}</p>
              <p className="text-xs text-[#71717A]">Security Alerts</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper Components

function FunnelStep({ label, value, percent, color }: { label: string; value: number; percent: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-[#A1A1AA]">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[#FAFAFA]">{value}</span>
          <span className="text-[10px] text-[#52525B]">({percent}%)</span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-[#27272A] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function MetricBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="p-3 bg-[#27272A]/30 rounded-lg border border-[#3F3F46] text-center">
      <p className="text-lg font-bold" style={{ color }}>{value}</p>
      <p className="text-[10px] text-[#52525B]">{label}</p>
    </div>
  );
}

function HealthBar({ label, value, color }: { label: string; value: number | null; color: string }) {
  const isUnavailable = value === null;
  const safeValue = value ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-[#A1A1AA]">{label}</span>
        <span className="text-xs font-medium" style={{ color: isUnavailable ? '#A1A1AA' : color }}>
          {isUnavailable ? 'Unavailable' : `${safeValue}%`}
        </span>
      </div>
      <div className="h-2 rounded-full bg-[#27272A] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${safeValue}%`, backgroundColor: isUnavailable ? '#52525B' : color }} />
      </div>
    </div>
  );
}

