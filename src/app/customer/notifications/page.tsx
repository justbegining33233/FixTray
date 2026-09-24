'use client';

import { usePhrase } from '@/lib/usePhrase';
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
  const say = usePhrase();
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
        const rows = Array.isArray(data) ? data : [];
        setNotifications(rows
          .filter((row: Notification) => !row.read)
          .map((row: Notification & { message?: string }) => ({
            ...row,
            body: row.body || row.message || '',
          })));
      }
    } catch {}
    finally { setLoading(false); }
  };

  const markAsRead = async (id: string) => {
    const previous = notifications;
    setNotifications(prev => prev.filter(n => n.id !== id));
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/notifications-db', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id }),
      });
      if (!res.ok) setNotifications(previous);
    } catch {
      setNotifications(previous);
    }
  };

  const markAllRead = async () => {
    const previous = notifications;
    setNotifications([]);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/notifications-db', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'markAllRead' }),
      });
      if (!res.ok) setNotifications(previous);
    } catch {
      setNotifications(previous);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>{say("Loading...")}</div>;
  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#000000', padding: 24 }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <Link href="/customer/dashboard" style={{ color: '#ff6b64', textDecoration: 'none', fontSize: 14 }}><FaArrowLeft style={{marginRight:4}} /> {say("Dashboard")}</Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 24 }}>
          <div>
            <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 700 }}>{say("Notifications")}</h1>
            {unreadCount > 0 && <p style={{ color: '#ff6b64', fontSize: 14 }}>{say(unreadCount)} unread</p>}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              style={{ background: 'transparent', border: '1px solid #334155', color: '#93c5fd', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13 }}
            >
              {say("Clear all")}
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>{say("Loading notifications...")}</div>
        ) : notifications.length === 0 ? (
          <div style={{ background: '#1e293b', borderRadius: 12, padding: 40, textAlign: 'center', border: '1px solid #334155' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}><FaBell style={{marginRight:4}} /></div>
            <div style={{ color: '#6b7280' }}>{say("No notifications yet")}</div>
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
                      <span style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 14 }}>{say(n.title)}</span>
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: 13, marginTop: 4, lineHeight: 1.4 }}>{say(n.body)}</div>
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



