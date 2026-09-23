'use client';

import { usePhrase } from '@/lib/usePhrase';
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { shopDetailsHref } from '@/lib/ownerShell';
import { FaArrowRight, FaClipboardList, FaDollarSign, FaHardHat, FaStore } from 'react-icons/fa';

interface ShopRow {
  id: string;
  shopName?: string;
  name?: string;
  location?: string;
  rating?: number;
  jobs?: number;
  revenue?: string;
  completionRate?: number;
  averageResponseTime?: string;
}

interface ShopsLiveMetrics {
  totalShops: number;
  newShopsThisMonth: number;
  shopGrowth: string;
  totalUsers: number;
  utilizationRate: string;
  avgTeamSize: number;
  totalPlatformRevenue: number;
  totalRevenueThisMonth: number;
  totalJobs: number;
  completedThisMonth: number;
  jobCompletionRate: number;
  avgResponseTime: string;
  customerRating: number;
  weeklyJobTrend: number[];
  pendingActions?: {
    shopApplications: number;
    pendingWorkOrders: number;
    customerMessages: number;
    overdueWorkOrders: number;
  };
}

interface HierarchyTabProps {
  shops: ShopRow[];
  liveMetrics?: ShopsLiveMetrics | null;
}

function MiniBarChart({ data, color, height = 50 }: { data: number[]; color: string; height?: number }) {
  const source = data.length ? data : [0, 0, 0, 0, 0, 0, 0];
  const max = Math.max(...source);

  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {source.map((value, index) => (
        <div key={index} className="flex-1 flex flex-col items-center">
          <div
            className="w-full rounded-t transition-all duration-500"
            style={{
              height: `${max > 0 ? (value / max) * 100 : 0}%`,
              backgroundColor: color,
              opacity: 0.6 + (index / source.length) * 0.4,
            }}
          />
        </div>
      ))}
    </div>
  );
}

