'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaBell } from 'react-icons/fa';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  createdAt: string;
}

export default function CustomerNotificationsPage() {
  const { user, isLoading } = useRequireAuth(['customer']);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/notifications-db', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setNotifications(Array.isArray(data) ? data : []);
      }
    } catch {}
    finally { setLoading(false); }
  };

  const markAsRead = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/notifications-db', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id }),
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch {}
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#000000', padding: 24 }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <Link href="/customer/dashboard" style={{ color: '#ff6b64', textDecoration: 'none', fontSize: 14 }}><FaArrowLeft style={{marginRight:4}} /> Dashboard</Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 24 }}>
          <div>
            <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 700 }}>Notifications</h1>
            {unreadCount > 0 && <p style={{ color: '#ff6b64', fontSize: 14 }}>{unreadCount} unread</p>}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div style={{ background: '#1e293b', borderRadius: 12, padding: 40, textAlign: 'center', border: '1px solid #334155' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}><FaBell style={{marginRight:4}} /></div>
            <div style={{ color: '#6b7280' }}>No notifications yet</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {notifications.map(n => (
              <div key={n.id} onClick={() => !n.read && markAsRead(n.id)}
                style={{
                  background: n.read ? '#1e293b' : '#172033', borderRadius: 12, padding: '16px 20px',
                  border: n.read ? '1px solid #334155' : '1px solid #1d4ed8',
                  cursor: n.read ? 'default' : 'pointer',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {!n.read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e5332a', flexShrink: 0 }} />}
                      <span style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 14 }}>{n.title}</span>
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: 13, marginTop: 4, lineHeight: 1.4 }}>{n.body}</div>
                  </div>
                  <span style={{ color: '#4b5563', fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {new Date(n.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}



