'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Notification } from '@/types/customer';

export default function NotificationBell() {
  const say = usePhrase();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    const role = localStorage.getItem('userRole') || '';
    if (userId) setCustomerId(userId);
    setUserRole(role);
  }, []);

  const getMessagesLink = () => {
    switch (userRole) {
      case 'tech': return '/tech/messages';
      case 'manager': return '/manager/home';
      case 'shop': return '/shop/admin';
      case 'admin': return '/admin/messages';
      default: return '/customer/messages';
    }
  };

  const fetchNotifications = useCallback(async () => {
    if (!customerId) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/notifications?customerId=${customerId}`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      const rows = Array.isArray(data) ? data : [];
      setNotifications(rows.filter((item: Notification) => !item.read));
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, [customerId]);

  useEffect(() => {
    if (customerId) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [customerId, fetchNotifications]);

  const authHeaders = () => {
    const csrf = document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('csrf_token='))?.split('=')[1];
    const token = localStorage.getItem('token');
    return {
      ...(csrf ? { 'x-csrf-token': csrf } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const markAsRead = async (id: string) => {
    const previous = notifications;
    setNotifications(prev => prev.filter(n => n.id !== id));
    try {
      const res = await fetch(`/api/notifications?customerId=${customerId}&id=${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: authHeaders(),
      });
      if (!res.ok) setNotifications(previous);
    } catch (error) {
      console.error('Failed to mark as read:', error);
      setNotifications(previous);
    }
  };

  const markAllRead = async () => {
    const previous = notifications;
    setNotifications([]);
    try {
      const res = await fetch(`/api/notifications?customerId=${customerId}&action=markAllRead`, {
        method: 'PATCH',
        credentials: 'include',
        headers: authHeaders(),
      });
      if (!res.ok) setNotifications(previous);
      else setShowDropdown(false);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      setNotifications(previous);
    }
  };

  const deleteNotif = async (id: string) => {
    const previous = notifications;
    setNotifications(prev => prev.filter(n => n.id !== id));
    try {
      const res = await fetch(`/api/notifications?customerId=${customerId}&id=${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: authHeaders(),
      });
      if (!res.ok) setNotifications(previous);
    } catch (error) {
      console.error('Failed to delete notification:', error);
      setNotifications(previous);
    }
  };

  const handleNotifClick = (notif: Notification) => {
    void markAsRead(notif.id);
    setShowDropdown(false);
    if (notif.workOrderId) {
      const role = userRole || 'customer';
      const path = role === 'customer' ? `/customer/workorders/${notif.workOrderId}` : `/workorders/${notif.workOrderId}`;
      router.push(path as Route);
      return;
    }
    router.push(getMessagesLink() as Route);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div style={{position:'relative'}}>
      <button 
        onClick={() => setShowDropdown(!showDropdown)}
        className="btn-outline"
        style={{position:'relative', padding:'8px 12px'}}
      >
        ðŸ""
        {unreadCount > 0 && (
          <span style={{
            position:'absolute',
            top:'-4px',
            right:'-4px',
            background:'#e5332a',
            color:'white',
            borderRadius:'999px',
            width:'18px',
            height:'18px',
            fontSize:'10px',
            display:'flex',
            alignItems:'center',
            justifyContent:'center',
            fontWeight:700
          }}>
            {say(unreadCount)}
          </span>
        )}
      </button>

      {showDropdown && (
        <div style={{
          position:'absolute',
          right:0,
          top:'calc(100% + 8px)',
          width:'360px',
          maxHeight:'500px',
          background:'#1e1e2e',
          border:'1px solid rgba(255,255,255,0.1)',
          borderRadius:'12px',
          boxShadow:'0 10px 30px rgba(0,0,0,0.4)',
          zIndex:1000,
          overflow:'hidden'
        }}>
          <div style={{
            padding:'12px 16px',
            borderBottom:'1px solid rgba(255,255,255,0.08)',
            display:'flex',
            justifyContent:'space-between',
            alignItems:'center'
          }}>
            <div style={{fontWeight:700, fontSize:14, color:'#e5e7eb'}}>{say("Notifications")}</div>
            {unreadCount > 0 && (
              <button onClick={markAllRead} style={{fontSize:11, color:'#93c5fd', fontWeight:600, background:'none', border:'none', cursor:'pointer'}}>
                {say("Mark all read")}{' '}</button>
            )}
          </div>

          <div style={{maxHeight:'400px', overflowY:'auto'}}>
            {notifications.length === 0 ? (
              <div style={{padding:'40px 20px', textAlign:'center', color:'#9aa3b2', fontSize:13}}>
                {say("No notifications")}{' '}</div>
            ) : (
              notifications.map(notif => (
                <div 
                  key={notif.id}
                  onClick={() => handleNotifClick(notif)}
                  style={{
                    padding:'12px 16px',
                    borderBottom:'1px solid rgba(255,255,255,0.06)',
                    background: notif.read ? 'transparent' : 'rgba(37,99,235,0.1)',
                    cursor:'pointer',
                    transition:'background 0.15s',
                  }}
                >
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4}}>
                    <div style={{fontWeight:600, fontSize:13, color:'#e5e7eb'}}>{say(notif.title)}</div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); deleteNotif(notif.id); }}
                      style={{fontSize:16, color:'#6b7280', lineHeight:1, background:'none', border:'none', cursor:'pointer'}}
                    >
                      Ã - 
                    </button>
                  </div>
                  <div style={{fontSize:12, color:'#9ca3af', marginBottom:4}}>{say(notif.message)}</div>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div style={{fontSize:10, color:'#6b7280'}}>
                      {new Date(notif.createdAt).toLocaleString()}
                    </div>
                    <div style={{fontSize:11, color:'#93c5fd'}}>{say("View â'")}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
