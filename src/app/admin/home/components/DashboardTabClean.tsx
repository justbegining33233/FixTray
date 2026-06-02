'use client';

import React from 'react';
import KpiCard from './KpiCard';
import SalesFunnel from './SalesFunnel';
import SystemHealth from './SystemHealth';
import type { HealthMetric } from './SystemHealth';
import type { StatusTone } from './StatusBadge';

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
  churnRateRaw?: number;
  totalClientsLast3Months: number;
  totalJobIncomeLast3Months: string;
}

interface LiveMetrics {
  revenueTrend: number[];
  revenueGrowth: string;
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
  monthOverMonthGrowth: string;
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

interface DashboardTabProps {
  platformStats: PlatformStats;
  pendingShops: any[];
  approvedShops: any[];
  shopsLiveMetrics?: {
    activeShops: number;
    inactiveShops: number;
    approvedShops: number;
    pendingShops: number;
  } | null;
  recentActivity: any[];
  planDistribution: Record<string, number>;
  weeklyOverview: WeeklyOverview;
  threeMonthAverages: ThreeMonthAverages;
  liveMetrics: LiveMetrics;
  infraHealth: InfraHealth;
}

export function DashboardTab({
  platformStats,
  pendingShops: _pendingShops,
  approvedShops: _approvedShops,
  shopsLiveMetrics,
  liveMetrics,
  infraHealth,
}: DashboardTabProps) {
  const revenueTrend = liveMetrics.revenueTrend?.length ? liveMetrics.revenueTrend : [];

  const kpiCards = [
    {
      title: 'Monthly Revenue',
      value: platformStats.monthlyRevenue,
      change: liveMetrics.monthOverMonthGrowth !== 'Unavailable' ? liveMetrics.monthOverMonthGrowth : 'Current month',
      trend: revenueTrend,
      accent: 'emerald' as const,
      caption: 'Paid work orders this month'
    },
    {
      title: 'Active Shops',
      value: (shopsLiveMetrics?.activeShops ?? 0).toLocaleString(),
      change: `${shopsLiveMetrics?.activeShops ?? 0} currently active`,
      trend: [],
      accent: 'sky' as const,
      caption: 'Live storefronts'
    },
    {
      title: 'Active Users',
      value: platformStats.activeUsers.toLocaleString(),
      change: 'Last 30 days',
      trend: [],
      accent: 'violet' as const,
      caption: 'Users with recent activity'
    },
    {
      title: 'Pending Approvals',
      value: platformStats.pendingShops.toString(),
      change: `${platformStats.totalShops} active shops`,
      trend: [],
      accent: 'amber' as const,
      caption: 'Ready for review'
    }
  ];

  const funnelData = {
    visits: liveMetrics.websiteVisits || liveMetrics.totalShopsEver || 0,
    trials: liveMetrics.trialsCount || liveMetrics.trialSignups || 0,
    members: liveMetrics.membersCount || liveMetrics.activeTrials || 0,
    customers: liveMetrics.convertedCustomersCount || liveMetrics.convertedCustomers || 0
  };

  const heartbeatLabel =
    infraHealth.heartbeat === 'online'
      ? 'Live'
      : infraHealth.heartbeat === 'degraded'
      ? 'Degraded'
      : 'Offline';

  const heartbeatTone: StatusTone =
    infraHealth.heartbeat === 'offline'
      ? 'danger'
      : infraHealth.heartbeat === 'degraded'
      ? 'warning'
      : infraHealth.apiLatencyMs === null
      ? 'warning'
      : infraHealth.apiLatencyMs > 1200
      ? 'danger'
      : infraHealth.apiLatencyMs > 600
      ? 'warning'
      : 'success';

  const apiLatencyTone: StatusTone =
    infraHealth.apiLatencyMs === null
      ? 'warning'
      : infraHealth.apiLatencyMs > 1200
      ? 'danger'
      : infraHealth.apiLatencyMs > 600
      ? 'warning'
      : 'success';

  const statsLatencyTone: StatusTone =
    infraHealth.statsLatencyMs === null
      ? 'warning'
      : infraHealth.statsLatencyMs > 1400
      ? 'danger'
      : infraHealth.statsLatencyMs > 700
      ? 'warning'
      : 'success';

  const dbUptimeHours =
    infraHealth.uptimeSeconds === null
      ? null
      : (infraHealth.uptimeSeconds / 3600);

  const freshnessSeconds = infraHealth.heartbeatAgeSeconds;
  const lastIssueAgeSeconds = infraHealth.dbLastIssueAgeSeconds;

  const dbStatusTone: StatusTone =
    infraHealth.dbConnected === false
      ? 'danger'
      : infraHealth.dbConnected === true
      ? 'success'
      : 'warning';

  const healthMetrics: HealthMetric[] = [
    {
      label: 'Heartbeat',
      value: heartbeatLabel,
      subtext: freshnessSeconds === null ? 'No signal' : `${freshnessSeconds}s ago`,
      tone: heartbeatTone,
      trend: [],
    },
    {
      label: 'API Latency',
      value: infraHealth.apiLatencyMs === null ? 'Unavailable' : `${infraHealth.apiLatencyMs}ms`,
      subtext: infraHealth.apiLatencyMs === null ? 'No sample' : 'Round-trip',
      tone: apiLatencyTone,
      trend: [],
    },
    {
      label: 'Database',
      value: infraHealth.dbConnected === null ? 'Unknown' : infraHealth.dbConnected ? 'Connected' : 'Disconnected',
      subtext: infraHealth.dbStatusMessage || 'Connection status',
      tone: dbStatusTone,
      trend: [],
    },
    {
      label: 'Stats Latency',
      value: infraHealth.statsLatencyMs === null ? 'Unavailable' : `${infraHealth.statsLatencyMs}ms`,
      subtext: infraHealth.statsLatencyMs === null ? 'No sample' : 'Admin stats query',
      tone: statsLatencyTone,
      trend: [],
    },
    {
      label: 'Platform Health',
      value: platformStats.systemHealth === null ? 'Unavailable' : `${platformStats.systemHealth}%`,
      subtext: platformStats.systemHealth === null ? 'Error signal unavailable' : 'Error-based signal',
      tone: platformStats.systemHealth === null ? 'warning' as const : 'success' as const,
      trend: [],
    },
    {
      label: 'Issue Age',
      value: lastIssueAgeSeconds === null ? 'None' : `${Math.floor(lastIssueAgeSeconds / 60)}m`,
      subtext: lastIssueAgeSeconds === null ? 'No recent issues' : `${lastIssueAgeSeconds}s since last issue`,
      tone: lastIssueAgeSeconds === null ? 'success' as const : lastIssueAgeSeconds < 300 ? 'danger' as const : 'warning' as const,
      trend: []
    },
    {
      label: 'DB Uptime',
      value: dbUptimeHours === null ? 'Unavailable' : `${dbUptimeHours.toFixed(1)}h`,
      subtext: dbUptimeHours === null ? 'No sample' : 'Since last recorded issue',
      tone: dbUptimeHours === null ? 'warning' as const : 'success' as const,
      trend: []
    }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => (
          <KpiCard
            key={card.title}
            title={card.title}
            value={card.value}
            change={card.change}
            trend={card.trend}
            accent={card.accent}
            caption={card.caption}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SalesFunnel
          visits={funnelData.visits}
          trials={funnelData.trials}
          members={funnelData.members}
          customers={funnelData.customers}
        />
        <SystemHealth metrics={healthMetrics} />
      </div>
    </div>
  );
}
