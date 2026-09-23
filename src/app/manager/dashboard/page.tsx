'use client';

import { usePhrase } from '@/lib/usePhrase';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import QuickActionCard from '@/components/QuickActionCard';
import TechTrackingMap from '@/components/TechTrackingMap';
import { FaArrowLeft, FaArrowRight, FaBolt, FaChartBar, FaExclamationTriangle, FaTimesCircle, FaPlus, FaUsers, FaClipboardList, FaWrench, FaBox } from 'react-icons/fa';

interface ManagerDashboardData {
  stats: {
    openJobs: number;
    pendingJobs: number;
    completedToday: number;
    totalTechs: number;
    activeTechs: number;
    pendingInventoryRequests: number;
  };
  recentWorkOrders: any[];
  teamMembers: any[];
  inventoryRequests: any[];
}

export default function ManagerDashboard() {
  const say = usePhrase();
  const { user, isLoading } = useRequireAuth(['manager']);
  const [data, setData] = useState<ManagerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchDashboardData() {
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch('/api/manager/dashboard', {
        headers: { 'Authorization': `Bearer ${token}` },
      });


      if (response.ok) {
        const dashboardData = await response.json();
        setData(dashboardData);
      } else {
        const errorData = await response.json();
        console.error(<><FaTimesCircle style={{marginRight:4}} /> {say("Failed to fetch dashboard data:")}</>, response.status, errorData);
      }
    } catch (error) {
      console.error(<><FaBolt style={{marginRight:4}} /> {say("Error fetching dashboard:")}</>, error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) return;

    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30 * 1000);

    return () => clearInterval(interval);
  }, [user]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#e5e7eb',
        fontSize: '18px'
      }}>
        {say("Loading...")}{' '}</div>
    );
  }

  // If no user, the useRequireAuth hook will handle redirect
  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#e5e7eb', fontSize: 20 }}>{say("Loading dashboard...")}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ minHeight: "100vh", background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#e5e7eb', fontSize: 20 }}>{say("Failed to load dashboard data")}</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: 'transparent' }}>
      {/* Header */}
      <div style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(229,51,42,0.3)', padding: '20px 32px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <Link href="/manager/home" style={{ color: '#e5332a', textDecoration: 'none', fontSize: 14, fontWeight: 600, marginBottom: 8, display: 'inline-block' }}>
            <FaArrowLeft style={{marginRight:4}} /> {say("Back to Manager Home")}{' '}</Link>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', marginBottom: 4 }}><FaChartBar style={{marginRight:4}} /> {say("Manager Dashboard")}</h1>
          <p style={{ fontSize: 14, color: '#9aa3b2' }}>{say("Team overview and work order management")}</p>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: 32 }}>
        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 14, color: '#9aa3b2', marginBottom: 8 }}>{say("Open Jobs")}</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#e5332a' }}>{say(data.stats.openJobs)}</div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 14, color: '#9aa3b2', marginBottom: 8 }}>{say("Pending")}</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#f59e0b' }}>{say(data.stats.pendingJobs)}</div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 14, color: '#9aa3b2', marginBottom: 8 }}>{say("Completed Today")}</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#10b981' }}>{say(data.stats.completedToday)}</div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 14, color: '#9aa3b2', marginBottom: 8 }}>{say("Active Techs")}</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#a855f7' }}>{say(data.stats.activeTechs)}/{say(data.stats.totalTechs)}</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e5e7eb', marginBottom: 16 }}>{say("Quick Actions")}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
            <QuickActionCard
              icon={<FaPlus />}
              title={say("New Work Order")}
              description="Create a new work order for a customer"
              href="/shop/new-inshop-job"
              color="#22c55e"
            />
            <QuickActionCard
              icon={<FaUsers />}
              title={say("Team Management")}
              description="View and manage your team members"
              href="/manager/team"
              color="#e5332a"
              badge={data.stats.totalTechs}
            />
            <QuickActionCard
              icon={<FaClipboardList />}
              title={say("Work Assignments")}
              description="Assign work orders to technicians"
              href="/manager/assignments"
              color="#f59e0b"
              badge={data.stats.pendingJobs}
            />
            <QuickActionCard
              icon={<FaWrench />}
              title={say("Inventory")}
              description="Manage parts and equipment"
              href="/manager/inventory"
              color="#a855f7"
              badge={data.stats.pendingInventoryRequests}
            />
            <QuickActionCard
              icon={<FaBox />}
              title={say("Reports")}
              description="View analytics and performance reports"
              href="/manager/reports"
              color="#06b6d4"
            />
          </div>
        </div>

        {/* Tech Tracking Map */}
        <div style={{ marginBottom: 32 }}>
          <TechTrackingMap />
        </div>

        {/* Main Content Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 24 }}>
          {/* Recent Work Orders */}
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e5e7eb' }}>{say("Recent Work Orders")}</h2>
              <Link href="/manager/assignments" style={{ color: '#e5332a', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
                {say("Assign Work")}{' '}<FaArrowRight style={{marginRight:4}} />
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {data.recentWorkOrders.slice(0, 10).map((wo) => (
                <Link
                  key={wo.id}
                  href={`/workorders/${wo.id}`}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 16, textDecoration: 'none', display: 'block', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e7eb' }}>
                      {say("WO-")}{wo.id.slice(0, 8)}
                    </div>
                    <div style={{
                      padding: '4px 8px',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      background: wo.status === 'completed' ? 'rgba(16,185,129,0.2)' : wo.status === 'in-progress' ? 'rgba(229,51,42,0.2)' : 'rgba(245,158,11,0.2)',
                      color: wo.status === 'completed' ? '#10b981' : wo.status === 'in-progress' ? '#ff6b64' : '#f59e0b'
                    }}>
                      {say(wo.status)}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: '#9aa3b2', marginBottom: 4 }}>
                    {say("Customer:")}{' '}{say(wo.customer?.firstName)} {say(wo.customer?.lastName)}
                  </div>
                  {wo.assignedTo ? (
                    <div style={{ fontSize: 13, color: '#9aa3b2' }}>
                      {say("Clocked in:")}{' '}{say(wo.assignedTo.firstName)} {say(wo.assignedTo.lastName)}
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: '#f59e0b' }}>
                      {say("Awaiting clock-in")}{' '}</div>
                  )}
                </Link>
              ))}
            </div>
          </div>

          {/* Team Members */}
          <div>
            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 24, marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e5e7eb', marginBottom: 20 }}>{say("Team Members")}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {data.teamMembers.map((tech) => (
                  <div key={tech.id} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e7eb' }}>
                          {say(tech.firstName)} {say(tech.lastName)}
                        </div>
                        <div style={{ fontSize: 12, color: '#9aa3b2' }}>{say(tech.role)}</div>
                      </div>
                      <div style={{
                        padding: '4px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        background: tech.assignedWorkOrders?.length > 0 ? 'rgba(229,51,42,0.2)' : 'rgba(107,114,128,0.2)',
                        color: tech.assignedWorkOrders?.length > 0 ? '#ff6b64' : '#9aa3b2'
                      }}>
                        {tech.assignedWorkOrders?.length || 0} jobs
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Inventory Requests */}
            {data.stats.pendingInventoryRequests > 0 && (
              <div style={{ background: 'rgba(229,51,42,0.1)', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 12, padding: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#e5332a', marginBottom: 8 }}><FaExclamationTriangle style={{marginRight:4}} /> {say("Pending Inventory")}</h3>
                <p style={{ fontSize: 14, color: '#e5e7eb' }}>
                  {say(data.stats.pendingInventoryRequests)} {say("items need approval")}{' '}</p>
                <Link href="/shop/services" style={{ color: '#e5332a', textDecoration: 'none', fontSize: 14, fontWeight: 600, marginTop: 12, display: 'inline-block' }}>
                  {say("Review Requests")}{' '}<FaArrowRight style={{marginRight:4}} />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


