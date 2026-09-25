'use client';

import { usePhrase } from '@/lib/usePhrase';
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
  const say = usePhrase();
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
        <div className="sos-header" data-desktop-chrome>
          <div className="sos-brand">
            <span className="mark">{say("FixTray")}</span>
            <span className="sub">{say("Tech Portal -")}{' '}{say(techName)}</span>
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
              {say("Sign Out")}{' '}</button>
            <Link href="/" className="btn-outline"><FaArrowLeft style={{marginRight:4}} /> {say("Home")}</Link>
          </div>
        </div>

        <div className="sos-content">
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
                  <span style={{marginRight:8}}>{say(feature.icon)}</span>
                  <span style={{fontSize:13}}>{say(feature.name)}</span>
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
          <span className="sos-tagline">© {new Date().getFullYear()} {say("FixTray")}</span>
          <div className="accent-bar" style={{width:112, borderRadius:6}} />
        </div>
      </div>
    </div>
  );
}

function AssignmentsTab({ workOrders, onRefresh }: { workOrders: WorkOrder[], onRefresh: () => void }) {
  const say = usePhrase();
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
      <div className="sos-title">{say("My Assignments")}</div>
      <p className="sos-desc">{say("Active work orders assigned to you")}</p>
      
      <div className="sos-list" style={{marginTop:24}}>
        {workOrders.length === 0 ? (
          <div style={{textAlign:'center', padding:40, color:'#9aa3b2'}}>{say("No active assignments")}</div>
        ) : (
          workOrders.map(wo => (
            <div key={wo.id} className="sos-item" style={{flexDirection:'column', alignItems:'flex-start'}}>
              <div style={{display:'flex', justifyContent:'space-between', width:'100%', marginBottom:8}}>
                <div style={{fontWeight:700}}>{say("WO #")}{wo.id.slice(0,8)}</div>
                <span className="sos-pill" style={{fontSize:10}}>{say(wo.status)}</span>
              </div>
              <div style={{fontSize:13, color:'#b8beca', marginBottom:8}}>
                {say(wo.vehicleType)} - {wo.services?.repairs?.[0]?.type || wo.services?.maintenance?.[0]?.type || workOrderTitle(wo)}
              </div>
              <div style={{fontSize:12, color:'#9aa3b2', marginBottom:12}}>
                {say("Customer:")}{' '}{wo.createdBy || say("Unknown")}
              </div>
              <div style={{display:'flex', flexWrap:'wrap', gap:8, width:'100%'}}>
                <button className="btn-primary" onClick={() => completeJob(wo.id)} style={{flex:1}}>
                  {say("Mark Complete")}{' '}</button>
                <Link href={`/workorders/${wo.id}`} className="btn-outline" style={{flex:1, textAlign:'center'}}>
                  {say("View Details")}{' '}</Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function LocationTab({ location, techName }: { location: { lat: number, lng: number }, techName: string }) {
  const say = usePhrase();
  return (
    <div>
      <div className="sos-title">{say("Location Sharing")}</div>
      <p className="sos-desc">{say("Your location is shared with customers for ETA tracking")}</p>
      
      <div className="sos-item" style={{marginTop:24, padding:24, flexDirection:'column', alignItems:'center'}}>
        <div style={{fontSize:48, marginBottom:16}}><FaMapMarkerAlt style={{marginRight:4}} /></div>
        <div style={{fontSize:16, fontWeight:700, marginBottom:8}}>{say(techName)}</div>
        <div style={{fontSize:13, color:'#b8beca', marginBottom:16}}>{say("Location Sharing: Active")}</div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, width:'100%'}}>
          <div className="sos-item" style={{flexDirection:'column'}}>
            <div style={{fontSize:11, color:'#9aa3b2'}}>{say("Latitude")}</div>
            <div style={{fontSize:14, fontWeight:600}}>{location.lat.toFixed(4)}</div>
          </div>
          <div className="sos-item" style={{flexDirection:'column'}}>
            <div style={{fontSize:11, color:'#9aa3b2'}}>{say("Longitude")}</div>
            <div style={{fontSize:14, fontWeight:600}}>{location.lng.toFixed(4)}</div>
          </div>
        </div>
        <button className="btn-outline" style={{marginTop:16, width:'100%'}}>{say("Pause Location Sharing")}</button>
      </div>
    </div>
  );
}

function MessagesTab({ techName }: { techName: string }) {
  const say = usePhrase();
  const [messages, setMessages] = useState<{id:string;sender:string;message:string;time:string;type:string}[]>([]);
  const [replyTo, setReplyTo] = useState<{ id: string; role: string; name: string } | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [sendError, setSendError] = useState('');

  const loadMessages = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoadError('Sign in again to load messages.');
      return;
    }
    try {
      const res = await fetch('/api/messages', {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      if (!res.ok) {
        setLoadError('Could not load messages.');
        return;
      }
      const data = await res.json();
      const conversations = Array.isArray(data?.conversations) ? data.conversations : [];
      const userId = localStorage.getItem('userId');
      const rows = conversations.flatMap((conv: any) =>
        (Array.isArray(conv.messages) ? conv.messages : []).map((msg: any) => ({
          id: String(msg.id),
          sender: msg.senderName || conv.contactName || 'Contact',
          message: String(msg.body || ''),
          time: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: msg.senderId === userId ? 'sent' : 'received',
          createdAt: msg.createdAt,
        })),
      ).sort((a: { createdAt: string }, b: { createdAt: string }) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setMessages(rows);
      const latest = conversations[0];
      if (latest?.contactId && latest?.contactRole) {
        setReplyTo({ id: latest.contactId, role: latest.contactRole, name: latest.contactName || 'Contact' });
      }
      setLoadError('');
    } catch {
      setLoadError('Could not load messages.');
    }
  };

  useEffect(() => {
    loadMessages();
  }, []);

  const handleSend = async () => {
    const text = newMessage.trim();
    if (!text) return;
    if (!replyTo) {
      setSendError('No thread to reply to yet. Open Messages to start one. Your draft is still here.');
      return;
    }
    setSending(true);
    setSendError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          receiverId: replyTo.id,
          receiverRole: replyTo.role,
          receiverName: replyTo.name,
          messageBody: text,
        }),
      });
      if (res.ok) {
        setNewMessage('');
        await loadMessages();
      } else {
        const err = await res.json().catch(() => ({}));
        setSendError(err.error || 'Message was not saved. Your draft is still here.');
      }
    } catch {
      setSendError('Message was not saved. Your draft is still here.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSend();
  };

  return (
    <div>
      <div className="sos-title">{say("Messages")}</div>
      <p className="sos-desc">{say("Chat with customers and managers")}{techName ? ` · ${techName}` : ''}</p>
      
      <div className="sos-list" style={{marginTop:24}}>
        {loadError && (
          <div style={{textAlign:'center', padding:40, color:'#fca5a5'}}>{say(loadError)}</div>
        )}
        {!loadError && messages.length === 0 && (
          <div style={{textAlign:'center', padding:40, color:'#9aa3b2'}}>{say("No messages yet")}</div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="sos-item" style={{
            flexDirection:'column',
            alignItems: msg.type === 'sent' ? 'flex-end' : 'flex-start',
            background: msg.type === 'sent' ? 'rgba(229,51,42,0.14)' : '#454545',
          }}>
            <div style={{fontSize:11, fontWeight:600, marginBottom:4}}>{say(msg.sender)}</div>
            <div style={{fontSize:13, marginBottom:4}}>{say(msg.message)}</div>
            <div style={{fontSize:10, color:'#9aa3b2'}}>{say(msg.time)}</div>
          </div>
        ))}
      </div>

      <div style={{marginTop:16, display:'flex', gap:8}}>
        <input
          className="sos-input"
          placeholder={say("Type a message...")}
          style={{flex:1}}
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
        />
        <button className="btn-primary" onClick={handleSend} disabled={sending || !newMessage.trim()}>
          {sending ? '...' : say("Send")}
        </button>
      </div>
      {sendError && <div style={{marginTop:8, fontSize:12, color:'#fca5a5'}}>{say(sendError)}</div>}
    </div>
  );
}

