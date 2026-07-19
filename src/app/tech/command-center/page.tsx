'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import Breadcrumbs from '@/components/Breadcrumbs';
import MobileLayout from '@/components/MobileLayout';
import MobileShell from '@/components/MobileShell';
import { useRequireAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useIsNative } from '@/context/NativeContext';
import { FaArrowRight, FaCar, FaClipboardList, FaExclamationCircle, FaRoad, FaTools } from 'react-icons/fa';

interface Job {
  id: string;
  sourceId?: string;
  sourceType?: 'workorder';
  service: string;
  priority: string;
  customer: string;
  vehicle: string;
  time: string;
  tech: string;
  status: string;
  bay?: number | null;
  serviceLocation?: 'in-shop' | 'road-call' | 'other';
  isAppointment?: boolean;
}

export default function TechCommandCenter() {
  const { user, isLoading } = useRequireAuth(['tech']);
  const isMobile = useIsMobile();
  const isNative = useIsNative();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [stats, setStats] = useState({
    roadcalls: 0,
    appointments: 0,
    walkins: 0,
    baysConfigured: 0,
    baysActive: 0,
  });
  const [pendingWorkOrders, setPendingWorkOrders] = useState<Job[]>([]);
  const [bays, setBays] = useState<Array<{ id: string; name: string; tech: string; jobs: Job[] }>>([]);
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  const toJob = (wo: any, statusLabel: string): Job => ({
    id: wo.id,
    sourceId: wo.id,
    sourceType: 'workorder',
    service: (typeof wo.issueDescription === 'string' ? wo.issueDescription : wo.issueDescription?.symptoms) || (typeof wo.repairs === 'string' ? wo.repairs : '') || 'Service',
    priority: wo.priority || 'Medium',
    customer: wo.customer ? `${wo.customer.firstName} ${wo.customer.lastName?.charAt(0) ?? ''}.` : 'Walk-in',
    vehicle: wo.vehicleType || '',
    time: new Date(wo.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    tech: wo.assignedTo ? `${wo.assignedTo.firstName} ${wo.assignedTo.lastName?.charAt(0) ?? ''}.` : 'Unassigned',
    status: statusLabel,
    serviceLocation: (() => {
      const raw = String(wo.serviceLocation || '').toLowerCase();
      if (raw === 'road-call' || raw === 'roadside') return 'road-call';
      if (raw === 'in-shop') return 'in-shop';
      return 'other';
    })(),
    isAppointment: Boolean(
      wo?.location?.source === 'appointment' ||
      wo?.location?.createdFrom === 'appointment' ||
      (typeof wo.issueDescription === 'string' && wo.issueDescription.startsWith('Appointment:')) ||
      (typeof wo.issueDescription?.symptoms === 'string' && wo.issueDescription.symptoms.startsWith('Appointment:'))
    ),
    bay: typeof wo.bay === 'number' ? wo.bay : null,
  });

  const fetchDashboard = async (shopId: string) => {
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      // Fetch pending work orders
      const pendingRes = await fetch(`/api/workorders?shopId=${shopId}&status=pending`, { headers });
      const activeRes = await fetch(`/api/workorders?shopId=${shopId}&status=assigned,in-progress,waiting-estimate,waiting-for-payment`, { headers });
      const scheduleRes = await fetch('/api/shop/schedule', { headers });

      // Process pending queue
      const pendingOrders: Job[] = pendingRes.ok
        ? ((await pendingRes.json()).workOrders || []).map((wo: any) => toJob(wo, 'Pending'))
        : [];

      const roadcalls = pendingOrders.filter((o) => o.serviceLocation === 'road-call').length;
      const appointments = pendingOrders.filter((o) => o.serviceLocation === 'in-shop' && o.isAppointment).length;
      const walkins = pendingOrders.filter((o) => o.serviceLocation === 'in-shop' && !o.isAppointment).length;

      setPendingWorkOrders(pendingOrders);

      // Setup bays
      if (scheduleRes.ok) {
        const data = await scheduleRes.json();
        const cap: number = Math.max(1, Number(data.capacity) || 1);
        const nextBays: Array<{ id: string; name: string; tech: string; jobs: Job[] }> = Array.from({ length: cap }, (_, i) => ({
          id: `bay-${i + 1}`,
          name: `Bay ${i + 1}`,
          tech: '',
          jobs: [],
        }));

        if (activeRes.ok) {
          const activeData = await activeRes.json();
          const activeOrders: any[] = activeData.workOrders || [];
          activeOrders.forEach((wo) => {
            const bayNumber = Number(wo.bay);
            if (!Number.isInteger(bayNumber) || bayNumber < 1 || bayNumber > cap) return;

            const targetBay = nextBays[bayNumber - 1];
            targetBay.jobs.push(toJob(wo, 'In Bay'));
          });
        }

        setBays(nextBays);
        setStats({
          roadcalls,
          appointments,
          walkins,
          baysConfigured: cap,
          baysActive: nextBays.reduce((sum, bay) => sum + bay.jobs.length, 0),
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    }
  };

  useEffect(() => {
    if (!user?.shopId) return;
    const shopId = user.shopId;
    fetchDashboard(shopId);
    const interval = setInterval(() => fetchDashboard(shopId), 30000);
    return () => clearInterval(interval);
  }, [user?.shopId]);

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, orderId: string) => {
    event.dataTransfer.effectAllowed = 'move';
    setDraggedOrderId(orderId);
  };

  const handleDragEnd = () => {
    setDraggedOrderId(null);
    setDragOverTarget(null);
  };

  const handleDropToBay = (event: React.DragEvent<HTMLDivElement>, bayId: string) => {
    event.preventDefault();
    const orderId = draggedOrderId;
    if (!orderId) return;

    const order = pendingWorkOrders.find(o => o.id === orderId);
    if (!order) return;

    setBays(current => current.map(bay => {
      if (bay.id !== bayId) return bay;
      const exists = bay.jobs.some(job => job.id === orderId);
      return exists ? bay : { ...bay, jobs: [...bay.jobs, { ...order, status: 'In Bay' }] };
    }));

    setPendingWorkOrders(prev => prev.filter(o => o.id !== orderId));
    setDragOverTarget(null);
    setDraggedOrderId(null);

    // Persist to server
    const bayNumber = Number(bayId.replace('bay-', ''));
    fetch(`/api/workorders/${orderId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ bay: bayNumber, status: 'assigned' }),
    }).catch(console.error);
  };

  const handleReturnToPending = (bayId: string, orderId: string) => {
    const sourceBay = bays.find(b => b.id === bayId);
    const moved = sourceBay?.jobs.find(j => j.id === orderId);

    setBays(current => current.map(bay =>
      bay.id !== bayId ? bay : { ...bay, jobs: bay.jobs.filter(j => j.id !== orderId) }
    ));

    if (moved) {
      setPendingWorkOrders(prev => [...prev, { ...moved, status: 'Pending' }]);
      fetch(`/api/workorders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ bay: null, status: 'pending' }),
      }).catch(console.error);
    }
  };

  const renderPendingCard = (order: Job) => {
    const badgeLabel = order.serviceLocation === 'road-call' ? 'Roadcall' : order.isAppointment ? 'Appointment' : 'Walk-in';
    const badgeBackground = order.serviceLocation === 'road-call' ? 'rgba(59,130,246,0.18)' : order.isAppointment ? 'rgba(229,51,42,0.18)' : 'rgba(245,158,11,0.18)';
    const badgeColor = order.serviceLocation === 'road-call' ? '#93c5fd' : order.isAppointment ? '#ff6b64' : '#fbbf24';

    return (
      <div
        key={order.id}
        draggable
        onDragStart={(event) => handleDragStart(event, order.id)}
        onDragEnd={handleDragEnd}
        onClick={() => router.push(`/workorders/${order.id}` as Route)}
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${badgeBackground}`,
          borderRadius: 10,
          padding: '12px 14px',
          cursor: 'pointer',
          opacity: draggedOrderId === order.id ? 0.5 : 1,
          userSelect: 'none',
          transition: 'background 0.12s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ padding: '2px 8px', background: badgeBackground, color: badgeColor, borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
            {badgeLabel}
          </span>
          <span style={{ fontSize: 10, color: '#64748b' }}>{order.time}</span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#e5e7eb', marginBottom: 4 }}>
          {order.service}
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8' }}>{order.customer}</div>
      </div>
    );
  };

  if (isNative || isMobile) {
    return <MobileShell role="tech" userName={user?.name} />;
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

  return (
    <MobileLayout
      role="tech"
      showSidebar={true}
      sidebarContent={<Sidebar role="tech" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
      topNavContent={
        <>
          <TopNavBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} showMenuButton={true} />
          <Breadcrumbs />
        </>
      }
    >
      <div style={{maxWidth:1400, margin:'0 auto', padding: '0 32px 32px 32px'}}>
        {/* Tall Insight Card - Ops Overview */}
        <div style={{background:'rgba(0,0,0,0.35)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:12, padding:24, marginBottom:32, minHeight:800}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, gap:12, flexWrap:'wrap'}}>
            <div>
              <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb'}}>Ops Overview</h2>
              <div style={{display:'flex', gap:8, marginTop:6, flexWrap:'wrap'}}>
                <span style={{padding:'4px 10px', background:'rgba(59,130,246,0.16)', color:'#93c5fd', borderRadius:12, fontSize:11, fontWeight:700}}>
                  Roadcalls: {stats.roadcalls}
                </span>
                <span style={{padding:'4px 10px', background:'rgba(229,51,42,0.16)', color:'#ff6b64', borderRadius:12, fontSize:11, fontWeight:700}}>
                  In-Shop Appointments: {stats.appointments}
                </span>
                <span style={{padding:'4px 10px', background:'rgba(245,158,11,0.16)', color:'#fbbf24', borderRadius:12, fontSize:11, fontWeight:700}}>
                  In-Shop Walk-ins: {stats.walkins}
                </span>
                <span style={{padding:'4px 10px', background:'rgba(229,51,42,0.16)', color:'#ff6b64', borderRadius:12, fontSize:11, fontWeight:700}}>
                  Bays: {stats.baysConfigured} configured ({stats.baysActive} active)
                </span>
              </div>
            </div>
          </div>

          <div style={{display:'grid', gridTemplateColumns:'1fr', gap:16, alignItems:'start'}}>
            {/* Pending Queue */}
            <div
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
                <span style={{fontSize:12, color:'#9aa3b2'}}>{pendingWorkOrders.length} job{pendingWorkOrders.length !== 1 ? 's' : ''}</span>
              </div>
              <div style={{display:'flex', flexDirection:'column', gap:8, maxHeight:520, overflowY:'auto', paddingRight:2}}>
                {pendingWorkOrders.length === 0 && (
                  <div style={{color:'#9aa3b2', fontSize:13, padding:12, border:'1px dashed rgba(255,255,255,0.15)', borderRadius:10}}>
                    No jobs waiting  -  nice work.
                  </div>
                )}
                {pendingWorkOrders.map(order => renderPendingCard(order))}
              </div>
            </div>

            {/* Bays Board */}
            <div style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:14}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
                <div style={{fontSize:15, fontWeight:700, color:'#e5e7eb'}}>Service Bays</div>
                <span style={{fontSize:12, color:'#9aa3b2'}}>Drag to assign</span>
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
                    onDrop={(event) => handleDropToBay(event, bay.id)}
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
                            onClick={() => router.push(`/workorders/${job.id}` as Route)}
                            style={{
                              background:'rgba(255,255,255,0.06)',
                              border:'1px solid rgba(255,255,255,0.08)',
                              borderRadius:8,
                              padding:8,
                              cursor:'pointer',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                          >
                            <div style={{fontSize:12, fontWeight:700, color:'#e5e7eb', marginBottom:4}}>{job.service}</div>
                            <div style={{fontSize:11, color:'#9aa3b2', marginBottom:8}}>{job.customer}</div>
                            <button
                              onClick={() => handleReturnToPending(bay.id, job.id)}
                              style={{width:'100%', padding:'6px 8px', background:'rgba(245,158,11,0.12)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.3)', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer'}}
                            >
                              Return To Queue
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}
