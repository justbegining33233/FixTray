'use client';

import { usePhrase } from '@/lib/usePhrase';
import Link from 'next/link';
import type { Route } from 'next';
import {
  FaBox,
  FaChartBar,
  FaClipboardList,
  FaClock,
  FaCog,
  FaEnvelope,
  FaExclamationTriangle,
  FaKey,
  FaMapMarkerAlt,
  FaPlusCircle,
  FaRedo,
  FaStore,
  FaTools,
  FaUsers,
} from 'react-icons/fa';
import MessagingCard from '@/components/MessagingCard';

type TabName = 'overview' | 'settings' | 'payroll' | 'team' | 'inventory';

interface OverviewTabProps {
  shopStats: any;
  inventoryStock: any[];
  budgetData: any;
  userId: string;
  shopId: string;
  getLiveHours: (emp: any) => number;
  setTab: (tab: TabName) => void;
}

export default function OverviewTab({
  shopStats,
  inventoryStock,
  budgetData,
  userId,
  shopId,
  getLiveHours,
  setTab,
}: OverviewTabProps) {
  const say = usePhrase();
  if (!shopStats) {
    return (
      <div style={{ textAlign: 'center', padding: 64, color: '#9aa3b2' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}><FaChartBar /></div>
        <div style={{ fontSize: 18, marginBottom: 8 }}>{say("Loading shop statistics...")}</div>
        <div style={{ fontSize: 14 }}>{say("Please wait while we fetch your data")}</div>
      </div>
    );
  }

  const lowStockCount = inventoryStock.filter((item: any) => item.quantity <= item.reorderPoint).length;
  const totalInventoryUnits = inventoryStock.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
  const totalInventoryValue = inventoryStock.reduce((sum: number, item: any) => sum + ((item.quantity || 0) * (item.sellingPrice || 0)), 0);

  const openWorkOrders = shopStats.workOrders.open || 0;
  const completedThisWeek = shopStats.workOrders.completedThisWeek || 0;
  const totalOrders = openWorkOrders + completedThisWeek;
  const completionRate = totalOrders > 0 ? Math.round((completedThisWeek / totalOrders) * 100) : 0;

  const weeklyBudget = budgetData?.weeklyBudget || 0;
  const weeklySpent = budgetData?.weeklySpent || 0;
  const budgetPct = weeklyBudget > 0 ? Math.min(100, Math.round((weeklySpent / weeklyBudget) * 100)) : 0;

  return (
    <div>
      {/* Top Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 18 }}>
        {[
          { label: say("Open Work Orders"), value: String(openWorkOrders), sub: <>{shopStats.workOrders.completedToday || 0} {say("completed today")}</>, color: '#e5332a', icon: <FaClock /> },
          { label: say("Weekly Revenue"), value: `$${(shopStats.revenue?.week ?? 0).toFixed(2)}`, sub: <>${(shopStats.revenue?.today ?? 0).toFixed(2)} {say("today")}</>, color: '#22c55e', icon: <FaChartBar /> },
          { label: say("Team On Shift"), value: `${shopStats.team.clockedIn || 0}/${shopStats.team.total || 0}`, sub: say("Live staffing coverage"), color: '#f59e0b', icon: <FaUsers /> },
          { label: say("Pending Actions"), value: String((shopStats.workOrders.pendingApprovals || 0) + (shopStats.inventory.pendingRequests || 0)), sub: <>{shopStats.inventory.pendingRequests || 0} {say("inventory approvals")}</>, color: '#e5332a', icon: <FaExclamationTriangle /> },
          { label: say("Inventory Items"), value: String(inventoryStock.length), sub: <>{lowStockCount} {say("low stock")}</>, color: '#8b5cf6', icon: <FaBox /> },
        ].map((card) => (
          <div key={card.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: '#9aa3b2', fontWeight: 700 }}>{say(card.label)}</div>
              <div style={{ color: card.color }}>{say(card.icon)}</div>
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, color: '#e5e7eb', lineHeight: 1.1 }}>{say(card.value)}</div>
            <div style={{ fontSize: 12, color: '#9aa3b2', marginTop: 4 }}>{typeof card.sub === 'string' ? say(card.sub) : card.sub}</div>
          </div>
        ))}
      </div>

      {/* Analytics + Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 14, marginBottom: 18 }}>
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 18 }}>
          <h3 style={{ margin: 0, color: '#e5e7eb', fontSize: 17 }}>{say("Operational Analytics")}</h3>
          <div style={{ marginTop: 6, color: '#9aa3b2', fontSize: 12 }}>{say("Throughput, budget, and execution health")}</div>

          <div style={{ marginTop: 14 }}>
            <div style={{ marginBottom: 6, color: '#9aa3b2', fontSize: 12 }}>{say("Weekly Completion")}</div>
            <div style={{ width: '100%', height: 10, background: 'rgba(255,255,255,0.09)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${completionRate}%`, height: '100%', background: 'linear-gradient(90deg,#e5332a,#22c55e)' }} />
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: '#e5e7eb', fontWeight: 700 }}>{say(completionRate)}% ({say(completedThisWeek)}/{totalOrders || 0})</div>
          </div>

          {weeklyBudget > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ marginBottom: 6, color: '#9aa3b2', fontSize: 12 }}>{say("Weekly Payroll Budget Utilization")}</div>
              <div style={{ width: '100%', height: 10, background: 'rgba(255,255,255,0.09)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${budgetPct}%`, height: '100%', background: budgetPct >= 95 ? 'linear-gradient(90deg,#f59e0b,#e5332a)' : 'linear-gradient(90deg,#22c55e,#e5332a)' }} />
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: '#e5e7eb', fontWeight: 700 }}>{say(budgetPct)}% (${weeklySpent.toFixed(2)} / ${weeklyBudget.toFixed(2)})</div>
            </div>
          )}
        </div>

        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 18 }}>
          <h3 style={{ margin: 0, color: '#e5e7eb', fontSize: 17 }}>{say("Quick Actions")}</h3>
          <div style={{ marginTop: 6, color: '#9aa3b2', fontSize: 12 }}>{say("High-frequency admin operations")}</div>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {[
              { href: '/shop/analytics', icon: <FaChartBar />, label: say("Shop Analytics"), sub: say("SLA, margin, performance") },
              { href: '/shop/new-inshop-job', icon: <FaClipboardList />, label: say("Create In-Shop Job"), sub: say("New work order intake") },
              { href: '/shop/services', icon: <FaTools />, label: say("Service Catalog"), sub: say("Rates, labor, and pricing tables") },
              { href: '/shop/locations', icon: <FaMapMarkerAlt />, label: say("Shop Locations"), sub: say("Multi-location settings") },
            ].map((link) => (
              <Link key={link.href} href={link.href as Route} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9, padding: '9px 10px' }}>
                  <div style={{ color: '#ff6b64' }}>{say(link.icon)}</div>
                  <div>
                    <div style={{ color: '#e5e7eb', fontWeight: 700, fontSize: 13 }}>{say(link.label)}</div>
                    <div style={{ color: '#9aa3b2', fontSize: 11 }}>{say(link.sub)}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Inventory Snapshot */}
      <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 18, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0, color: '#e5e7eb', fontSize: 17 }}>{say("Inventory Snapshot")}</h3>
            <div style={{ marginTop: 4, color: '#9aa3b2', fontSize: 12 }}>{say("Current stock, risk, and valuation")}</div>
          </div>
          <button onClick={() => setTab('inventory')} style={{ padding: '8px 12px', background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, color: '#a5b4fc', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {say("Open Inventory")}{' '}</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
          <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 11, color: '#9aa3b2' }}>{say("Inventory Value")}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#22c55e' }}>${totalInventoryValue.toFixed(2)}</div>
          </div>
          <div style={{ background: 'rgba(229,51,42,0.1)', border: '1px solid rgba(229,51,42,0.25)', borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 11, color: '#9aa3b2' }}>{say("Units On Hand")}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#ff6b64' }}>{say(totalInventoryUnits)}</div>
          </div>
          <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 11, color: '#9aa3b2' }}>{say("Low Stock")}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#f59e0b' }}>{say(lowStockCount)}</div>
          </div>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', fontSize: 12 }}>
            <thead style={{ background: 'rgba(0,0,0,0.35)' }}>
              <tr>
                <th style={{ padding: 10, textAlign: 'left', color: '#9aa3b2' }}>{say("Item")}</th>
                <th style={{ padding: 10, textAlign: 'left', color: '#9aa3b2' }}>{say("SKU")}</th>
                <th style={{ padding: 10, textAlign: 'left', color: '#9aa3b2' }}>{say("Qty")}</th>
                <th style={{ padding: 10, textAlign: 'left', color: '#9aa3b2' }}>{say("Status")}</th>
              </tr>
            </thead>
            <tbody>
              {inventoryStock.slice(0, 8).map((item: any) => (
                <tr key={item.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <td style={{ padding: 10, color: '#e5e7eb' }}>{say(item.itemName)}</td>
                  <td style={{ padding: 10, color: '#9aa3b2' }}>{item.sku || '-'}</td>
                  <td style={{ padding: 10, color: '#e5e7eb', fontWeight: 700 }}>{say(item.quantity)}</td>
                  <td style={{ padding: 10 }}>
                    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: item.quantity <= item.reorderPoint ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)', color: item.quantity <= item.reorderPoint ? '#f59e0b' : '#22c55e' }}>
                      {item.quantity <= item.reorderPoint ? say("LOW") : say("GOOD")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shop Communications - MessagingCard */}
      <div style={{ marginBottom: 24 }}>
        <MessagingCard userId={userId} shopId={shopId} />
      </div>

      {/* Budget Tracking */}
      {budgetData && (budgetData.weeklyBudget > 0 || budgetData.monthlyBudget > 0) && (
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ fontSize: 24 }}><FaExclamationTriangle /></div>
            <div>
              <h3 style={{ color: '#e5e7eb', fontSize: 18, margin: 0 }}>{say("Payroll Budget Tracking")}</h3>
              <div style={{ color: '#9aa3b2', fontSize: 13 }}>{say("Monitor spending against budget limits")}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {budgetData.weeklyBudget > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: '#e5e7eb', fontSize: 14, fontWeight: 600 }}>{say("Weekly Budget")}</span>
                  <span style={{ color: budgetData.weeklySpent > budgetData.weeklyBudget ? '#ef4444' : budgetData.weeklySpent / budgetData.weeklyBudget > 0.9 ? '#f59e0b' : '#22c55e', fontSize: 14, fontWeight: 600 }}>
                    ${(budgetData.weeklySpent ?? 0).toFixed(2)} / ${(budgetData.weeklyBudget ?? 0).toFixed(2)}
                  </span>
                </div>
                <div style={{ width: '100%', height: 24, background: 'rgba(255,255,255,0.1)', borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ width: `${Math.min(100, (budgetData.weeklySpent / budgetData.weeklyBudget) * 100)}%`, height: '100%', background: budgetData.weeklySpent > budgetData.weeklyBudget ? 'linear-gradient(90deg, #ef4444, #dc2626)' : budgetData.weeklySpent / budgetData.weeklyBudget > 0.9 ? 'linear-gradient(90deg, #f59e0b, #d97706)' : 'linear-gradient(90deg, #22c55e, #16a34a)', transition: 'width 0.3s ease' }} />
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                    {Math.min(100, Math.round((budgetData.weeklySpent / budgetData.weeklyBudget) * 100))}%
                  </div>
                </div>
                {budgetData.weeklySpent > budgetData.weeklyBudget && (
                  <div style={{ marginTop: 8, padding: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, fontSize: 12, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span><FaExclamationTriangle /></span>
                    <span>{say("Over budget by $")}{((budgetData.weeklySpent ?? 0) - (budgetData.weeklyBudget ?? 0)).toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            {budgetData.monthlyBudget > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: '#e5e7eb', fontSize: 14, fontWeight: 600 }}>{say("Monthly Budget")}</span>
                  <span style={{ color: budgetData.monthlySpent > budgetData.monthlyBudget ? '#ef4444' : budgetData.monthlySpent / budgetData.monthlyBudget > 0.9 ? '#f59e0b' : '#22c55e', fontSize: 14, fontWeight: 600 }}>
                    ${(budgetData.monthlySpent ?? 0).toFixed(2)} / ${(budgetData.monthlyBudget ?? 0).toFixed(2)}
                  </span>
                </div>
                <div style={{ width: '100%', height: 24, background: 'rgba(255,255,255,0.1)', borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ width: `${Math.min(100, (budgetData.monthlySpent / budgetData.monthlyBudget) * 100)}%`, height: '100%', background: budgetData.monthlySpent > budgetData.monthlyBudget ? 'linear-gradient(90deg, #ef4444, #dc2626)' : budgetData.monthlySpent / budgetData.monthlyBudget > 0.9 ? 'linear-gradient(90deg, #f59e0b, #d97706)' : 'linear-gradient(90deg, #22c55e, #16a34a)', transition: 'width 0.3s ease' }} />
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                    {Math.min(100, Math.round((budgetData.monthlySpent / budgetData.monthlyBudget) * 100))}%
                  </div>
                </div>
                {budgetData.monthlySpent > budgetData.monthlyBudget && (
                  <div style={{ marginTop: 8, padding: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, fontSize: 12, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span><FaExclamationTriangle /></span>
                    <span>{say("Over budget by $")}{((budgetData.monthlySpent ?? 0) - (budgetData.monthlyBudget ?? 0)).toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {(budgetData.weeklySpent > budgetData.weeklyBudget || budgetData.monthlySpent > budgetData.monthlyBudget) && (
            <div style={{ marginTop: 20, padding: 16, background: 'rgba(239,68,68,0.15)', border: '2px solid rgba(239,68,68,0.4)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 32 }}><FaExclamationTriangle /></div>
              <div>
                <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{say("Budget Alert: Payroll Spending Exceeded")}</div>
                <div style={{ color: '#e5e7eb', fontSize: 13 }}>{say("Review your payroll expenses and consider adjusting team schedules or budget limits.")}</div>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Currently Clocked In */}
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ fontSize: 24 }}><FaUsers /></div>
            <div>
              <h3 style={{ color: '#e5e7eb', fontSize: 18, margin: 0 }}>{say("Currently Clocked In")}</h3>
              <div style={{ color: '#9aa3b2', fontSize: 13 }}>{say(shopStats.team.clockedIn)} {say("employees working")}</div>
            </div>
          </div>

          {shopStats.team.currentlyWorking.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: '#9aa3b2' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}><FaUsers /></div>
              <div>{say("No one currently clocked in")}</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {shopStats.team.currentlyWorking.map((emp: any) => (
                <div key={emp.id} style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                      <FaUsers />
                    </div>
                    <div>
                      <div style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 14 }}>{say(emp.name)}</div>
                      <div style={{ color: '#9aa3b2', fontSize: 12 }}>
                        {say("Clocked in at")}{' '}{new Date(emp.clockedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                  <div style={{ color: '#22c55e', fontWeight: 700, fontSize: 14 }}>{getLiveHours(emp).toFixed(1)}h</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ fontSize: 24 }}><FaClipboardList /></div>
            <div>
              <h3 style={{ color: '#e5e7eb', fontSize: 18, margin: 0 }}>{say("Quick Actions")}</h3>
              <div style={{ color: '#9aa3b2', fontSize: 13 }}>{say("Common tasks and shortcuts")}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {[
              { href: '/shop/manage-team', bg: 'rgba(229,51,42,0.2)', border: 'rgba(229,51,42,0.3)', color: '#e5332a', icon: <FaUsers />, label: say("Manage Team"), sub: say("Add or edit team members") },
              { href: '/shop/payroll', bg: 'rgba(34,197,94,0.2)', border: 'rgba(34,197,94,0.3)', color: '#22c55e', icon: <FaClipboardList />, label: say("Payroll"), sub: say("Hours, schedules, and pay stub export") },
              { href: '/shop/admin/settings', bg: 'rgba(168,85,247,0.2)', border: 'rgba(168,85,247,0.3)', color: '#a855f7', icon: <FaCog />, label: say("Shop Settings"), sub: say("Configure rates and margins") },
              { href: '/shop/vendors', bg: 'rgba(139,92,246,0.2)', border: 'rgba(139,92,246,0.3)', color: '#a78bfa', icon: <FaStore />, label: say("Vendor Management"), sub: say("Manage parts suppliers") },
              { href: '/shop/locations', bg: 'rgba(20,184,166,0.2)', border: 'rgba(20,184,166,0.3)', color: '#2dd4bf', icon: <FaMapMarkerAlt />, label: say("Shop Locations"), sub: say("Manage multiple branches") },
              { href: '/shop/settings?tab=security', bg: 'rgba(229,51,42,0.2)', border: 'rgba(229,51,42,0.3)', color: '#ff6b64', icon: <FaKey />, label: say("Security"), sub: say("Two-factor auth and sessions") },
              { href: '/shop/analytics', bg: 'rgba(236,72,153,0.2)', border: 'rgba(236,72,153,0.3)', color: '#ec4899', icon: <FaChartBar />, label: say("Shop Analytics"), sub: say("Performance & revenue trends") },
              { href: '/shop/customer-messages', bg: 'rgba(229,51,42,0.2)', border: 'rgba(229,51,42,0.3)', color: '#e5332a', icon: <FaEnvelope />, label: say("Customer Messages"), sub: say("All customer conversations") },
              { href: '/shop/recurring-workorders', bg: 'rgba(34,197,94,0.2)', border: 'rgba(34,197,94,0.3)', color: '#22c55e', icon: <FaRedo />, label: say("Recurring Jobs"), sub: say("Manage scheduled services") },
              { href: '/shop/services', bg: 'rgba(245,158,11,0.2)', border: 'rgba(245,158,11,0.3)', color: '#f59e0b', icon: <FaTools />, label: say("Service Catalog"), sub: say("Configure offered services and labor") },
              { href: '/shop/new-inshop-job', bg: 'rgba(229,51,42,0.2)', border: 'rgba(229,51,42,0.3)', color: '#e5332a', icon: <FaPlusCircle />, label: say("New In-Shop Job"), sub: say("Create a walk-in work order") },
            ].map(({ href, bg, border, color, icon, label, sub }) => (
              <Link key={href} href={href as Route} style={{ textDecoration: 'none' }}>
                <button style={{ width: '100%', padding: 16, background: bg, border: `1px solid ${border}`, borderRadius: 8, color, fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 20 }}>{say(icon)}</span>
                  <div>
                    <div>{say(label)}</div>
                    <div style={{ fontSize: 11, opacity: 0.8 }}>{say(sub)}</div>
                  </div>
                </button>
              </Link>
            ))}

            {shopStats.inventory.pendingRequests > 0 && (
              <Link href="/shop/home" style={{ textDecoration: 'none' }}>
                <button style={{ width: '100%', padding: 16, background: 'rgba(229,51,42,0.2)', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 8, color: '#e5332a', fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 20 }}><FaExclamationTriangle /></span>
                    <div>
                      <div>{say("Pending Inventory Requests")}</div>
                      <div style={{ fontSize: 11, opacity: 0.8 }}>{say("Requires approval")}</div>
                    </div>
                  </div>
                  <div style={{ padding: '4px 12px', background: '#e5332a', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
                    {say(shopStats.inventory.pendingRequests)}
                  </div>
                </button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

