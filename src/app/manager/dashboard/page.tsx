'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import QuickActionCard from '@/components/QuickActionCard';
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
  const _router = useRouter();
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
        console.error(<><FaTimesCircle style={{marginRight:4}} /> Failed to fetch dashboard data:</>, response.status, errorData);
      }
    } catch (error) {
      console.error(<><FaBolt style={{marginRight:4}} /> Error fetching dashboard:</>, error);
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
        Loading...
      </div>
    );
  }

  // If no user, the useRequireAuth hook will handle redirect
  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#e5e7eb', fontSize: 20 }}>Loading dashboard...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ minHeight: "100vh", background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#e5e7eb', fontSize: 20 }}>Failed to load dashboard data</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: 'transparent' }}>
      {/* Header */}
      <div style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(229,51,42,0.3)', padding: '20px 32px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <Link href="/manager/home" style={{ color: '#e5332a', textDecoration: 'none', fontSize: 14, fontWeight: 600, marginBottom: 8, display: 'inline-block' }}>
            <FaArrowLeft style={{marginRight:4}} /> Back to Manager Home
          </Link>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', marginBottom: 4 }}><FaChartBar style={{marginRight:4}} /> Manager Dashboard</h1>
          <p style={{ fontSize: 14, color: '#9aa3b2' }}>Team overview and work order management</p>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: 32 }}>
        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 14, color: '#9aa3b2', marginBottom: 8 }}>Open Jobs</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#e5332a' }}>{data.stats.openJobs}</div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 14, color: '#9aa3b2', marginBottom: 8 }}>Pending</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#f59e0b' }}>{data.stats.pendingJobs}</div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 14, color: '#9aa3b2', marginBottom: 8 }}>Completed Today</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#10b981' }}>{data.stats.completedToday}</div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 14, color: '#9aa3b2', marginBottom: 8 }}>Active Techs</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#a855f7' }}>{data.stats.activeTechs}/{data.stats.totalTechs}</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e5e7eb', marginBottom: 16 }}>Quick Actions</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
            <QuickActionCard
              icon={<FaPlus />}
              title="New Work Order"
              description="Create a new work order for a customer"
              href="/shop/new-inshop-job"
              color="#22c55e"
            />
            <QuickActionCard
              icon={<FaUsers />}
              title="Team Management"
              description="View and manage your team members"
              href="/manager/team"
              color="#e5332a"
              badge={data.stats.totalTechs}
            />
            <QuickActionCard
              icon={<FaClipboardList />}
              title="Work Assignments"
              description="Assign work orders to technicians"
              href="/manager/assignments"
              color="#f59e0b"
              badge={data.stats.pendingJobs}
            />
            <QuickActionCard
              icon={<FaWrench />}
              title="Inventory"
              description="Manage parts and equipment"
              href="/manager/inventory"
              color="#a855f7"
              badge={data.stats.pendingInventoryRequests}
            />
            <QuickActionCard
              icon={<FaBox />}
              title="Reports"
              description="View analytics and performance reports"
              href="/manager/reports"
              color="#06b6d4"
            />
          </div>
        </div>

        {/* Main Content Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 24 }}>
          {/* Recent Work Orders */}
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e5e7eb' }}>Recent Work Orders</h2>
              <Link href="/manager/assignments" style={{ color: '#e5332a', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
                Assign Work <FaArrowRight style={{marginRight:4}} />
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {data.recentWorkOrders.slice(0, 10).map((wo) => (
                <div key={wo.id} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e7eb' }}>
                      WO-{wo.id.slice(0, 8)}
                    </div>
                    <div style={{
                      padding: '4px 8px',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      background: wo.status === 'completed' ? 'rgba(16,185,129,0.2)' : wo.status === 'in-progress' ? 'rgba(229,51,42,0.2)' : 'rgba(245,158,11,0.2)',
                      color: wo.status === 'completed' ? '#10b981' : wo.status === 'in-progress' ? '#ff6b64' : '#f59e0b'
                    }}>
                      {wo.status}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: '#9aa3b2', marginBottom: 4 }}>
                    Customer: {wo.customer?.firstName} {wo.customer?.lastName}
                  </div>
                  {wo.assignedTo && (
                    <div style={{ fontSize: 13, color: '#9aa3b2' }}>
                      Assigned to: {wo.assignedTo.firstName} {wo.assignedTo.lastName}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Team Members */}
          <div>
            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 24, marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e5e7eb', marginBottom: 20 }}>Team Members</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {data.teamMembers.map((tech) => (
                  <div key={tech.id} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e7eb' }}>
                          {tech.firstName} {tech.lastName}
                        </div>
                        <div style={{ fontSize: 12, color: '#9aa3b2' }}>{tech.role}</div>
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
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#e5332a', marginBottom: 8 }}><FaExclamationTriangle style={{marginRight:4}} /> Pending Inventory</h3>
                <p style={{ fontSize: 14, color: '#e5e7eb' }}>
                  {data.stats.pendingInventoryRequests} items need approval
                </p>
                <Link href="/shop/services" style={{ color: '#e5332a', textDecoration: 'none', fontSize: 14, fontWeight: 600, marginTop: 12, display: 'inline-block' }}>
                  Review Requests <FaArrowRight style={{marginRight:4}} />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


