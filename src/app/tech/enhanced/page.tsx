'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { WorkOrder } from '../../../types/workorder';
import { unwrapWorkOrders } from '@/lib/workOrderList';
import { workOrderTitle } from '@/lib/workOrderMetrics';
import NotificationBell from '../../../components/NotificationBell';
import { useRequireAuth } from '../../../contexts/AuthContext';
import '../../../styles/sos-theme.css';
import { FaArrowLeft, FaCamera, FaMapMarkerAlt, FaStar } from 'react-icons/fa';

function TechPortalEnhancedContent() {
  const { user } = useRequireAuth(['tech']);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('assignments');
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const techName = user ? `${(user as any).firstName || ''} ${(user as any).lastName || ''}`.trim() || (user as any).name || user.id : '';
  const [location, setLocation] = useState({ lat: 0, lng: 0 });

  useEffect(() => {
    const tab = searchParams?.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const fetchWorkOrders = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/workorders', {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setWorkOrders(unwrapWorkOrders(data));
    } catch (error) {
      console.error('Failed to fetch work orders:', error);
    }
  };

  useEffect(() => {
    fetchWorkOrders();
    // Simulate location updates
    const interval = setInterval(() => {
      setLocation({ lat: 40.7128 + Math.random() * 0.01, lng: -74.0060 + Math.random() * 0.01 });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const features = [
    { id: 'assignments', icon: '', name: 'Assignments' },
    { id: 'location', icon: '', name: 'My Location' },
    { id: 'messages', icon: '', name: 'Messages' },
    { id: 'photos', icon: '', name: 'Work Photos' },
    { id: 'documents', icon: '', name: 'Documents' },
    { id: 'schedule', icon: '', name: 'Schedule' },
    { id: 'performance', icon: '', name: 'Performance' },
  ];

  // Work orders are already scoped to this tech's shop via the API;
  // further filter to those assigned to this tech (by id or name)
  const assigned = (Array.isArray(workOrders) ? workOrders : []).filter((w) => {
    const status = String(w.status || '');
    if (['closed', 'completed', 'cancelled', 'canceled'].includes(status)) return false;
    if (!user) return true;
    const raw = w as WorkOrder & { assignedTechId?: string | null; assignedTo?: unknown };
    const assignedTo = raw.assignedTo;
    const assignee = typeof assignedTo === 'string'
      ? assignedTo
      : assignedTo && typeof assignedTo === 'object' && 'id' in assignedTo
        ? String((assignedTo as { id?: string }).id || '')
        : '';
    return !assignee || assignee === user.id || raw.assignedTechId === user.id || assignee === techName;
  });

  return (
    <div className="sos-wrap">
      <div className="sos-card" style={{maxWidth:1400}}>
        <div className="sos-header">
          <div className="sos-brand">
            <span className="mark">FixTray</span>
            <span className="sub">Tech Portal - {techName}</span>
          </div>
          <div style={{display:'flex', gap:12, alignItems:'center'}}>
            <NotificationBell />
            <button
              onClick={() => {
                localStorage.removeItem('userRole');
                localStorage.removeItem('userName');
                router.push('/auth/login');
              }}
              className="btn-outline"
            >
              Sign Out
            </button>
            <Link href="/" className="btn-outline"><FaArrowLeft style={{marginRight:4}} /> Home</Link>
          </div>
        </div>

        <div className="sos-content" style={{gridTemplateColumns:'200px 1fr'}}>
          <div className="sos-pane" style={{padding:'20px 12px', borderRight:'1px solid #5a5a5a'}}>
            <div style={{display:'flex', flexDirection:'column', gap:4}}>
              {features.map(feature => (
                <button
                  key={feature.id}
                  onClick={() => setActiveTab(feature.id)}
                  className="btn-outline"
                  style={{
                    justifyContent:'flex-start',
                    padding:'10px 12px',
                    background: activeTab === feature.id ? 'rgba(229,51,42,0.14)' : 'transparent',
                    border: activeTab === feature.id ? '1px solid rgba(229,51,42,0.28)' : '1px solid #5a5a5a',
                    color: activeTab === feature.id ? '#ffb3ad' : '#f5f7fb',
                  }}
                >
                  <span style={{marginRight:8}}>{feature.icon}</span>
                  <span style={{fontSize:13}}>{feature.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="sos-pane" style={{padding:28}}>
            {activeTab === 'assignments' && <AssignmentsTab workOrders={assigned} onRefresh={fetchWorkOrders} />}
            {activeTab === 'location' && <LocationTab location={location} techName={techName} />}
            {activeTab === 'messages' && <MessagesTab techName={techName} />}
            {activeTab === 'photos' && <PhotosTab />}
            {activeTab === 'documents' && <DocumentsTab />}
            {activeTab === 'schedule' && <ScheduleTab />}
            {activeTab === 'performance' && <PerformanceTab />}
          </div>
        </div>

        <div className="sos-footer">
          <span className="sos-tagline">© {new Date().getFullYear()} FixTray</span>
          <div className="accent-bar" style={{width:112, borderRadius:6}} />
        </div>
      </div>
    </div>
  );
}

function AssignmentsTab({ workOrders, onRefresh }: { workOrders: WorkOrder[], onRefresh: () => void }) {
  const completeJob = async (woId: string) => {
    try {
      const csrf = typeof document !== 'undefined' ? document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('csrf_token='))?.split('=')[1] : null;
      await fetch('/api/tech/complete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf || '' },
        body: JSON.stringify({ workOrderId: woId }),
      });
      onRefresh();
    } catch (error) {
      console.error('Failed to complete job:', error);
    }
  };

  return (
    <div>
      <div className="sos-title">My Assignments</div>
      <p className="sos-desc">Active work orders assigned to you</p>
      
      <div className="sos-list" style={{marginTop:24}}>
        {workOrders.length === 0 ? (
          <div style={{textAlign:'center', padding:40, color:'#9aa3b2'}}>No active assignments</div>
        ) : (
          workOrders.map(wo => (
            <div key={wo.id} className="sos-item" style={{flexDirection:'column', alignItems:'flex-start'}}>
              <div style={{display:'flex', justifyContent:'space-between', width:'100%', marginBottom:8}}>
                <div style={{fontWeight:700}}>WO #{wo.id.slice(0,8)}</div>
                <span className="sos-pill" style={{fontSize:10}}>{wo.status}</span>
              </div>
              <div style={{fontSize:13, color:'#b8beca', marginBottom:8}}>
                {wo.vehicleType} - {wo.services?.repairs?.[0]?.type || wo.services?.maintenance?.[0]?.type || workOrderTitle(wo)}
              </div>
              <div style={{fontSize:12, color:'#9aa3b2', marginBottom:12}}>
                Customer: {wo.createdBy || 'Unknown'}
              </div>
              <div style={{display:'flex', gap:8, width:'100%'}}>
                <button className="btn-primary" onClick={() => completeJob(wo.id)} style={{flex:1}}>
                  Mark Complete
                </button>
                <Link href={`/workorders/${wo.id}`} className="btn-outline" style={{flex:1, textAlign:'center'}}>
                  View Details
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function LocationTab({ location, techName }: { location: { lat: number, lng: number }, techName: string }) {
  return (
    <div>
      <div className="sos-title">Location Sharing</div>
      <p className="sos-desc">Your location is shared with customers for ETA tracking</p>
      
      <div className="sos-item" style={{marginTop:24, padding:24, flexDirection:'column', alignItems:'center'}}>
        <div style={{fontSize:48, marginBottom:16}}><FaMapMarkerAlt style={{marginRight:4}} /></div>
        <div style={{fontSize:16, fontWeight:700, marginBottom:8}}>{techName}</div>
        <div style={{fontSize:13, color:'#b8beca', marginBottom:16}}>Location Sharing: Active</div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, width:'100%'}}>
          <div className="sos-item" style={{flexDirection:'column'}}>
            <div style={{fontSize:11, color:'#9aa3b2'}}>Latitude</div>
            <div style={{fontSize:14, fontWeight:600}}>{location.lat.toFixed(4)}</div>
          </div>
          <div className="sos-item" style={{flexDirection:'column'}}>
            <div style={{fontSize:11, color:'#9aa3b2'}}>Longitude</div>
            <div style={{fontSize:14, fontWeight:600}}>{location.lng.toFixed(4)}</div>
          </div>
        </div>
        <button className="btn-outline" style={{marginTop:16, width:'100%'}}>Pause Location Sharing</button>
      </div>
    </div>
  );
}

function MessagesTab({ techName }: { techName: string }) {
  const [messages, setMessages] = useState<{sender:string;message:string;time:string;type:string}[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: newMessage.trim(), recipientType: 'shop' }),
      });
      if (res.ok) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setMessages(prev => [...prev, { sender: techName || 'You', message: newMessage.trim(), time: timeStr, type: 'sent' }]);
        setNewMessage('');
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSend();
  };

  return (
    <div>
      <div className="sos-title">Messages</div>
      <p className="sos-desc">Chat with customers and managers</p>
      
      <div className="sos-list" style={{marginTop:24}}>
        {messages.length === 0 && (
          <div style={{textAlign:'center', padding:40, color:'#9aa3b2'}}>No messages yet</div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className="sos-item" style={{
            flexDirection:'column',
            alignItems: msg.type === 'sent' ? 'flex-end' : 'flex-start',
            background: msg.type === 'sent' ? 'rgba(229,51,42,0.14)' : '#454545',
          }}>
            <div style={{fontSize:11, fontWeight:600, marginBottom:4}}>{msg.sender}</div>
            <div style={{fontSize:13, marginBottom:4}}>{msg.message}</div>
            <div style={{fontSize:10, color:'#9aa3b2'}}>{msg.time}</div>
          </div>
        ))}
      </div>

      <div style={{marginTop:16, display:'flex', gap:8}}>
        <input
          className="sos-input"
          placeholder="Type a message..."
          style={{flex:1}}
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
        />
        <button className="btn-primary" onClick={handleSend} disabled={sending || !newMessage.trim()}>
          {sending ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}

function PhotosTab() {
  return (
    <div>
      <div className="sos-title">Work Photos</div>
      <p className="sos-desc">Upload before/after photos and documentation</p>
      
      <div style={{marginTop:24}}>
        <div className="sos-item" style={{padding:40, flexDirection:'column', border:'2px dashed #5a5a5a'}}>
          <div style={{fontSize:48, marginBottom:12}}><FaCamera style={{marginRight:4}} /></div>
          <div style={{fontSize:14, color:'#b8beca', marginBottom:16}}>Click to upload or drag and drop</div>
          <button className="btn-primary">Choose Files</button>
        </div>
      </div>

      <div style={{marginTop:24}}>
        <div style={{fontSize:14, fontWeight:700, marginBottom:12}}>Recent Uploads</div>
        <div className="sos-list">
          {['Before - Engine', 'After - Engine', 'Parts Documentation'].map((photo, i) => (
            <div key={i} className="sos-item">
              <div>
                <div style={{fontWeight:600}}>{photo}</div>
                <div style={{fontSize:12, color:'#9aa3b2'}}>Today, {10 + i}:30 AM</div>
              </div>
              <button className="btn-outline" style={{fontSize:12}}>View</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DocumentsTab() {
  return (
    <div>
      <div className="sos-title">Documents</div>
      <p className="sos-desc">Service manuals, warranties, and work orders</p>
      
      <div className="sos-list" style={{marginTop:24}}>
        {[
          { name: 'Service Manual - Semi Truck', type: 'PDF' },
          { name: 'Parts Warranty', type: 'PDF' },
          { name: 'Work Order #1234', type: 'PDF' },
        ].map((doc, i) => (
          <div key={i} className="sos-item">
            <div>
              <div style={{fontWeight:600}}>{doc.name}</div>
              <div style={{fontSize:12, color:'#9aa3b2'}}>{doc.type}</div>
            </div>
            <button className="btn-outline">Download</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScheduleTab() {
  return (
    <div>
      <div className="sos-title">My Schedule</div>
      <p className="sos-desc">Today's appointments and upcoming work</p>
      
      <div className="sos-list" style={{marginTop:24}}>
        {[
          { time: '9:00 AM', customer: 'John Doe', service: 'Oil Change', status: 'Completed' },
          { time: '11:00 AM', customer: 'Jane Smith', service: 'Tire Rotation', status: 'In Progress' },
          { time: '2:00 PM', customer: 'Bob Johnson', service: 'Brake Repair', status: 'Scheduled' },
        ].map((appt, i) => (
          <div key={i} className="sos-item">
            <div style={{flex:1}}>
              <div style={{fontWeight:600}}>{appt.time} - {appt.customer}</div>
              <div style={{fontSize:12, color:'#b8beca'}}>{appt.service}</div>
            </div>
            <span className="sos-pill" style={{fontSize:10}}>{appt.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PerformanceTab() {
  return (
    <div>
      <div className="sos-title">Performance Metrics</div>
      <p className="sos-desc">Your stats and achievements</p>
      
      <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16, marginTop:24}}>
        {[
          { label: 'Jobs Completed', value: '48', color: '#4ade80' },
          { label: 'Avg Rating', value: '4.8', color: '#fbbf24' },
          { label: 'On-Time Rate', value: '96%', color: '#60a5fa' },
        ].map((stat, i) => (
          <div key={i} className="sos-item" style={{flexDirection:'column', alignItems:'flex-start'}}>
            <div style={{fontSize:11, color:'#9aa3b2', marginBottom:8}}>{stat.label}</div>
            <div style={{fontSize:24, fontWeight:800, color:stat.color}}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div style={{marginTop:32}}>
        <div style={{fontSize:14, fontWeight:700, marginBottom:12}}>Recent Reviews</div>
        <div className="sos-list">
          <div className="sos-item" style={{flexDirection:'column', alignItems:'flex-start'}}>
            <div style={{marginBottom:8}}><FaStar style={{marginRight:4}} /></div>
            <div style={{fontSize:13, marginBottom:4}}>"Excellent work! Very professional."</div>
            <div style={{fontSize:11, color:'#9aa3b2'}}>John Doe - 12/10/2025</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TechPortalEnhanced() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TechPortalEnhancedContent />
    </Suspense>
  );
}
