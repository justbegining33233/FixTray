'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import TimeClock from '@/components/TimeClock';
import TechLiveMap from '@/components/TechLiveMap';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import Breadcrumbs from '@/components/Breadcrumbs';
import RealTimeWorkOrders from '@/components/RealTimeWorkOrders';
import MobileLayout from '@/components/MobileLayout';
import MobileShell from '@/components/MobileShell';
import { useRequireAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useIsNative } from '@/context/NativeContext';
import { FaArrowRight, FaBook, FaBox, FaCamera, FaCar, FaChartBar, FaCheckCircle, FaCircle, FaClipboardList, FaCog, FaComments, FaExclamationCircle, FaMapMarkerAlt, FaRegCircle, FaSearch, FaStopwatch, FaSyncAlt, FaTools, FaUser, FaWrench } from 'react-icons/fa';

export default function TechHome() {
  const router = useRouter();
  const { user, isLoading } = useRequireAuth(['tech']);
  const isMobile = useIsMobile();
  const isNative = useIsNative();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [todayJobs, setTodayJobs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('job-creation');
  const [techProfile, setTechProfile] = useState<any>(null);
  const [messageUnreadCount, setMessageUnreadCount] = useState(0);
  const [shopProfile, setShopProfile] = useState<any>(null);
  const [shopCoords, setShopCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [roadCalls, setRoadCalls] = useState<any[]>([]);
  const [partsVendors, setPartsVendors] = useState<{ vendor: string; address?: string; poId?: string }[]>([]);
  const [homeMsg, setHomeMsg] = useState<{type:'success'|'error';text:string}|null>(null);
  const [shopStatsReady, setShopStatsReady] = useState(false);
  const [shopStats, setShopStats] = useState({
    openJobs: 0,
    completedToday: 0,
    partsOrdered: 0,
    revenue: '$0'
  });

  // Fetch shop profile and set coordinates
  const fetchShopProfile = async (shopId: string) => {
    try {
      const token = localStorage.getItem('token');
      // Attempt authenticated fetch first
      let response = await fetch(`/api/shops/${shopId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // If auth failed, try without Authorization header (public fallback)
      if (response.status === 401 || response.status === 403) {
        response = await fetch(`/api/shops/${shopId}`);
      }

      if (response.ok) {
        const data = await response.json();
        // Some routes return { shop } and others might return shop directly
        const shop = data?.shop ?? data;
        setShopProfile(shop);
        // Use lat/lng if present, otherwise geocode address
        if (shop?.latitude && shop?.longitude) {
          setShopCoords({ latitude: shop.latitude, longitude: shop.longitude });
        } else if (shop?.address) {
          geocodeAddress(shop.address, shop.city, shop.state, shop.zipCode);
        }
      } else {
        // Read response body for helpful debugging info
        let bodyText = '';
        try { bodyText = await response.text(); } catch { bodyText = '<no body>'; }
        const _msg = `status:${response.status} body:${bodyText}`;
        setShopProfile(undefined);
      }
    } catch (error) {
      console.error('Error fetching shop profile:', error);
      setShopProfile(undefined);
    }
  };

  // Geocode address to lat/lng using OpenStreetMap Nominatim
  const geocodeAddress = async (address: string, city?: string, state?: string, zip?: string) => {
    try {
      const query = encodeURIComponent([address, city, state, zip].filter(Boolean).join(', '));
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.length > 0) {
        setShopCoords({ latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) });
      }
    } catch (error) {
      console.error('Geocoding failed:', error);
    }
  };

  const fetchTechProfile = async (techId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/techs/${techId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const { tech } = await response.json();
        setTechProfile(tech);
      }
    } catch (error) {
      console.error('Error fetching tech profile:', error);
    }
  };

  const fetchTodayJobs = async (techId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/workorders?assignedTo=${techId}&status=in-progress,assigned`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const { workOrders } = await response.json();
        setTodayJobs(workOrders || []);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  const fetchMessageUnreadCount = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const response = await fetch('/api/messages', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setMessageUnreadCount(data?.totalUnread || 0);
      }
    } catch (error) {
      console.error('Error fetching unread messages:', error);
    }
  };

  const fetchShopStats = async (shopId: string) => {
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      const [workOrdersResponse, purchaseOrdersResponse] = await Promise.all([
        fetch(`/api/workorders?shopId=${shopId}&limit=100`, { headers }),
        fetch(`/api/purchase-orders?shopId=${shopId}`, { headers }),
      ]);

      if (!workOrdersResponse.ok) return;

      const workOrderData = await workOrdersResponse.json();
      const orders: any[] = workOrderData.workOrders || [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const openJobs = orders.filter((w: any) => ['assigned', 'in-progress'].includes(w.status)).length;
      const completedToday = orders.filter((w: any) => w.status === 'closed' && new Date(w.updatedAt) >= today).length;
      const todayRevenue = orders
        .filter((w: any) => w.status === 'closed' && w.paymentStatus === 'paid' && new Date(w.updatedAt) >= today)
        .reduce((sum: number, w: any) => sum + (w.amountPaid || 0), 0);

      let partsOrdered = 0;
      if (purchaseOrdersResponse.ok) {
        const purchaseOrderData = await purchaseOrdersResponse.json();
        partsOrdered = Array.isArray(purchaseOrderData.orders) ? purchaseOrderData.orders.length : 0;
      }

      setShopStats({
        openJobs,
        completedToday,
        partsOrdered,
        revenue: `$${todayRevenue.toLocaleString('en-US', { minimumFractionDigits: 0 })}`,
      });
      setShopStatsReady(true);
    } catch {
      // Keep the last known live values.
    }
  };

  // Initialize data when user is available
  useEffect(() => {
    if (!user) return;
    // Fetch shop profile if shopId exists
    if (user.shopId) {
      fetchShopProfile(user.shopId);
      setShopStatsReady(false);
      fetchShopStats(user.shopId);
    }
    // Fetch tech profile
    fetchTechProfile(user.id);
    // Fetch assigned work orders
    fetchTodayJobs(user.id);
    // Fetch unread message count
    fetchMessageUnreadCount();
    // Set up auto-refresh every 10 seconds
    const refreshInterval = setInterval(() => {
      fetchTechProfile(user.id);
      fetchTodayJobs(user.id);
      fetchMessageUnreadCount();
      if (user.shopId) fetchShopStats(user.shopId);
    }, 10000);
    return () => clearInterval(refreshInterval);
  }, [user]);


  //  Mobile / native: show the tile-grid shell immediately 
  // Must come before isLoading so mobile users never see the desktop flash.
  if (isNative || isMobile) {
    return <MobileShell role="tech" isHome userName={user?.name} />;
  }

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

  const _handleSignOut = () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    localStorage.removeItem('userId');
    localStorage.removeItem('shopId');
    localStorage.removeItem('token');
    router.push('/auth/login' as Route);
  };

  const jobCreationTools = [
    { title: 'New Roadside Job', description: 'Create emergency roadside assistance work orders', icon: <FaCar style={{marginRight:4}} />, link: '/tech/new-roadside-job' },
    { title: 'New In-Shop Job', description: 'Schedule in-shop service appointments', icon: <FaWrench style={{marginRight:4}} />, link: '/tech/new-inshop-job' },
  ];

  const jobManagementTools = [
    { title: 'Active Jobs', description: 'View all your currently assigned work orders', icon: <FaClipboardList style={{marginRight:4}} />, link: '/tech/home' },
    { title: 'Job History', description: 'Browse completed work orders and feedback', icon: <FaChartBar style={{marginRight:4}} />, link: '/tech/home' },
  ];

  const fieldTools = [
    { title: 'Share Location', description: 'Share your real-time GPS location', icon: <FaMapMarkerAlt style={{marginRight:4}} />, link: '/tech/share-location' },
    { title: 'Messages', description: 'View and respond to messages', icon: <FaComments style={{marginRight:4}} />, link: '/tech/messages', badge: messageUnreadCount },
  ];

  const resourceTools = [
    { title: 'Parts Inventory', description: 'Check parts availability and track inventory', icon: <FaCog style={{marginRight:4}} />, link: '/tech/inventory' },
    { title: 'Service Manuals', description: 'Access technical documentation and guides', icon: <FaBook style={{marginRight:4}} />, link: '/tech/manuals' },
  ];

  const technicalTools = [
    { title: 'Diagnostic Tools', description: 'Run vehicle diagnostics and read error codes', icon: <FaSearch style={{marginRight:4}} />, link: '/tech/diagnostics' },
    { title: 'Photo Upload', description: 'Upload photos and documentation', icon: <FaCamera style={{marginRight:4}} />, link: '/tech/photos' },
    { title: 'Time Tracking', description: 'Clock in/out and track billable hours', icon: <FaStopwatch style={{marginRight:4}} />, link: '/tech/timesheet' },
    { title: 'Customer Portal', description: 'Access customer vehicle history', icon: <FaUser style={{marginRight:4}} />, link: '/tech/customers' },
  ];

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
        {/* Shop Stats */}
        <div style={{display:'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: isMobile ? 10 : 16, marginBottom:24}}>
          <div style={{background:'rgba(229,51,42,0.1)', border:'1px solid rgba(229,51,42,0.3)', borderRadius:12, padding:20}}>
            <div style={{fontSize:13, color:'#9aa3b2', marginBottom:8}}>My Open Jobs</div>
            <div style={{fontSize:32, fontWeight:700, color:'#e5332a'}}>{todayJobs.length}</div>
          </div>
          <div style={{background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:12, padding:20}}>
            <div style={{fontSize:13, color:'#9aa3b2', marginBottom:8}}>Completed Today</div>
            <div style={{fontSize:32, fontWeight:700, color:'#22c55e'}}>{shopStatsReady ? shopStats.completedToday : '...'} </div>
          </div>
          <div style={{background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:12, padding:20}}>
            <div style={{fontSize:13, color:'#9aa3b2', marginBottom:8}}>Parts Ordered</div>
            <div style={{fontSize:32, fontWeight:700, color:'#f59e0b'}}>{shopStatsReady ? shopStats.partsOrdered : '...'} </div>
          </div>
          <div style={{background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:12, padding:20}}>
            <div style={{fontSize:13, color:'#9aa3b2', marginBottom:8}}>Today's Revenue</div>
            <div style={{fontSize:32, fontWeight:700, color:'#22c55e'}}>{shopStatsReady ? shopStats.revenue : 'Syncing...'} </div>
          </div>
        </div>

        <div style={{display:'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: isMobile ? 16 : 24}}>
          {/* Left Column - Today's Tasks */}
          <div>
            <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
                <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb'}}><FaWrench style={{marginRight:4}} /> My Tasks Today</h2>
                <Link href="/tech/home" style={{fontSize:13, color:'#e5332a', textDecoration:'none'}}>View All <FaArrowRight style={{marginRight:4}} /></Link>
              </div>
              
              {todayJobs.length === 0 ? (
                <div style={{textAlign:'center', padding:48, color:'#9aa3b2'}}>
                  <div style={{fontSize:48, marginBottom:16}}><FaCheckCircle style={{marginRight:4}} /></div>
                  <div style={{fontSize:18, fontWeight:600, marginBottom:8}}>All caught up!</div>
                  <div style={{fontSize:14}}>No work orders assigned yet</div>
                </div>
              ) : (
                <div style={{display:'flex', flexDirection:'column', gap:12}}>
                  {todayJobs.map(job => (
                    <div key={job.id} style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:16}}>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12}}>
                        <div style={{flex:1}}>
                          <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:4}}>
                            <span style={{fontSize:15, fontWeight:700, color:'#e5e7eb'}}>{job.vehicleType || 'Vehicle Service'}</span>
                            <span style={{
                              padding:'2px 8px',
                              borderRadius:8,
                              fontSize:11,
                              fontWeight:700,
                              background: job.status === 'in-progress' ? 'rgba(34,197,94,0.2)' : 'rgba(229,51,42,0.2)',
                              color: job.status === 'in-progress' ? '#22c55e' : '#ff6b64',
                            }}>
                              {job.status.toUpperCase()}
                            </span>
                          </div>
                          <div style={{fontSize:13, color:'#9aa3b2', marginBottom:4}}>
                            {job.issueDescription?.substring(0, 80)}...
                          </div>
                          <div style={{fontSize:12, color:'#6b7280'}}>
                            WO-{job.id.substring(0, 8)} - {new Date(job.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <Link
                          href={`/workorders/${job.id}` as Route}
                          style={{
                            padding:'6px 12px',
                            background:'#e5332a',
                            color:'white',
                            borderRadius:6,
                            textDecoration:'none',
                            fontSize:12,
                            fontWeight:600,
                          }}
                        >
                          View
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live Shop Location Map */}
            <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, marginTop:32, marginBottom:32, overflow:'hidden', minHeight: isMobile ? 300 : 520, display:'flex', flexDirection:'column'}}>
              <h3 style={{color:'#e5e7eb', margin:'16px 0 0 16px', fontSize:16, fontWeight:700}}><FaMapMarkerAlt style={{marginRight:4}} /> Shop Location</h3>
              <div style={{flex:1, minHeight: isMobile ? 200 : 260, display:'flex', flexDirection:'column'}}>
                {shopCoords ? (
                  <div style={{display:'flex', flexDirection: isMobile ? 'column' : 'row', flex:1}}>
                    {/* Map area: 7/8 */}
                    <div style={{flex: isMobile ? 'none' : 7, padding: isMobile ? 8 : 16, display:'flex', flexDirection:'column', minHeight: isMobile ? 200 : 'auto'}}>
                      <div style={{flex:1, borderRadius:8, overflow:'hidden', display:'flex'}}>
                        <div style={{flex:1}}>
                          <TechLiveMap workOrderId="shop-location" initialLocation={shopCoords} techName={shopProfile?.shopName || 'Shop'} />
                        </div>
                      </div>
                    </div>

                    {/* Right-side menu: 1/8 - Road Call / Parts / User Location */}
                    <div style={{flex: isMobile ? 'none' : 1, borderLeft: isMobile ? 'none' : '1px solid rgba(255,255,255,0.05)', borderTop: isMobile ? '1px solid rgba(255,255,255,0.05)' : 'none', display:'flex', flexDirection:'column', padding:'12px', gap:12}}>
                      {/* Section 1: Road Call */}
                      <div style={{borderRadius:8, padding:12, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.03)'}}>
                        <div style={{fontSize:15, fontWeight:800, color:'#e5e7eb'}}><FaExclamationCircle style={{marginRight:4}} /> Road Call</div>
                        <div style={{height:2, background:'rgba(255,255,255,0.06)', margin:'8px 0'}} />

                        {/* compact WO list */}
                        <div style={{minHeight:48, marginBottom:8}}>
                          {roadCalls.length === 0 ? (
                            <div style={{fontSize:12, color:'#9aa3b2'}}>No active road calls</div>
                          ) : (
                            <div style={{display:'flex', flexDirection:'column', gap:6}}>
                              {roadCalls.map((wo: any) => (
                                <div key={wo.id} style={{fontSize:13, fontWeight:700, color:'#e5e7eb'}}>{`WO-${wo.id.substring(0,8)}`}</div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div style={{display:'flex', justifyContent:'space-between', gap:8}}>
                          <button id="toggle-roadcalls" onClick={async (ev) => {
                            const btn = ev.currentTarget as HTMLButtonElement;
                            const showing = btn.dataset.showing === '1';
                            if (showing) {
                              window.dispatchEvent(new CustomEvent('map:clear_markers', { detail: { type: 'roadcall' } }));
                              setRoadCalls([]);
                              btn.dataset.showing = '0';
                              btn.textContent = 'Show';
                              return;
                            }
                            try {
                              const token = localStorage.getItem('token');
                              const shopId = user?.shopId;
                              if (!shopId) { setHomeMsg({type:'error',text:'No shopId'}); return; }
                              const res = await fetch(`/api/workorders?shopId=${shopId}&status=assigned,in-progress`, { headers: { Authorization: `Bearer ${token}` } });
                              if (!res.ok) { setHomeMsg({type:'error',text:'Failed to fetch road calls'}); return; }
                              const data = await res.json();
                              const wos = data.workOrders || [];
                              setRoadCalls(wos);
                              const markers: any[] = wos.map((wo: any) => wo.location).filter((l: any) => l && l.latitude !== undefined && l.longitude !== undefined).map((l: any) => ({ latitude: l.latitude, longitude: l.longitude, title: 'Road Call' }));
                              window.dispatchEvent(new CustomEvent('map:add_markers', { detail: { type: 'roadcall', markers } }));
                              btn.dataset.showing = '1';
                              btn.textContent = 'Hide';
                            } catch (err) { console.error(err); setHomeMsg({type:'error',text:'Error loading road calls'}); }
                          }} style={{padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', color:'#e5e7eb', cursor:'pointer'}}>Show</button>

                          <Link href="/tech/new-roadside-job" style={{display:'inline-block', padding:'8px 10px', background:'#e5332a', color:'white', borderRadius:6, textDecoration:'none', fontWeight:700, fontSize:13}}>Create Road Call</Link>
                        </div>
                      </div>

                      {/* Section 2: Parts */}
                      <div style={{borderRadius:8, padding:12, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.03)'}}>
                        <div style={{fontSize:15, fontWeight:800, color:'#e5e7eb'}}><FaCog style={{marginRight:4}} /> Parts</div>
                        <div style={{height:2, background:'rgba(255,255,255,0.06)', margin:'8px 0 12px'}} />

                        {/* Show vendor addresses from recent POs when available */}
                        <div style={{minHeight:48, marginBottom:8}}>
                          {partsVendors.length === 0 ? (
                            <div style={{fontSize:12, color:'#9aa3b2'}}>No recent POs  -  shop pickup shown on map</div>
                          ) : (
                            <div style={{display:'flex', flexDirection:'column', gap:6}}>
                              {partsVendors.map(p => (
                                <div key={p.poId || p.vendor} style={{fontSize:13, fontWeight:700, color:'#e5e7eb'}}>{`${p.vendor}${p.address ? ` - ${p.address}` : ''}`}</div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div style={{display:'flex', gap:8, alignItems:'center'}}>
                          <button id="toggle-parts" onClick={async (ev) => {
                            const btn = ev.currentTarget as HTMLButtonElement;
                            const showing = btn.dataset.showing === '1';
                            if (showing) {
                              window.dispatchEvent(new CustomEvent('map:clear_markers', { detail: { type: 'parts' } }));
                              setPartsVendors([]);
                              btn.dataset.showing = '0'; btn.textContent = 'Show';
                              return;
                            }

                            try {
                              if (!user?.shopId) { setHomeMsg({type:'error',text:'No shopId'}); return; }
                              const token = localStorage.getItem('token');
                              const poRes = await fetch(`/api/purchase-orders?shopId=${user.shopId}`, { headers: { Authorization: `Bearer ${token}` } });

                              if (!poRes.ok) {
                                window.dispatchEvent(new CustomEvent('map:add_markers', { detail: { type: 'parts', markers: [{ latitude: shopCoords?.latitude, longitude: shopCoords?.longitude, title: 'Parts - Shop' }] } }));
                                setPartsVendors([{ vendor: shopProfile?.shopName || 'Shop', address: shopProfile?.address }]);
                                btn.dataset.showing = '1'; btn.textContent = 'Hide';
                                return;
                              }

                              const { orders } = await poRes.json();
                              const vendors = (orders || []).filter((o: any) => o.vendor).map((o: any) => ({ id: o.id, vendor: o.vendor, vendorAddress: o.vendorAddress || null }));

                              const vendorAddressMap: Record<string, string> = {
                                'NAPA Auto Parts': '2001 W 3rd St, Anytown, PA',
                                'AutoZone Commercial': '123 Commerce Dr, Anytown, PA',
                                "O'Reilly Auto Parts": '500 Service Blvd, Anytown, PA',
                                'WORLDPAC': '800 Distribution Way, Anytown, PA',
                                'CARQUEST': '400 Parts Ave, Anytown, PA'
                              };

                              const markers: any[] = [];
                              const vendorList: any[] = [];

                              for (const v of vendors) {
                                const vendorName = v.vendor;
                                let resolvedAddr = v.vendorAddress || vendorAddressMap[vendorName] || null;
                                let lat: number | null = null;
                                let lon: number | null = null;

                                if (resolvedAddr) {
                                  try {
                                    const q = encodeURIComponent(resolvedAddr);
                                    const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}`);
                                    const geoData = await geoRes.json();
                                    if (geoData && geoData.length > 0) {
                                      lat = parseFloat(geoData[0].lat);
                                      lon = parseFloat(geoData[0].lon);
                                    }
                                  } catch (err) { console.warn('Vendor geocode failed', err); }
                                }

                                if ((lat === null || lon === null) && !resolvedAddr) {
                                  try {
                                    const q = encodeURIComponent(vendorName + ' parts store');
                                    const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}`);
                                    const geoData = await geoRes.json();
                                    if (geoData && geoData.length > 0) {
                                      lat = parseFloat(geoData[0].lat);
                                      lon = parseFloat(geoData[0].lon);
                                      resolvedAddr = geoData[0].display_name || vendorName;
                                    }
                                  } catch (err) { console.warn('Vendor-name geocode failed', err); }
                                }

                                if (lat !== null && lon !== null) {
                                  markers.push({ latitude: lat, longitude: lon, title: `Parts - ${vendorName}`, popup: `${vendorName} (PO:${v.id})` });
                                  vendorList.push({ vendor: vendorName, address: resolvedAddr || undefined, poId: v.id });
                                } else if (shopCoords) {
                                  markers.push({ latitude: shopCoords.latitude, longitude: shopCoords.longitude, title: `Parts - ${vendorName} (shop fallback)`, popup: `${vendorName} (PO:${v.id})` });
                                  vendorList.push({ vendor: vendorName, address: shopProfile?.address || undefined, poId: v.id });
                                }
                              }

                              if (markers.length === 0) {
                                markers.push({ latitude: shopCoords?.latitude, longitude: shopCoords?.longitude, title: 'Parts - Shop' });
                                vendorList.push({ vendor: shopProfile?.shopName || 'Shop', address: shopProfile?.address || undefined });
                              }

                              setPartsVendors(vendorList);
                              window.dispatchEvent(new CustomEvent('map:add_markers', { detail: { type: 'parts', markers } }));
                              btn.dataset.showing = '1'; btn.textContent = 'Hide';
                            } catch (err) {
                              console.error('Error loading parts vendors', err);
                              setHomeMsg({type:'error',text:'Failed to load parts pickup locations'});
                            }
                          }} style={{padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', color:'#e5e7eb', cursor:'pointer'}}>Show</button>

                          <Link href="/tech/inventory" style={{display:'inline-block', padding:'8px 10px', background:'#10b981', color:'white', borderRadius:6, textDecoration:'none', fontWeight:700, fontSize:13}}>Open Inventory</Link>
                        </div>
                      </div>

                      {/* Section 3: User Location (share if permitted) */}
                      <div style={{borderRadius:8, padding:8, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.03)'}}>
                        <div style={{fontSize:13, fontWeight:700, color:'#e5e7eb', marginBottom:6}}><FaMapMarkerAlt style={{marginRight:4}} /> Your Location</div>
                        <div style={{fontSize:12, color:'#9aa3b2', marginBottom:8}}>Share your live location on the map (optional)</div>
                        <div style={{display:'flex', gap:8}}>
                          <button id="share-location-btn" onClick={async () => {
                            try {
                              if (!('geolocation' in navigator)) { setHomeMsg({type:'error',text:'Geolocation not supported'}); return; }
                              // request one-time position then start watch
                              const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
                              const lat = pos.coords.latitude; const lng = pos.coords.longitude;
                              // dispatch event so TechLiveMap will show the user's marker
                              window.dispatchEvent(new CustomEvent('tech-location-updated', { detail: { location: { latitude: lat, longitude: lng }, workOrderId: 'shop-location' } }));
                              const el = document.getElementById('user-loc-display'); if (el) el.textContent = `You: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
                              // start watch to update continuously
                              const watchId = navigator.geolocation.watchPosition((p) => {
                                window.dispatchEvent(new CustomEvent('tech-location-updated', { detail: { location: { latitude: p.coords.latitude, longitude: p.coords.longitude }, workOrderId: 'shop-location' } }));
                                const el = document.getElementById('user-loc-display');
                                if (el) el.textContent = `You: ${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}`;
                              });
                              (window as any).__shop_location_watch = watchId;
                              (document.getElementById('share-location-btn') as HTMLButtonElement).style.display = 'none';
                              const stopBtn = document.getElementById('stop-share-btn') as HTMLButtonElement | null;
                              if (stopBtn) stopBtn.style.display = 'inline-block';
                            } catch (err) { console.error('Location error', err); setHomeMsg({type:'error',text:'Failed to get location'}); }
                          }} style={{flex:1, padding:8, borderRadius:6, background:'#e5332a', color:'white', border:'none', fontWeight:700}}>Share</button>
                          <button id="stop-share-btn" onClick={() => {
                            const id = (window as any).__shop_location_watch;
                            if (id !== undefined) { navigator.geolocation.clearWatch(id); (window as any).__shop_location_watch = undefined; }
                            // dispatch clear event to remove user marker
                            window.dispatchEvent(new CustomEvent('tech-location-updated', { detail: { workOrderId: 'shop-location', clear: true } }));
                            (document.getElementById('stop-share-btn') as HTMLButtonElement).style.display = 'none';
                            (document.getElementById('share-location-btn') as HTMLButtonElement).style.display = 'inline-block';
                          }} style={{display:'none', padding:8, borderRadius:6, background:'#ef4444', color:'white', border:'none', fontWeight:700}}>Stop</button>
                        </div>
                        <div id="user-loc-display" style={{marginTop:8, fontSize:12, color:'#9aa3b2'}}></div>
                      </div>

                      <div style={{flex:1}} />
                      <div style={{fontSize:10, color:'#9aa3b2', textAlign:'center'}}>Leaflet |  OpenStreetMap contributors</div>
                    </div>
                  </div>
                ) : (
                  <div style={{color:'#9aa3b2', textAlign:'center', marginTop:40}}>Loading map...</div>
                )}
              </div>
            </div>
            {/* Tab Navigation for Tools */}
            <div style={{marginTop:32}}>
              <div style={{display:'flex', gap:8, borderBottom:'2px solid rgba(255,255,255,0.1)', paddingBottom:2, overflowX:'auto', marginBottom:24}}>
                <button
                  onClick={() => setActiveTab('job-creation')}
                  style={{
                    padding:'12px 20px',
                    background: activeTab === 'job-creation' ? 'rgba(229,51,42,0.2)' : 'transparent',
                    border:'none',
                    borderBottom: activeTab === 'job-creation' ? '3px solid #e5332a' : '3px solid transparent',
                    color: activeTab === 'job-creation' ? '#e5332a' : '#9aa3b2',
                    cursor:'pointer',
                    fontSize:14,
                    fontWeight:700,
                    transition:'all 0.2s',
                    borderRadius:'8px 8px 0 0',
                    whiteSpace:'nowrap'
                  }}
                >
                  <FaCar style={{marginRight:4}} /> Job Creation
                </button>
                <button
                  onClick={() => setActiveTab('job-management')}
                  style={{
                    padding:'12px 20px',
                    background: activeTab === 'job-management' ? 'rgba(229,51,42,0.2)' : 'transparent',
                    border:'none',
                    borderBottom: activeTab === 'job-management' ? '3px solid #e5332a' : '3px solid transparent',
                    color: activeTab === 'job-management' ? '#e5332a' : '#9aa3b2',
                    cursor:'pointer',
                    fontSize:14,
                    fontWeight:700,
                    transition:'all 0.2s',
                    borderRadius:'8px 8px 0 0',
                    whiteSpace:'nowrap'
                  }}
                >
                  <FaClipboardList style={{marginRight:4}} /> Job Management
                </button>
                <button
                  onClick={() => setActiveTab('field-tools')}
                  style={{
                    padding:'12px 20px',
                    background: activeTab === 'field-tools' ? 'rgba(229,51,42,0.2)' : 'transparent',
                    border:'none',
                    borderBottom: activeTab === 'field-tools' ? '3px solid #e5332a' : '3px solid transparent',
                    color: activeTab === 'field-tools' ? '#e5332a' : '#9aa3b2',
                    cursor:'pointer',
                    fontSize:14,
                    fontWeight:700,
                    transition:'all 0.2s',
                    borderRadius:'8px 8px 0 0',
                    whiteSpace:'nowrap',
                    display:'flex',
                    alignItems:'center',
                    gap:8
                  }}
                >
                   Field Tools
                  {messageUnreadCount > 0 && (
                    <span style={{
                      background:'#ef4444',
                      color:'white',
                      borderRadius:999,
                      padding:'2px 8px',
                      fontSize:11,
                      fontWeight:700,
                      lineHeight:1
                    }}>
                      {messageUnreadCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('resources')}
                  style={{
                    padding:'12px 20px',
                    background: activeTab === 'resources' ? 'rgba(229,51,42,0.2)' : 'transparent',
                    border:'none',
                    borderBottom: activeTab === 'resources' ? '3px solid #e5332a' : '3px solid transparent',
                    color: activeTab === 'resources' ? '#e5332a' : '#9aa3b2',
                    cursor:'pointer',
                    fontSize:14,
                    fontWeight:700,
                    transition:'all 0.2s',
                    borderRadius:'8px 8px 0 0',
                    whiteSpace:'nowrap'
                  }}
                >
                  <FaBox style={{marginRight:4}} /> Resources
                </button>
                <button
                  onClick={() => setActiveTab('technical')}
                  style={{
                    padding:'12px 20px',
                    background: activeTab === 'technical' ? 'rgba(229,51,42,0.2)' : 'transparent',
                    border:'none',
                    borderBottom: activeTab === 'technical' ? '3px solid #e5332a' : '3px solid transparent',
                    color: activeTab === 'technical' ? '#e5332a' : '#9aa3b2',
                    cursor:'pointer',
                    fontSize:14,
                    fontWeight:700,
                    transition:'all 0.2s',
                    borderRadius:'8px 8px 0 0',
                    whiteSpace:'nowrap'
                  }}
                >
                  <FaWrench style={{marginRight:4}} /> Technical Tools
                </button>
              </div>

              {/* Tool Cards - Job Creation */}
              {activeTab === 'job-creation' && (
                <div style={{display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: isMobile ? 12 : 20}}>
                  {jobCreationTools.map(tool => (
                    <Link key={tool.title} href={tool.link as Route} style={{textDecoration:'none'}}>
                      <div style={{
                        background:'#000000',
                        border:'1px solid rgba(255,255,255,0.15)',
                        borderRadius:16,
                        padding:24,
                        cursor:'pointer',
                        transition:'all 0.3s',
                        minHeight:180
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-8px)';
                        e.currentTarget.style.borderColor = 'rgba(229,51,42,0.4)';
                        e.currentTarget.style.boxShadow = '0 12px 24px rgba(229,51,42,0.25)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}>
                        <div style={{fontSize:48, marginBottom:12}}>{tool.icon}</div>
                        <div style={{fontSize:18, fontWeight:700, color:'#e5e7eb', marginBottom:8}}>{tool.title}</div>
                        <div style={{fontSize:13, color:'#9aa3b2'}}>{tool.description}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Tool Cards - Job Management */}
              {activeTab === 'job-management' && (
                <div style={{display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: isMobile ? 12 : 20}}>
                  {jobManagementTools.map(tool => (
                    <Link key={tool.title} href={tool.link as Route} style={{textDecoration:'none'}}>
                      <div style={{
                        background:'#000000',
                        border:'1px solid rgba(255,255,255,0.15)',
                        borderRadius:16,
                        padding:24,
                        cursor:'pointer',
                        transition:'all 0.3s',
                        minHeight:180
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-8px)';
                        e.currentTarget.style.borderColor = 'rgba(229,51,42,0.4)';
                        e.currentTarget.style.boxShadow = '0 12px 24px rgba(229,51,42,0.25)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}>
                        <div style={{fontSize:48, marginBottom:12}}>{tool.icon}</div>
                        <div style={{fontSize:18, fontWeight:700, color:'#e5e7eb', marginBottom:8}}>{tool.title}</div>
                        <div style={{fontSize:13, color:'#9aa3b2'}}>{tool.description}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Tool Cards - Field Tools */}
              {activeTab === 'field-tools' && (
                <div style={{display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: isMobile ? 12 : 20}}>
                  {fieldTools.map(tool => (
                    <Link key={tool.title} href={tool.link as Route} style={{textDecoration:'none'}}>
                      <div style={{
                        background:'#000000',
                        border:'1px solid rgba(255,255,255,0.15)',
                        borderRadius:16,
                        padding:24,
                        cursor:'pointer',
                        transition:'all 0.3s',
                        minHeight:180
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-8px)';
                        e.currentTarget.style.borderColor = 'rgba(229,51,42,0.4)';
                        e.currentTarget.style.boxShadow = '0 12px 24px rgba(229,51,42,0.25)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}>
                        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12}}>
                          <div style={{fontSize:48}}>{tool.icon}</div>
                          {'badge' in tool && (tool as any).badge > 0 ? (
                            <div style={{background:'#ef4444', color:'white', borderRadius:999, padding:'4px 10px', fontSize:12, fontWeight:700}}>
                              {(tool as any).badge}
                            </div>
                          ) : null}
                        </div>
                        <div style={{fontSize:18, fontWeight:700, color:'#e5e7eb', marginBottom:8}}>{tool.title}</div>
                        <div style={{fontSize:13, color:'#9aa3b2'}}>{tool.description}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Tool Cards - Resources */}
              {activeTab === 'resources' && (
                <div style={{display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: isMobile ? 12 : 20}}>
                  {resourceTools.map(tool => (
                    <Link key={tool.title} href={tool.link as Route} style={{textDecoration:'none'}}>
                      <div style={{
                        background:'#000000',
                        border:'1px solid rgba(255,255,255,0.15)',
                        borderRadius:16,
                        padding:24,
                        cursor:'pointer',
                        transition:'all 0.3s',
                        minHeight:180
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-8px)';
                        e.currentTarget.style.borderColor = 'rgba(229,51,42,0.4)';
                        e.currentTarget.style.boxShadow = '0 12px 24px rgba(229,51,42,0.25)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}>
                        <div style={{fontSize:48, marginBottom:12}}>{tool.icon}</div>
                        <div style={{fontSize:18, fontWeight:700, color:'#e5e7eb', marginBottom:8}}>{tool.title}</div>
                        <div style={{fontSize:13, color:'#9aa3b2'}}>{tool.description}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Tool Cards - Technical Tools */}
              {activeTab === 'technical' && (
                <div style={{display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: isMobile ? 12 : 20}}>
                  {technicalTools.map(tool => (
                    <Link key={tool.title} href={tool.link as Route} style={{textDecoration:'none'}}>
                      <div style={{
                        background:'#000000',
                        border:'1px solid rgba(255,255,255,0.15)',
                        borderRadius:16,
                        padding:24,
                        cursor:'pointer',
                        transition:'all 0.3s',
                        minHeight:180
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-8px)';
                        e.currentTarget.style.borderColor = 'rgba(229,51,42,0.4)';
                        e.currentTarget.style.boxShadow = '0 12px 24px rgba(229,51,42,0.25)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}>
                        <div style={{fontSize:48, marginBottom:12}}>{tool.icon}</div>
                        <div style={{fontSize:18, fontWeight:700, color:'#e5e7eb', marginBottom:8}}>{tool.title}</div>
                        <div style={{fontSize:13, color:'#9aa3b2'}}>{tool.description}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div>
            {/* Tech Profile Card */}
            {techProfile && (
              <div style={{background:'rgba(229,51,42,0.1)', border:'1px solid rgba(229,51,42,0.3)', borderRadius:12, padding:20, marginBottom:24}}>
                <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:16}}>
                  <div style={{fontSize:32}}><FaUser style={{marginRight:4}} /></div>
                  <div>
                    <div style={{fontSize:16, fontWeight:700, color:'#e5e7eb'}}>{techProfile.firstName} {techProfile.lastName}</div>
                    <div style={{fontSize:12, color:'#9aa3b2'}}>{techProfile.role === 'tech' ? 'Technician' : 'Manager'}</div>
                  </div>
                </div>
                <div style={{borderTop:'1px solid rgba(255,255,255,0.1)', paddingTop:12}}>
                  <div style={{display:'grid', gap:8}}>
                    <div style={{display:'flex', justifyContent:'space-between'}}>
                      <span style={{fontSize:13, color:'#9aa3b2'}}>Email:</span>
                      <span style={{fontSize:13, color:'#e5e7eb'}}>{techProfile.email}</span>
                    </div>
                    <div style={{display:'flex', justifyContent:'space-between'}}>
                      <span style={{fontSize:13, color:'#9aa3b2'}}>Phone:</span>
                      <span style={{fontSize:13, color:'#e5e7eb'}}>{techProfile.phone || 'N/A'}</span>
                    </div>
                    <div style={{display:'flex', justifyContent:'space-between', background:'rgba(229,51,42,0.2)', padding:'8px 12px', borderRadius:8, marginTop:4}}>
                      <span style={{fontSize:13, fontWeight:600, color:'#ff6b64'}}>Hourly Rate:</span>
                      <span style={{fontSize:16, fontWeight:700, color:'#ff6b64'}}>${(techProfile.hourlyRate ?? 0).toFixed(2)}/hr</span>
                    </div>
                    <div style={{display:'flex', justifyContent:'space-between'}}>
                      <span style={{fontSize:13, color:'#9aa3b2'}}>Status:</span>
                      <span style={{fontSize:13, fontWeight:600, color: techProfile.available ? '#22c55e' : '#ef4444'}}>
                        {techProfile.available ? <><FaCircle style={{marginRight:4}} /> Active</> : <><FaRegCircle style={{marginRight:4}} /> Inactive</>}
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{marginTop:12, fontSize:11, color:'#6b7280', textAlign:'center'}}>
                  <FaSyncAlt style={{marginRight:4}} /> Auto-refreshes every 30 seconds
                </div>
              </div>
            )}

            {/* Time Clock */}
            <TimeClock techId={user.id} shopId={user.shopId || ''} techName={user.name} />

            {/* Quick Tools */}
            <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24, marginTop:24}}>
              <h3 style={{color:'#e5e7eb', marginBottom:16, fontSize:16}}><FaTools style={{marginRight:4}} /> Quick Tools</h3>
              <div style={{display:'grid', gap:8}}>
                <Link href="/tech/diagnostics" style={{padding:12, background:'rgba(229,51,42,0.1)', borderRadius:8, textDecoration:'none', color:'#e5332a', fontSize:14, fontWeight:600}}>
                  <FaSearch style={{marginRight:4}} /> Diagnostics
                </Link>
                <Link href="/tech/inventory" style={{padding:12, background:'rgba(34,197,94,0.1)', borderRadius:8, textDecoration:'none', color:'#22c55e', fontSize:14, fontWeight:600}}>
                  <FaBox style={{marginRight:4}} /> Inventory
                </Link>
                <Link href="/tech/manuals" style={{padding:12, background:'rgba(168,85,247,0.1)', borderRadius:8, textDecoration:'none', color:'#a855f7', fontSize:14, fontWeight:600}}>
                  <FaBook style={{marginRight:4}} /> Manuals
                </Link>
                <Link href="/tech/photos" style={{padding:12, background:'rgba(245,158,11,0.1)', borderRadius:8, textDecoration:'none', color:'#f59e0b', fontSize:14, fontWeight:600}}>
                  <FaCamera style={{marginRight:4}} /> Photos
                </Link>
                <Link href="/tech/all-tools" style={{padding:12, background:'rgba(229,51,42,0.1)', borderRadius:8, textDecoration:'none', color:'#e5332a', fontSize:14, fontWeight:600}}>
                  <FaTools style={{marginRight:4}} /> All Tools
                </Link>
              </div>
            </div>

            {/* View Center Control */}
            <div style={{background:'rgba(229,51,42,0.1)', border:'1px solid rgba(229,51,42,0.3)', borderRadius:12, padding:20, marginTop:24, textAlign:'center'}}>
              <div style={{fontSize:14, color:'#e5332a', fontWeight:600, marginBottom:8}}><FaChartBar style={{marginRight:4}} /> Shop Overview</div>
              <Link
                href="/shop/home"
                style={{
                  display:'block',
                  padding:10,
                  background:'#e5332a',
                  color:'white',
                  borderRadius:6,
                  textDecoration:'none',
                  fontSize:13,
                  fontWeight:600,
                }}
              >
                View Center Control
              </Link>
            </div>

            {/* Real-Time Work Orders Updates */}
            <RealTimeWorkOrders userId={user.id} />
          </div>
        </div>

      {homeMsg && (
        <div style={{position:'fixed',bottom:24,right:24,background:homeMsg.type==='success'?'#dcfce7':'#fde8e8',color:homeMsg.type==='success'?'#166534':'#991b1b',borderRadius:10,padding:'12px 20px',zIndex:9999,fontSize:14,fontWeight:600,boxShadow:'0 4px 12px rgba(0,0,0,0.3)'}}>
          {homeMsg.text}
          <button onClick={()=>setHomeMsg(null)} style={{marginLeft:12,background:'none',border:'none',cursor:'pointer',fontSize:16,color:'inherit'}}></button>
        </div>
      )}
    </MobileLayout>
  );
}

