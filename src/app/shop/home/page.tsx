'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { FaBox, FaCar, FaChartBar, FaCog, FaIndustry, FaLock, FaMapMarkerAlt, FaRoad, FaStore, FaSyncAlt, FaTools, FaTruck, FaWrench } from 'react-icons/fa';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import Breadcrumbs from '@/components/Breadcrumbs';
import RealTimeWorkOrders from '@/components/RealTimeWorkOrders';
import MobileLayout from '@/components/MobileLayout';
import MobileShell from '@/components/MobileShell';
import { useRequireAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useIsNative } from '@/context/NativeContext';

interface Job {
  id: string;
  service: string;
  priority: string;
  customer: string;
  vehicle: string;
  time: string;
  tech: string;
  status: string;
  bay?: number | null;
}

type QuickAction = {
  label: React.ReactNode;
  href: string;
  tint: string;
  color: string;
  border: string;
  requiresAdmin?: boolean;
  hideForAdmin?: boolean;
  requiresManagerOrAdmin?: boolean;
};

export default function ShopHome() {
  const router = useRouter();
  const { user, isLoading } = useRequireAuth(['shop']);
  const isMobile = useIsMobile();
  const isNative = useIsNative();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [_todayJobs, _setTodayJobs] = useState<Job[]>([]);
  const [shopStats, setShopStats] = useState({
    openJobs: 0,
    completedToday: 0,
    todayRevenue: '$0',
    weekRevenue: '$0',
    activeTechs: 0,
    pendingApprovals: 0
  });
  const [selectedDestinations, setSelectedDestinations] = useState<Record<string, string>>({});
  const [pendingWorkOrders, setPendingWorkOrders] = useState<Job[]>([]);
  const [bays, setBays] = useState<Array<{ id: string; name: string; tech: string; jobs: Job[] }>>([]);
  const [_roadcallJobs, setRoadcallJobs] = useState<Job[]>([]);
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
  const [dragSourceBayId, setDragSourceBayId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [dashboardReady, setDashboardReady] = useState(false);

  // Fetch live dashboard data whenever the authenticated user is ready
  useEffect(() => {
    if (!user) return;
    const id = (user as any).shopId ?? user.id;
    if (!id) return;

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const toJob = (wo: any, statusLabel: string): Job => ({
      id: wo.id,
      service: wo.issueDescription || wo.repairs || 'Service',
      priority: wo.priority || 'Medium',
      customer: wo.customer
        ? `${wo.customer.firstName} ${wo.customer.lastName?.charAt(0) ?? ''}.`
        : 'Walk-in',
      vehicle: wo.vehicleType || '',
      time: new Date(wo.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      tech: wo.assignedTo
        ? `${wo.assignedTo.firstName} ${wo.assignedTo.lastName?.charAt(0) ?? ''}.`
        : 'Unassigned',
      status: statusLabel,
      bay: typeof wo.bay === 'number' ? wo.bay : null,
    });

    const fetchDashboard = async () => {
      try {
        const [statsRes, finRes, woRes, activeWoRes, teamRes, scheduleRes] = await Promise.all([
          fetch(`/api/shop/workorder-stats?shopId=${id}`, { headers }),
          fetch(`/api/shop/financial-summary?shopId=${id}`, { headers }),
          fetch(`/api/workorders?shopId=${id}&status=pending`, { headers }),
          fetch(`/api/workorders?shopId=${id}&status=assigned,in-progress,waiting-estimate,waiting-for-payment`, { headers }),
          fetch(`/api/shop/team?shopId=${id}`, { headers }),
          fetch('/api/shop/schedule', { headers }),
        ]);

        // Work order stats (open jobs, completed today, pending approvals)
        if (statsRes.ok) {
          const data = await statsRes.json();
          const s = data.stats || {};
          setShopStats(prev => ({
            ...prev,
            openJobs: (s.activeJobs || 0) + (s.pendingAssignments || 0),
            completedToday: s.completedToday || 0,
            pendingApprovals: s.pendingAssignments || 0,
          }));
        }

        // Financial summary (today + week revenue)
        if (finRes.ok) {
          const data = await finRes.json();
          const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
          setShopStats(prev => ({
            ...prev,
            todayRevenue: fmt(data.todayRevenue || 0),
            weekRevenue: fmt(data.weeklyRevenue || 0),
          }));
        }

        // Pending work orders queue
        if (woRes.ok) {
          const data = await woRes.json();
          const orders: Job[] = (data.workOrders || []).map((wo: any) => toJob(wo, 'Pending'));
          setPendingWorkOrders(orders);
        }

        // Team members + active tech count
        if (teamRes.ok) {
          const data = await teamRes.json();
          const members: any[] = data.teamMembers || [];
          setShopStats(prev => ({ ...prev, activeTechs: members.filter((m) => m.available).length }));
        }

        // Bays derive from schedule capacity settings
        if (scheduleRes.ok) {
          const data = await scheduleRes.json();
          const cap: number = Math.max(1, Number(data.capacity) || 1);
          const nextBays: Array<{ id: string; name: string; tech: string; jobs: Job[] }> = Array.from({ length: cap }, (_, i) => ({
            id: `bay-${i + 1}`,
            name: `Bay ${i + 1}`,
            tech: '',
            jobs: [],
          }));

          if (activeWoRes.ok) {
            const activeData = await activeWoRes.json();
            const activeOrders: any[] = activeData.workOrders || [];
            activeOrders.forEach((wo) => {
              const bayNumber = Number(wo.bay);
              if (!Number.isInteger(bayNumber) || bayNumber < 1 || bayNumber > cap) return;

              const targetBay = nextBays[bayNumber - 1];
              targetBay.jobs.push(toJob(wo, 'In Bay'));
            });
          }

          setBays(nextBays);
        }
      } catch {
        // Dashboard will show zeros/empty  not a crash
      }
    };

    setDashboardReady(false);
    fetchDashboard().finally(() => setDashboardReady(true));

    const refresh = setInterval(() => {
      fetchDashboard();
    }, 30 * 1000);

    return () => clearInterval(refresh);
  }, [user]);

  const quickActions: QuickAction[] = [
    { label: <><FaBox style={{marginRight:6}}/>Service Catalog</>, href: '/shop/services', tint: 'rgba(229,51,42,0.18)', color: '#e5332a', border: 'rgba(229,51,42,0.28)' },
    {
      label:
        user?.role === 'manager'
          ? <><FaChartBar style={{marginRight:6}}/>Manager Panel</>
          : user?.role === 'tech'
          ? <><FaWrench style={{marginRight:6}}/>Tech Panel</>
          : <><FaCog style={{marginRight:6}}/>Shop Admin Panel</>,
      href:
        user?.role === 'manager'
          ? '/shop/manager'
          : user?.role === 'tech'
          ? '/shop/tech'
          : '/shop/admin',
      tint:
        user?.role === 'manager'
          ? 'rgba(229,51,42,0.18)'
          : user?.role === 'tech'
          ? 'rgba(34,197,94,0.18)'
          : 'rgba(229,51,42,0.2)',
      color:
        user?.role === 'manager'
          ? '#e5332a'
          : user?.role === 'tech'
          ? '#22c55e'
          : '#e5332a',
      border:
        user?.role === 'manager'
          ? 'rgba(229,51,42,0.28)'
          : user?.role === 'tech'
          ? 'rgba(34,197,94,0.28)'
          : 'rgba(229,51,42,0.3)',
      requiresAdmin: user?.role === 'admin',
      requiresManagerOrAdmin: user?.role === 'manager',
      hideForAdmin: user?.role === 'tech',
    },
    { label: <><FaBox style={{marginRight:6}}/>Parts Orders</>, href: '/shop/purchase-orders', tint: 'rgba(139,92,246,0.18)', color: '#8b5cf6', border: 'rgba(139,92,246,0.28)' },
    { label: <><FaTools style={{marginRight:6}}/>Services</>, href: '/shop/services', tint: 'rgba(245,158,11,0.18)', color: '#f59e0b', border: 'rgba(245,158,11,0.28)' },
    { label: <><FaStore style={{marginRight:6}}/>New In-Shop Job</>, href: '/workorders/inshop', tint: 'rgba(229,51,42,0.18)', color: '#e5332a', border: 'rgba(229,51,42,0.28)' },
    { label: <><FaRoad style={{marginRight:6}}/>New Roadside Job</>, href: '/workorders/roadside', tint: 'rgba(59,130,246,0.18)', color: '#60a5fa', border: 'rgba(59,130,246,0.28)' },
    { label: <><FaIndustry style={{marginRight:6}}/>Vendors</>, href: '/shop/vendors', tint: 'rgba(139,92,246,0.18)', color: '#8b5cf6', border: 'rgba(139,92,246,0.28)' },
    { label: <><FaMapMarkerAlt style={{marginRight:6}}/>Locations</>, href: '/shop/locations', tint: 'rgba(20,184,166,0.18)', color: '#14b8a6', border: 'rgba(20,184,166,0.28)' },
    { label: <><FaSyncAlt style={{marginRight:6}}/>Recurring Orders</>, href: '/shop/recurring-workorders', tint: 'rgba(34,197,94,0.18)', color: '#22c55e', border: 'rgba(34,197,94,0.28)' },
    { label: <><FaLock style={{marginRight:6}}/>Two-Factor Auth</>, href: '/shop/settings/two-factor', tint: 'rgba(229,51,42,0.18)', color: '#e5332a', border: 'rgba(229,51,42,0.28)' }
  ];
  const priorityStyles: Record<string, { bg: string; color: string }> = {
    High: { bg: 'rgba(229,51,42,0.2)', color: '#e5332a' },
    Medium: { bg: 'rgba(245,158,11,0.2)', color: '#f59e0b' },
    Low: { bg: 'rgba(229,51,42,0.18)', color: '#e5332a' }
  };

  //  Mobile / native: show the tile-grid shell immediately 
  // This check MUST come before the isLoading guard so that:
  //  1. The server renders MobileShell (not a Loading spinner) for mobile UAs,
  //     giving mobile users the correct view from byte 1.
  //  2. The client never flashes the desktop layout while auth is resolving.
  // The MobileShell itself handles the case where user is still loading.
  if (isNative || isMobile) {
    return <MobileShell role="shop" isHome userName={user?.name} />;
  }

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

  if (!user) {
    return null;
  }

  const isManager = user.role === 'manager';

  const _handleSignOut = () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    router.push('/auth/login' as Route);
  };

  const _handleOrderPart = async (partName: string, currentStock: number, reorderLevel: number) => {
    const orderQuantity = reorderLevel * 2;
    try {
      const token = localStorage.getItem('token');
      const r = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          vendor: 'Auto-reorder',
          notes: `Auto-reorder: ${partName}  -  current stock ${currentStock}, order qty ${orderQuantity}`,
          items: [{ partNumber: '', description: partName, qty: orderQuantity, unitCost: 0 }],
        }),
      });
      if (r.ok) {
        // Redirect to purchase orders page so user can complete the PO
        router.push('/shop/purchase-orders' as Route);
      }
    } catch {
      // Silently ignore  -  non-critical path
    }
  };

  const _handleOpenWorkorder = (orderId: string) => {
    router.push(`/workorders/${orderId}` as Route);
  };

  const persistPlacement = async (orderId: string, bay: number | null, status: 'assigned' | 'pending') => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    await fetch(`/api/workorders/${orderId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ bay, status }),
    });
  };

  const handleAssign = async (orderId: string, destinationId: string) => {
    setPendingWorkOrders(prev => {
      const order = prev.find(o => o.id === orderId);
      if (!order) return prev;

      if (destinationId === 'roadcall') {
        setRoadcallJobs(current => {
          const exists = current.some(job => job.id === order.id);
          return exists ? current : [...current, { ...order, status: 'Roadcall' }];
        });
      } else {
        setBays(current =>
          current.map(bay => {
            if (bay.id !== destinationId) return bay;
            const exists = bay.jobs.some(job => job.id === order.id);
            return exists ? bay : { ...bay, jobs: [...bay.jobs, { ...order, status: 'In Bay' }] };
          })
        );
      }

      return prev.filter(o => o.id !== orderId);
    });

    // Persist assignment to server
    try {
      const bayNumber = destinationId.startsWith('bay-') ? Number(destinationId.replace('bay-', '')) : null;
      await persistPlacement(orderId, destinationId === 'roadcall' ? null : bayNumber, 'assigned');
    } catch {
      console.error('Failed to persist bay assignment');
    }
  };

  const handleReturnToPending = async (bayId: string, orderId: string) => {
    let moved: Job | undefined;
    setBays(current => {
      const updated = current.map(bay => {
        if (bay.id !== bayId) return bay;
        const job = bay.jobs.find(j => j.id === orderId);
        if (job) {
          moved = job;
        }
        return { ...bay, jobs: bay.jobs.filter(j => j.id !== orderId) };
      });
      return updated;
    });

    if (moved) {
      const movedJob: Job = moved;
      setPendingWorkOrders(prev => [...prev, { ...movedJob, status: 'Pending' }]);

      try {
        await persistPlacement(orderId, null, 'pending');
      } catch {
        console.error('Failed to persist return to pending');
      }
    }
  };

  const handleMoveFromBay = async (orderId: string, sourceBayId: string, destinationId: string) => {
    if (sourceBayId === destinationId) return;

    let moved: Job | undefined;
    setBays((current) => {
      const withoutSourceJob = current.map((bay) => {
        if (bay.id !== sourceBayId) return bay;
        const job = bay.jobs.find((j) => j.id === orderId);
        if (job) moved = job;
        return { ...bay, jobs: bay.jobs.filter((j) => j.id !== orderId) };
      });

      if (!moved) return current;

      if (destinationId === 'roadcall') {
        setRoadcallJobs((currentRoadcall) => {
          const exists = currentRoadcall.some((job) => job.id === orderId);
          return exists ? currentRoadcall : [...currentRoadcall, { ...moved!, status: 'Roadcall', bay: null }];
        });
        return withoutSourceJob;
      }

      return withoutSourceJob.map((bay) => {
        if (bay.id !== destinationId) return bay;
        const exists = bay.jobs.some((job) => job.id === orderId);
        return exists ? bay : { ...bay, jobs: [...bay.jobs, { ...moved!, status: 'In Bay' }] };
      });
    });

    const bayNumber = destinationId.startsWith('bay-') ? Number(destinationId.replace('bay-', '')) : null;
    try {
      await persistPlacement(orderId, destinationId === 'roadcall' ? null : bayNumber, 'assigned');
    } catch {
      console.error('Failed to persist bay move');
    }
  };

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, orderId: string, sourceBayId?: string) => {
    event.dataTransfer.setData('application/json', JSON.stringify({ orderId, sourceBayId: sourceBayId ?? null }));
    event.dataTransfer.setData('text/plain', orderId);
    event.dataTransfer.effectAllowed = 'move';
    setDraggedOrderId(orderId);
    setDragSourceBayId(sourceBayId ?? null);
  };

  const handleDragEnd = () => {
    setDraggedOrderId(null);
    setDragSourceBayId(null);
    setDragOverTarget(null);
  };

  const handleDropToDestination = (event: React.DragEvent<HTMLDivElement>, destinationId: string) => {
    event.preventDefault();
    const payloadRaw = event.dataTransfer.getData('application/json');
    const payload = payloadRaw ? JSON.parse(payloadRaw) as { orderId?: string; sourceBayId?: string | null } : null;
    const orderId = payload?.orderId || event.dataTransfer.getData('text/plain') || draggedOrderId;
    const sourceBayId = payload?.sourceBayId ?? dragSourceBayId;
    setDragOverTarget(null);
    setDraggedOrderId(null);
    setDragSourceBayId(null);
    if (!orderId) return;

    if (sourceBayId) {
      void handleMoveFromBay(orderId, sourceBayId, destinationId);
      return;
    }

    handleAssign(orderId, destinationId);
  };

  const handleDropToPending = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const payloadRaw = event.dataTransfer.getData('application/json');
    const payload = payloadRaw ? JSON.parse(payloadRaw) as { orderId?: string; sourceBayId?: string | null } : null;
    const orderId = payload?.orderId || event.dataTransfer.getData('text/plain') || draggedOrderId;
    const sourceBayId = payload?.sourceBayId ?? dragSourceBayId;

    setDragOverTarget(null);
    setDraggedOrderId(null);
    setDragSourceBayId(null);

    if (!orderId || !sourceBayId) return;
    void handleReturnToPending(sourceBayId, orderId);
  };

  const _handleReturnRoadcallToPending = (orderId: string) => {
    let moved: Job | undefined;
    setRoadcallJobs(current => {
      moved = current.find(j => j.id === orderId);
      return current.filter(j => j.id !== orderId);
    });
    if (!moved) return;
    const movedJob: Job = moved;
    setPendingWorkOrders(prev => [...prev, { ...movedJob, status: 'Pending' }]);
  };

  // (Mobile check was moved before the isLoading guard above)

  return (
    <MobileLayout
      role="shop"
      showSidebar={true}
      sidebarContent={<Sidebar role="shop" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
      topNavContent={
        <>
          <TopNavBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} showMenuButton={true} />
          <Breadcrumbs />
        </>
      }
    >
      <div style={{maxWidth:1400, margin:'0 auto', padding: sidebarOpen ? '0 32px 32px 32px' : '0 32px 32px 32px'}}>
        <div
          className="quick-actions-slider"
          style={{display:'flex', flexWrap:'nowrap', gap:12, alignItems:'center', margin:'0 0 20px 0', overflowX:'auto', paddingBottom:4}}
        >
          <span style={{fontSize:13, color:'#9aa3b2', fontWeight:700}}>Quick Actions</span>
          {quickActions.map(action => {
            if (action.requiresAdmin && !user.isShopAdmin) return null;
            if (action.hideForAdmin && user.isShopAdmin) return null;
            if (action.requiresManagerOrAdmin && !(user.isShopAdmin || isManager)) return null;
            return (
              <Link
                key={action.href}
                href={action.href as Route}
                style={{
                  padding:'10px 14px',
                  background:action.tint,
                  color:action.color,
                  border:`1px solid ${action.border}`,
                  borderRadius:10,
                  fontSize:13,
                  fontWeight:700,
                  textDecoration:'none',
                  whiteSpace:'nowrap',
                  flexShrink:0
                }}
              >
                {action.label}
              </Link>
            );
          })}
        </div>

        {/* Shop Stats */}
        <div style={{display:'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(180px, 1fr))', gap: isMobile ? 10 : 16, marginBottom: isMobile ? 16 : 32}}>
          <div style={{background:'rgba(229,51,42,0.1)', border:'1px solid rgba(229,51,42,0.3)', borderRadius:12, padding:20}}>
            <div style={{fontSize:13, color:'#9aa3b2', marginBottom:8}}>Open Jobs</div>
            <div style={{fontSize:32, fontWeight:700, color:'#e5332a'}}>{dashboardReady ? shopStats.openJobs : '...'} </div>
          </div>
          <div style={{background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:12, padding:20}}>
            <div style={{fontSize:13, color:'#9aa3b2', marginBottom:8}}>Completed Today</div>
            <div style={{fontSize:32, fontWeight:700, color:'#22c55e'}}>{dashboardReady ? shopStats.completedToday : '...'} </div>
          </div>
          <div style={{background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:12, padding:20}}>
            <div style={{fontSize:13, color:'#9aa3b2', marginBottom:8}}>Today's Revenue</div>
            <div style={{fontSize:32, fontWeight:700, color:'#22c55e'}}>{dashboardReady ? shopStats.todayRevenue : 'Syncing...'} </div>
          </div>
          <div style={{background:'rgba(168,85,247,0.1)', border:'1px solid rgba(168,85,247,0.3)', borderRadius:12, padding:20}}>
            <div style={{fontSize:13, color:'#9aa3b2', marginBottom:8}}>This Week</div>
            <div style={{fontSize:32, fontWeight:700, color:'#a855f7'}}>{dashboardReady ? shopStats.weekRevenue : 'Syncing...'} </div>
          </div>
          <div style={{background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:12, padding:20}}>
            <div style={{fontSize:13, color:'#9aa3b2', marginBottom:8}}>Active Techs</div>
            <div style={{fontSize:32, fontWeight:700, color:'#f59e0b'}}>{dashboardReady ? shopStats.activeTechs : '...'} </div>
          </div>
          <div style={{background:'rgba(229,51,42,0.1)', border:'1px solid rgba(229,51,42,0.3)', borderRadius:12, padding:20}}>
            <div style={{fontSize:13, color:'#9aa3b2', marginBottom:8}}>Pending Approvals</div>
            <div style={{fontSize:32, fontWeight:700, color:'#e5332a'}}>{dashboardReady ? shopStats.pendingApprovals : '...'} </div>
          </div>
        </div>

        <div style={{display:'flex', flexDirection:'column', gap: isMobile ? 16 : 24}}>
            {/* Tall Insight Card above today's schedule */}
            <div style={{background:'rgba(0,0,0,0.35)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:12, padding:24, minHeight:800}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, gap:12, flexWrap:'wrap'}}>
                <div>
                  <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb'}}>Ops Overview</h2>
                  <div style={{display:'flex', gap:8, marginTop:6, flexWrap:'wrap'}}>
                    <span style={{padding:'4px 10px', background:'rgba(229,51,42,0.16)', color:'#e5332a', borderRadius:12, fontSize:11, fontWeight:700}}>
                      Pending: {pendingWorkOrders.length}
                    </span>
                    <span style={{padding:'4px 10px', background:'rgba(229,51,42,0.16)', color:'#ff6b64', borderRadius:12, fontSize:11, fontWeight:700}}>
                      Bays: {bays.length} configured ({bays.reduce((sum, bay) => sum + bay.jobs.length, 0)} active)
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Link
                    href={'/workorders/inshop' as Route}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'rgba(229,51,42,0.18)',
                      border: '1px solid rgba(229,51,42,0.35)',
                      color: '#ff6b64',
                      textDecoration: 'none',
                      fontSize: 12,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <FaCar /> In-Shop Work Order
                  </Link>
                  <Link
                    href={'/workorders/roadside' as Route}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'rgba(59,130,246,0.16)',
                      border: '1px solid rgba(59,130,246,0.35)',
                      color: '#93c5fd',
                      textDecoration: 'none',
                      fontSize: 12,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <FaRoad /> Roadside Work Order
                  </Link>
                  <span style={{padding:'4px 10px', background:'rgba(34,197,94,0.2)', color:'#22c55e', borderRadius:12, fontSize:11, fontWeight:700}}>
                    Drag-free handoff
                  </span>
                </div>
              </div>

              <div style={{display:'grid', gridTemplateColumns:'1fr', gap:16, alignItems:'start'}}>
                {/* Pending Queue */}
                <div
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOverTarget('pending');
                  }}
                  onDragLeave={() => setDragOverTarget((current) => current === 'pending' ? null : current)}
                  onDrop={handleDropToPending}
                  style={{
                    background: dragOverTarget === 'pending' ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)',
                    border: dragOverTarget === 'pending' ? '1px solid rgba(245,158,11,0.45)' : '1px solid rgba(255,255,255,0.08)',
                    borderRadius:12,
                    padding:14,
                    minHeight:220,
                  }}
                >
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
                    <div style={{fontSize:15, fontWeight:700, color:'#e5e7eb'}}>Pending Queue</div>
                    <span style={{fontSize:12, color:'#9aa3b2'}}>Drag work orders into a bay</span>
                  </div>
                  {dragOverTarget === 'pending' && (
                    <div style={{marginBottom:10, padding:'10px 12px', border:'1px dashed rgba(245,158,11,0.7)', borderRadius:8, background:'rgba(245,158,11,0.12)', color:'#f59e0b', fontSize:12, fontWeight:700}}>
                      Release to return this work order to pending queue
                    </div>
                  )}
                  <div style={{display:'flex', flexDirection:'column', gap:10}}>
                    {pendingWorkOrders.length === 0 && (
                      <div style={{color:'#9aa3b2', fontSize:13, padding:12, border:'1px dashed rgba(255,255,255,0.15)', borderRadius:10}}>
                        No customers waiting  -  nice work.
                      </div>
                    )}
                    {pendingWorkOrders.map(order => {
                      const style = priorityStyles[order.priority] || priorityStyles.Medium;
                      const destinationOptions = [...bays.map(b => ({ id: b.id, label: b.name })), { id: 'roadcall', label: <><FaTruck style={{marginRight:4}} /> Roadcall</> }];
                      const selected = selectedDestinations[order.id] || destinationOptions[0]?.id || 'roadcall';
                      return (
                        <div
                          key={order.id}
                          draggable
                          onDragStart={(event) => handleDragStart(event, order.id)}
                          onDragEnd={handleDragEnd}
                          style={{
                            background:'rgba(255,255,255,0.04)',
                            border:'1px solid rgba(255,255,255,0.08)',
                            borderRadius:10,
                            padding:12,
                            display:'flex',
                            flexDirection:'column',
                            gap:8,
                            cursor:'grab',
                            opacity: draggedOrderId === order.id ? 0.6 : 1,
                          }}
                        >
                          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                            <div style={{fontSize:14, fontWeight:700, color:'#e5e7eb'}}>{order.service}</div>
                            <span style={{padding:'4px 8px', background:style.bg, color:style.color, borderRadius:8, fontSize:11, fontWeight:700}}>{order.priority}</span>
                          </div>
                          <div style={{fontSize:12, color:'#9aa3b2'}}>
                            {order.customer} - {order.vehicle} - {order.id}
                          </div>
                          <div style={{display:'flex', gap:8, alignItems:'stretch'}}>
                            <div style={{flex:1, display:'flex', flexDirection:'column', gap:6}}>
                              <div style={{fontSize:12, color:'#9aa3b2'}}>Destination</div>
                              <div style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:4, maxHeight:200, overflowY:'auto', height:'100%'}}>
                                <select
                                  value={selected}
                                  onChange={(e) => setSelectedDestinations(prev => ({ ...prev, [order.id]: e.target.value }))}
                                  size={destinationOptions.length}
                                  style={{width:'100%', background:'transparent', color:'#e5e7eb', border:'none', outline:'none', fontSize:12, cursor:'pointer', height:'100%'}}
                                >
                                  {destinationOptions.map(opt => (
                                    <option key={opt.id} value={opt.id} style={{background:'#000000', color:'#e5e7eb'}}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div style={{display:'flex', alignItems:'flex-end'}}>
                              <button
                                onClick={() => handleAssign(order.id, selected)}
                                style={{padding:'8px 12px', background:'rgba(34,197,94,0.16)', color:'#22c55e', border:'1px solid rgba(34,197,94,0.3)', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', alignSelf:'stretch'}}
                              >
                                Dispatch to {destinationOptions.find(opt => opt.id === selected)?.label || 'Bay'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bays Board */}
                <div style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:14}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
                    <div style={{fontSize:15, fontWeight:700, color:'#e5e7eb'}}>Service Bays</div>
                    <span style={{fontSize:12, color:'#9aa3b2'}}>Drop to assign</span>
                  </div>

                  <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:10}}>
                    {bays.map((bay) => (
                      <div
                        key={bay.id}
                        onDragOver={(event) => {
                          event.preventDefault();
                          setDragOverTarget(bay.id);
                        }}
                        onDragLeave={() => setDragOverTarget((current) => current === bay.id ? null : current)}
                        onDrop={(event) => handleDropToDestination(event, bay.id)}
                        style={{
                          border: dragOverTarget === bay.id ? '1px solid rgba(34,197,94,0.7)' : '1px solid rgba(255,255,255,0.1)',
                          background: dragOverTarget === bay.id ? 'rgba(34,197,94,0.08)' : 'rgba(0,0,0,0.25)',
                          borderRadius: 10,
                          padding: 12,
                          minHeight: 120,
                        }}
                      >
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                          <div style={{color:'#e5e7eb', fontWeight:700, fontSize:13}}>{bay.name}</div>
                          <span style={{color: bay.jobs.length ? '#22c55e' : '#9aa3b2', fontSize:11}}>{bay.jobs.length} job(s)</span>
                        </div>

                        {bay.jobs.length === 0 ? (
                          <div style={{fontSize:12, color:'#9aa3b2'}}>Drop work order here</div>
                        ) : (
                          <div style={{display:'flex', flexDirection:'column', gap:8}}>
                            {bay.jobs.map((job) => (
                              <div
                                key={job.id}
                                draggable
                                onDragStart={(event) => handleDragStart(event, job.id, bay.id)}
                                onDragEnd={handleDragEnd}
                                style={{
                                  background:'rgba(255,255,255,0.06)',
                                  border:'1px solid rgba(255,255,255,0.08)',
                                  borderRadius:8,
                                  padding:8,
                                  cursor:'grab',
                                  opacity: draggedOrderId === job.id ? 0.6 : 1,
                                }}
                              >
                                <div style={{fontSize:12, fontWeight:700, color:'#e5e7eb', marginBottom:4}}>{job.service}</div>
                                <div style={{fontSize:11, color:'#9aa3b2'}}>{job.customer}</div>
                                <button
                                  onClick={() => void handleReturnToPending(bay.id, job.id)}
                                  style={{marginTop:8, width:'100%', padding:'6px 8px', background:'rgba(245,158,11,0.12)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.3)', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer'}}
                                >
                                  Return To Queue
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {dragOverTarget === bay.id && (
                          <div style={{marginTop:8, padding:'8px 10px', border:'1px dashed rgba(34,197,94,0.75)', borderRadius:8, background:'rgba(34,197,94,0.12)', color:'#22c55e', fontSize:11, fontWeight:700}}>
                            Release to assign here
                          </div>
                        )}
                      </div>
                    ))}

                    <div
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragOverTarget('roadcall');
                      }}
                      onDragLeave={() => setDragOverTarget((current) => current === 'roadcall' ? null : current)}
                      onDrop={(event) => handleDropToDestination(event, 'roadcall')}
                      style={{
                        border: dragOverTarget === 'roadcall' ? '1px solid rgba(59,130,246,0.7)' : '1px solid rgba(255,255,255,0.1)',
                        background: dragOverTarget === 'roadcall' ? 'rgba(59,130,246,0.08)' : 'rgba(0,0,0,0.25)',
                        borderRadius: 10,
                        padding: 12,
                        minHeight: 120,
                      }}
                    >
                      <div style={{color:'#e5e7eb', fontWeight:700, fontSize:13, marginBottom:8}}><FaTruck style={{marginRight:4}} /> Roadcall Queue</div>
                      <div style={{fontSize:12, color:'#9aa3b2'}}>Drop work order here for mobile service dispatch</div>
                      {dragOverTarget === 'roadcall' && (
                        <div style={{marginTop:8, padding:'8px 10px', border:'1px dashed rgba(59,130,246,0.75)', borderRadius:8, background:'rgba(59,130,246,0.12)', color:'#60a5fa', fontSize:11, fontWeight:700}}>
                          Release to dispatch as roadcall
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

        </div>

      </div>

      {/* Real-Time Work Orders Updates */}
      <RealTimeWorkOrders userId={user.id} />

      <style jsx global>{`
        .quick-actions-slider {
          scrollbar-width: thin;
          scrollbar-color: #e5332a #000000;
        }

        .quick-actions-slider::-webkit-scrollbar {
          height: 10px;
        }

        .quick-actions-slider::-webkit-scrollbar-track {
          background: #000000;
          border-radius: 999px;
        }

        .quick-actions-slider::-webkit-scrollbar-thumb {
          background: #e5332a;
          border-radius: 999px;
          border: 2px solid #000000;
        }

        .quick-actions-slider::-webkit-scrollbar-thumb:hover {
          background: #ff4b42;
        }
      `}</style>
    </MobileLayout>
  );
}