export function HierarchyTab({ shops, liveMetrics }: HierarchyTabProps) {
  const say = usePhrase();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredShops = useMemo(
    () => shops.filter((shop) => (shop.shopName || shop.name || '').toLowerCase().includes(searchTerm.toLowerCase())),
    [shops, searchTerm]
  );

  const totalShops = liveMetrics?.totalShops ?? shops.length;
  const totalUsers = liveMetrics?.totalUsers ?? 0;
  const utilizationRate = liveMetrics?.utilizationRate ?? 'Unavailable';
  const avgTeamSize = liveMetrics?.avgTeamSize ?? 0;
  const totalPlatformRevenue = liveMetrics?.totalPlatformRevenue ?? 0;
  const totalRevenueThisMonth = liveMetrics?.totalRevenueThisMonth ?? 0;
  const totalWorkOrders = liveMetrics?.totalJobs ?? shops.reduce((sum, shop) => sum + (shop.jobs || 0), 0);
  const completedThisMonth = liveMetrics?.completedThisMonth ?? 0;
  const jobCompletionRate = liveMetrics?.jobCompletionRate ?? 0;
  const shopGrowth = liveMetrics?.shopGrowth;
  const newShopsThisMonth = liveMetrics?.newShopsThisMonth ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-5 hover:border-[#3F3F46] transition-all duration-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-[#71717A] uppercase tracking-wider font-medium">{say("Active Shops")}</p>
              <p className="text-2xl font-bold text-[#FAFAFA] mt-1">{say(totalShops)}</p>
              <p className="text-xs text-[#22C55E] mt-1">{shopGrowth ? `${shopGrowth} - +${newShopsThisMonth} this month` : say("Live trend unavailable")}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#e5332a]/10 flex items-center justify-center">
              <span className="text-xl"><FaStore style={{ marginRight: 4 }} /></span>
            </div>
          </div>
        </div>

        <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-5 hover:border-[#3F3F46] transition-all duration-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-[#71717A] uppercase tracking-wider font-medium">{say("Total Technicians")}</p>
              <p className="text-2xl font-bold text-[#FAFAFA] mt-1">{say(totalUsers)}</p>
              <p className="text-xs text-[#e5332a] mt-1">{say(utilizationRate)} {say("capacity used")}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#22C55E]/10 flex items-center justify-center">
              <span className="text-xl"><FaHardHat style={{ marginRight: 4 }} /></span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#27272A]">
            <div className="flex justify-between text-xs">
              <span className="text-[#71717A]">{say("Avg Team Size")}</span>
              <span className="text-[#A1A1AA] font-medium">{say(avgTeamSize)} technicians</span>
            </div>
          </div>
        </div>

        <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-5 hover:border-[#3F3F46] transition-all duration-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-[#71717A] uppercase tracking-wider font-medium">{say("Platform Revenue")}</p>
              <p className="text-2xl font-bold text-[#FAFAFA] mt-1">${totalPlatformRevenue.toLocaleString()}</p>
              <p className="text-xs text-[#22C55E] mt-1">${totalRevenueThisMonth.toLocaleString()} {say("this month")}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center">
              <span className="text-xl"><FaDollarSign style={{ marginRight: 4 }} /></span>
            </div>
          </div>
        </div>

        <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-5 hover:border-[#3F3F46] transition-all duration-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-[#71717A] uppercase tracking-wider font-medium">{say("Work Orders")}</p>
              <p className="text-2xl font-bold text-[#FAFAFA] mt-1">{totalWorkOrders.toLocaleString()}</p>
              <p className="text-xs text-[#22C55E] mt-1">{say(completedThisMonth)} completed</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#F97316]/10 flex items-center justify-center">
              <span className="text-xl"><FaClipboardList style={{ marginRight: 4 }} /></span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#27272A]">
            <div className="flex justify-between text-xs">
              <span className="text-[#71717A]">{say("Completion Rate")}</span>
              <span className="text-[#22C55E] font-medium">{say(jobCompletionRate)}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-5 hover:border-[#3F3F46] transition-all duration-200">
          <h3 className="text-sm font-semibold text-[#FAFAFA] mb-5">{say("Performance Overview")}</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <MetricCard label={say("Response Time")} value={liveMetrics?.avgResponseTime || 'Unavailable'} color="#e5332a" />
            <MetricCard label={say("Completion")} value={`${jobCompletionRate}%`} color="#22C55E" />
            <MetricCard
              label={say("Rating")}
              value={liveMetrics?.customerRating !== undefined ? `${liveMetrics.customerRating}/5` : 'Unavailable'}
              color="#8B5CF6"
            />
            <MetricCard label={say("Shops")} value={totalShops.toString()} color="#F97316" />
          </div>
          <p className="text-xs text-[#71717A] mb-2">{say("Weekly Job Trend")}</p>
          <MiniBarChart data={liveMetrics?.weeklyJobTrend || []} color="#22C55E" height={40} />
        </div>

        <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-5 hover:border-[#3F3F46] transition-all duration-200">
          <h3 className="text-sm font-semibold text-[#FAFAFA] mb-5">{say("Pending Actions")}</h3>
          <div className="space-y-3">
            <ActionItem label={say("Shop Applications")} value={liveMetrics?.pendingActions?.shopApplications ?? 0} type="warning" action="Review" href="/admin/pending-shops" />
            <ActionItem label={say("Pending Work Orders")} value={liveMetrics?.pendingActions?.pendingWorkOrders ?? 0} type="info" action="Assign" href="/admin/command-center" />
            <ActionItem label={say("Customer Messages")} value={liveMetrics?.pendingActions?.customerMessages ?? 0} type="warning" action="Open" href="/admin/messages" />
            <ActionItem label={say("Overdue Jobs")} value={liveMetrics?.pendingActions?.overdueWorkOrders ?? 0} type="error" action="Urgent" href="/admin/command-center?filter=overdue" />
          </div>
        </div>
      </div>

      <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-5 hover:border-[#3F3F46] transition-all duration-200">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-[#FAFAFA]">{say("Shop Directory")}</h3>
          <div className="relative">
            <input
              type="text"
              placeholder={say("Search shops...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-56 px-3 py-1.5 bg-[#27272A] border border-[#3F3F46] rounded-lg text-xs text-[#FAFAFA] placeholder-[#52525B] focus:outline-none focus:border-[#F97316]"
            />
          </div>
        </div>

        {filteredShops.length === 0 ? (
          <div className="py-12 text-center text-[#71717A] text-sm">{say("No shops found.")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#27272A]">
                  <th className="text-left text-xs text-[#71717A] font-medium pb-3 pr-4">{say("Shop")}</th>
                  <th className="text-left text-xs text-[#71717A] font-medium pb-3 pr-4">{say("Location")}</th>
                  <th className="text-center text-xs text-[#71717A] font-medium pb-3 pr-4">{say("Rating")}</th>
                  <th className="text-center text-xs text-[#71717A] font-medium pb-3 pr-4">{say("Jobs")}</th>
                  <th className="text-center text-xs text-[#71717A] font-medium pb-3 pr-4">{say("Revenue")}</th>
                  <th className="text-center text-xs text-[#71717A] font-medium pb-3 pr-4">{say("Completion")}</th>
                  <th className="text-right text-xs text-[#71717A] font-medium pb-3">{say("Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredShops.map((shop) => {
                  const name = shop.shopName || shop.name || 'Shop';
                  return (
                    <tr key={shop.id} className="border-b border-[#27272A]/50 last:border-0 hover:bg-[#27272A]/30 transition-colors">
                      <td className="py-4 pr-4 text-sm text-[#FAFAFA] font-medium">{say(name)}</td>
                      <td className="py-4 pr-4 text-sm text-[#71717A]">{shop.location || say("N/A")}</td>
                      <td className="py-4 pr-4 text-center text-sm text-[#A1A1AA]">{shop.rating ?? 0}</td>
                      <td className="py-4 pr-4 text-center text-sm text-[#22C55E]">{shop.jobs ?? 0}</td>
                      <td className="py-4 pr-4 text-center text-sm text-[#e5332a]">{shop.revenue || '$0'}</td>
                      <td className="py-4 pr-4 text-center text-sm text-[#8B5CF6]">{shop.completionRate ?? 0}%</td>
                      <td className="py-4 text-right">
                        <Link href={shopDetailsHref(shop.id, 'manage-shops') as Route} className="text-xs text-[#F97316] hover:text-[#FB923C] font-medium">
                          {say("Manage")}{' '}<FaArrowRight style={{ marginRight: 4 }} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  const say = usePhrase();
  return (
    <div className="p-3 bg-[#27272A]/30 rounded-lg border border-[#3F3F46] text-center">
      <p className="text-lg font-bold" style={{ color }}>{say(value)}</p>
      <p className="text-[10px] text-[#52525B]">{say(label)}</p>
    </div>
  );
}

function ActionItem({ label, value, type, action, href }: { label: string; value: number; type: 'warning' | 'error' | 'info'; action: string; href?: string }) {
  const say = usePhrase();
  const colors = {
    warning: { bg: 'bg-[#F97316]/10', text: 'text-[#F97316]', badge: 'bg-[#F97316]' },
    error: { bg: 'bg-[#EF4444]/10', text: 'text-[#EF4444]', badge: 'bg-[#EF4444]' },
    info: { bg: 'bg-[#e5332a]/10', text: 'text-[#e5332a]', badge: 'bg-[#e5332a]' },
  };

  return (
    <div className={`flex items-center justify-between p-3 ${colors[type].bg} rounded-lg`}>
      <div className="flex items-center gap-3">
        <span className={`w-6 h-6 ${colors[type].badge} rounded-full flex items-center justify-center text-xs font-bold text-white`}>{say(value)}</span>
        <span className="text-sm text-[#FAFAFA]">{say(label)}</span>
      </div>
      {href ? (
        <Link href={href as Route} className={`text-xs font-medium ${colors[type].text} hover:underline`}>
          {say(action)} <FaArrowRight style={{ marginRight: 4 }} />
        </Link>
      ) : (
        <button className={`text-xs font-medium ${colors[type].text} hover:underline`}>
          {say(action)} <FaArrowRight style={{ marginRight: 4 }} />
        </button>
      )}
    </div>
  );
}