function PhotosTab() {
  const say = usePhrase();
  return (
    <div>
      <div className="sos-title">{say("Work Photos")}</div>
      <p className="sos-desc">{say("Upload before/after photos and documentation")}</p>
      
      <div style={{marginTop:24}}>
        <div className="sos-item" style={{padding:40, flexDirection:'column', border:'2px dashed #5a5a5a'}}>
          <div style={{fontSize:48, marginBottom:12}}><FaCamera style={{marginRight:4}} /></div>
          <div style={{fontSize:14, color:'#b8beca', marginBottom:16}}>{say("Click to upload or drag and drop")}</div>
          <button className="btn-primary">{say("Choose Files")}</button>
        </div>
      </div>

      <div style={{marginTop:24}}>
        <div style={{fontSize:14, fontWeight:700, marginBottom:12}}>{say("Recent Uploads")}</div>
        <div className="sos-list">
          {[say("Before - Engine"), say("After - Engine"), say("Parts Documentation")].map((photo, i) => (
            <div key={i} className="sos-item">
              <div>
                <div style={{fontWeight:600}}>{say(photo)}</div>
                <div style={{fontSize:12, color:'#9aa3b2'}}>{say("Today,")}{' '}{10 + i}{say(":30 AM")}</div>
              </div>
              <button className="btn-outline" style={{fontSize:12}}>{say("View")}</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DocumentsTab() {
  const say = usePhrase();
  return (
    <div>
      <div className="sos-title">{say("Documents")}</div>
      <p className="sos-desc">{say("Service manuals, warranties, and work orders")}</p>
      
      <div className="sos-list" style={{marginTop:24}}>
        {[
          { name: say("Service Manual - Semi Truck"), type: say("PDF") },
          { name: say("Parts Warranty"), type: say("PDF") },
          { name: say("Work Order #1234"), type: say("PDF") },
        ].map((doc, i) => (
          <div key={i} className="sos-item">
            <div>
              <div style={{fontWeight:600}}>{say(doc.name)}</div>
              <div style={{fontSize:12, color:'#9aa3b2'}}>{say(doc.type)}</div>
            </div>
            <button className="btn-outline">{say("Download")}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScheduleTab() {
  const say = usePhrase();
  return (
    <div>
      <div className="sos-title">{say("My Schedule")}</div>
      <p className="sos-desc">{say("Today's appointments and upcoming work")}</p>
      
      <div className="sos-list" style={{marginTop:24}}>
        {[
          { time: say("9:00 AM"), customer: say("John Doe"), service: say("Oil Change"), status: say("Completed") },
          { time: say("11:00 AM"), customer: say("Jane Smith"), service: say("Tire Rotation"), status: say("In Progress") },
          { time: say("2:00 PM"), customer: say("Bob Johnson"), service: say("Brake Repair"), status: say("Scheduled") },
        ].map((appt, i) => (
          <div key={i} className="sos-item">
            <div style={{flex:1}}>
              <div style={{fontWeight:600}}>{say(appt.time)} - {say(appt.customer)}</div>
              <div style={{fontSize:12, color:'#b8beca'}}>{say(appt.service)}</div>
            </div>
            <span className="sos-pill" style={{fontSize:10}}>{say(appt.status)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PerformanceTab() {
  const say = usePhrase();
  return (
    <div>
      <div className="sos-title">{say("Performance Metrics")}</div>
      <p className="sos-desc">{say("Your stats and achievements")}</p>
      
      <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16, marginTop:24}}>
        {[
          { label: say("Jobs Completed"), value: '48', color: '#4ade80' },
          { label: say("Avg Rating"), value: '4.8', color: '#fbbf24' },
          { label: say("On-Time Rate"), value: '96%', color: '#60a5fa' },
        ].map((stat, i) => (
          <div key={i} className="sos-item" style={{flexDirection:'column', alignItems:'flex-start'}}>
            <div style={{fontSize:11, color:'#9aa3b2', marginBottom:8}}>{say(stat.label)}</div>
            <div style={{fontSize:24, fontWeight:800, color:stat.color}}>{say(stat.value)}</div>
          </div>
        ))}
      </div>

      <div style={{marginTop:32}}>
        <div style={{fontSize:14, fontWeight:700, marginBottom:12}}>{say("Recent Reviews")}</div>
        <div className="sos-list">
          <div className="sos-item" style={{flexDirection:'column', alignItems:'flex-start'}}>
            <div style={{marginBottom:8}}><FaStar style={{marginRight:4}} /></div>
            <div style={{fontSize:13, marginBottom:4}}>{say("\"Excellent work! Very professional.\"")}</div>
            <div style={{fontSize:11, color:'#9aa3b2'}}>{say("John Doe - 12/10/2025")}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TechPortalEnhanced() {
  const say = usePhrase();
  return (
    <Suspense fallback={<div>{say("Loading...")}</div>}>
      <TechPortalEnhancedContent />
    </Suspense>
  );
}
