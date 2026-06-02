"use client";
import React, { useEffect, useState } from 'react';
import { useRequireAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { FaArrowLeft, FaCircle, FaClock, FaPowerOff, FaRegClock, FaSyncAlt } from 'react-icons/fa';

type Session = {
  id: string;
  adminId?: string | null;
  metadata?: any;
  createdAt: string;
  expiresAt: string | null;
  revoked?: boolean;
  isActive?: boolean;
};

type PresenceUser = {
  id: string;
  username: string;
  email: string;
  isSuperAdmin: boolean;
  currentlyOn: boolean;
  activeLast24h: boolean;
  inactive48hPlus: boolean;
  lastActivityAt: string | null;
  lastActivityAgeMinutes: number | null;
  createdAt: string;
};

type Buckets = {
  currentlyOn: PresenceUser[];
  activeLast24h: PresenceUser[];
  inactive48hPlus: PresenceUser[];
};

type SessionsApiResponse = {
  sessions: Session[];
  buckets?: Buckets;
};

export default function AdminSessionsPage() {
  const { user, isLoading: authLoading } = useRequireAuth(['admin', 'superadmin']);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [buckets, setBuckets] = useState<Buckets>({
    currentlyOn: [],
    activeLast24h: [],
    inactive48hPlus: [],
  });
  const [loading, setLoading] = useState(false);
  const [revokeId, setRevokeId] = useState<string|null>(null);
  const [activeTab, setActiveTab] = useState<'currently-on' | 'last-24h' | 'inactive-48h'>('currently-on');

  const tabItems = [
    { id: 'currently-on' as const, label: 'Currently On', count: buckets.currentlyOn.length, icon: <FaCircle style={{marginRight:4}} /> },
    { id: 'last-24h' as const, label: 'Not Logged In - Active Last 24h', count: buckets.activeLast24h.length, icon: <FaClock style={{marginRight:4}} /> },
    { id: 'inactive-48h' as const, label: 'Inactive 48h+', count: buckets.inactive48hPlus.length, icon: <FaPowerOff style={{marginRight:4}} /> },
  ];

  function formatRelativeFromMinutes(minutes: number | null) {
    if (minutes === null) return 'No activity recorded';
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function activeSessionsForAdmin(adminId: string) {
    return sessions.filter((s) => s.adminId === adminId && s.isActive);
  }

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/auth/sessions', { credentials: 'include' });
      const j: SessionsApiResponse = await r.json();
      setSessions(j.sessions || []);
      if (j.buckets) {
        setBuckets(j.buckets);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { 
    if (user && !authLoading) load(); 
  }, [user, authLoading]);

  // Show loading state while checking authentication
  if (authLoading) {
    return <div className="p-4">Loading...</div>;
  }

  // If no user, the useRequireAuth hook will handle redirect
  if (!user) {
    return null;
  }

  async function revoke(id: string) {
    const csrf = document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('csrf_token='))?.split('=')[1];
    await fetch('/api/auth/sessions', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf || '' },
      body: JSON.stringify({ id }),
    });
    setSessions(sessions.filter(s => s.id !== id));
    setRevokeId(null);
    await load();
  }

  const activeUsers =
    activeTab === 'currently-on'
      ? buckets.currentlyOn
      : activeTab === 'last-24h'
      ? buckets.activeLast24h
      : buckets.inactive48hPlus;

  return (
    <div className="min-h-screen bg-black text-slate-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/home" className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"><FaArrowLeft style={{marginRight:4}} /></Link>
            <div>
              <h1 className="text-2xl font-bold">Session Control Center</h1>
              <p className="text-sm text-slate-400">Monitor live admin presence and activity windows</p>
            </div>
          </div>
          <button onClick={load} className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm"><FaSyncAlt style={{marginRight:4}} /> Refresh</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tabItems.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`text-left p-4 rounded-xl border transition-all ${
                activeTab === tab.id
                  ? 'bg-[#e5332a]/10 border-[#e5332a]/40 shadow-lg shadow-[#e5332a]/10'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              <div className="text-xs text-slate-400 mb-1">{tab.label}</div>
              <div className="text-3xl font-bold text-white">{tab.count}</div>
              <div className="text-xs text-slate-500 mt-2">{tab.icon} Live grouped count</div>
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <div className="font-semibold">
              {activeTab === 'currently-on' && 'Currently On'}
              {activeTab === 'last-24h' && 'Not Logged In, Still Active In Last 24 Hours'}
              {activeTab === 'inactive-48h' && 'Not Active For More Than 48 Hours'}
            </div>
            {loading && <div className="text-xs text-slate-400">Loading...</div>}
          </div>

          {activeUsers.length === 0 ? (
            <div className="p-8 text-center text-slate-400">No users in this bucket.</div>
          ) : (
            <div className="divide-y divide-white/10">
              {activeUsers.map((u) => {
                const userActiveSessions = activeSessionsForAdmin(u.id);
                return (
                  <div key={u.id} className="p-4 md:p-5">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <div className="font-semibold text-white flex items-center gap-2">
                          {u.username}
                          {u.isSuperAdmin && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#e5332a]/15 border border-[#e5332a]/30 text-[#ff6b64]">Superadmin</span>}
                        </div>
                        <div className="text-sm text-slate-400">{u.email}</div>
                        <div className="text-xs text-slate-500 mt-1"><FaRegClock style={{marginRight:4}} /> Last activity: {formatRelativeFromMinutes(u.lastActivityAgeMinutes)}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        {activeTab === 'currently-on' && (
                          <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                            {userActiveSessions.length} active session{userActiveSessions.length === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>
                    </div>

                    {activeTab === 'currently-on' && userActiveSessions.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {userActiveSessions.map((s) => (
                          <div key={s.id} className="p-3 rounded-lg border border-white/10 bg-black/40 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                            <div className="text-xs text-slate-400">
                              <div>Session: {s.id}</div>
                              <div>Created: {new Date(s.createdAt).toLocaleString()}</div>
                              <div>Expires: {s.expiresAt ? new Date(s.expiresAt).toLocaleString() : 'Never'}</div>
                            </div>
                            <button onClick={() => setRevokeId(s.id)} className="px-3 py-1.5 rounded-md bg-red-600/90 hover:bg-red-600 text-white text-sm">Revoke</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold mb-2">Session Inventory</div>
          <div className="text-xs text-slate-400">Total records: {sessions.length} | Active right now: {sessions.filter((s) => s.isActive).length}</div>
        </div>
      </div>

      {revokeId && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <div style={{background:'#1e2533',borderRadius:14,padding:24,minWidth:300,maxWidth:420,boxShadow:'0 8px 32px rgba(0,0,0,0.5)',width:'100%'}}>
            <h3 style={{fontSize:18,fontWeight:700,color:'#e5e7eb',marginBottom:12}}>Revoke Session?</h3>
            <p style={{fontSize:14,color:'#9aa3b2',marginBottom:24}}>Are you sure you want to revoke this session? The user will be logged out immediately.</p>
            <div style={{display:'flex',gap:12}}>
              <button onClick={()=>revoke(revokeId)} style={{flex:1,padding:'10px 0',background:'#ef4444',color:'#fff',border:'none',borderRadius:8,fontSize:14,fontWeight:700,cursor:'pointer'}}>Revoke</button>
              <button onClick={()=>setRevokeId(null)} style={{flex:1,padding:'10px 0',background:'transparent',color:'#9aa3b2',border:'1px solid rgba(255,255,255,0.15)',borderRadius:8,fontSize:14,cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
