'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { FaBell } from 'react-icons/fa';
import { Notification } from '@/types/customer';
import { workOrderNotificationCopy } from '@/lib/notificationCopy';
import {
  parseMessageNotificationId,
  recentAlertWorkOrders,
  showsSyntheticWorkOrderAlerts,
} from '@/lib/notificationInbox';
import { saveSeenWorkOrderIds, syncSeenWorkOrderIds } from '@/lib/seenWorkOrderAlerts';

type BellItem = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  workOrderId?: string;
  kind: 'customer' | 'message' | 'workorder';
};

type PendingWorkOrder = {
  id: string;
  createdAt?: string | Date | null;
  serviceType?: unknown;
  issueDescription?: unknown;
  customerName?: string;
  customer?: { firstName?: string | null; lastName?: string | null };
  vehicleType?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleYear?: string | number | null;
};

function pendingWorkOrders(data: unknown): PendingWorkOrder[] {
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { workOrders?: unknown }).workOrders)
      ? (data as { workOrders: unknown[] }).workOrders
      : [];
  const orders: PendingWorkOrder[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const record = row as PendingWorkOrder;
    if (typeof record.id !== 'string' || !record.id) continue;
    orders.push(record);
  }
  return orders;
}

function messagesLink(role: string): string {
  switch (role) {
    case 'tech': return '/tech/messages';
    case 'manager': return '/manager/messages';
    case 'shop': return '/shop/customer-messages';
    case 'admin':
    case 'superadmin': return '/admin/messages';
    default: return '/customer/messages';
  }
}

export default function NotificationBell() {
  const say = usePhrase();
  const router = useRouter();
  const [items, setItems] = useState<BellItem[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    setUserId(localStorage.getItem('userId'));
    setUserRole(localStorage.getItem('userRole') || '');
  }, []);

  const authHeaders = () => {
    const csrf = document.cookie.split(';').map(s => s.trim()).find(s => s.startsWith('csrf_token='))?.split('=')[1];
    const token = localStorage.getItem('token');
    return {
      ...(csrf ? { 'x-csrf-token': csrf } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const fetchNotifications = useCallback(async () => {
    if (!userId || !userRole) return;
    const token = localStorage.getItem('token');
    try {
      if (userRole === 'customer') {
        const res = await fetch(`/api/notifications?customerId=${userId}`, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        const rows = Array.isArray(data) ? data : [];
        setItems(rows.filter((item: Notification) => !item.read).map((item: Notification) => ({
          id: item.id,
          title: item.title,
          message: item.message,
          createdAt: new Date(item.createdAt).toISOString(),
          read: false,
          workOrderId: item.workOrderId,
          kind: 'customer' as const,
        })));
        return;
      }

      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const [messageRes, seen] = await Promise.all([
        fetch('/api/messages', { credentials: 'include', headers }),
        syncSeenWorkOrderIds(),
      ]);
      const messageData = messageRes.ok ? await messageRes.json() : { conversations: [] };
      const conversations = Array.isArray(messageData?.conversations) ? messageData.conversations : [];
      const messageItems: BellItem[] = conversations
        .filter((conv: { unreadCount?: number }) => (conv.unreadCount || 0) > 0)
        .map((conv: { contactRole: string; contactId: string; contactName?: string; lastMessage?: string; lastMessageAt?: string }) => ({
          id: `msg-${conv.contactRole}-${conv.contactId}`,
          title: `New message from ${conv.contactName || 'Contact'}`,
          message: conv.lastMessage || '',
          createdAt: conv.lastMessageAt || new Date().toISOString(),
          read: false,
          kind: 'message' as const,
        }));

      let workOrderItems: BellItem[] = [];
      if (showsSyntheticWorkOrderAlerts(userRole)) {
        const woRes = await fetch('/api/workorders?status=pending&limit=5', { credentials: 'include', headers });
        if (woRes.ok) {
          const woData: unknown = await woRes.json();
          const workOrders = pendingWorkOrders(woData);
          workOrderItems = recentAlertWorkOrders(workOrders)
            .filter((wo) => !seen.has(`wo-${wo.id}`))
            .map((wo) => {
              const customerName = wo.customerName
                || [wo.customer?.firstName, wo.customer?.lastName].filter(Boolean).join(' ');
              const copy = workOrderNotificationCopy({
                id: wo.id,
                serviceType: wo.serviceType,
                issueDescription: wo.issueDescription,
                customerName,
                vehicle: wo.vehicleType || wo.vehicleMake || [wo.vehicleYear, wo.vehicleMake, wo.vehicleModel].filter(Boolean).join(' '),
                kind: 'created',
              });
              const createdAt = typeof wo.createdAt === 'string'
                ? wo.createdAt
                : wo.createdAt instanceof Date
                  ? wo.createdAt.toISOString()
                  : new Date().toISOString();
              return {
                id: `wo-${wo.id}`,
                title: copy.title,
                message: copy.body,
                createdAt,
                read: false,
                workOrderId: wo.id,
                kind: 'workorder' as const,
              };
            });
        }
      }
      setItems([...messageItems, ...workOrderItems]);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, [userId, userRole]);

  useEffect(() => {
    if (!userId || !userRole) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [userId, userRole, fetchNotifications]);

  const markCustomerRead = async (id: string) => {
    const previous = items;
    setItems(prev => prev.filter(n => n.id !== id));
    try {
      const res = await fetch(`/api/notifications?customerId=${userId}&id=${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: authHeaders(),
      });
      if (!res.ok) setItems(previous);
    } catch (error) {
      console.error('Failed to mark as read:', error);
      setItems(previous);
    }
  };

  const markMessageRead = async (id: string) => {
    const parsed = parseMessageNotificationId(id);
    const token = localStorage.getItem('token');
    if (!parsed || !token) return false;
    const res = await fetch('/api/messages', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ contactId: parsed.contactId, contactRole: parsed.contactRole }),
    });
    return res.ok;
  };

  const dismissItem = async (item: BellItem) => {
    const previous = items;
    setItems(prev => prev.filter(n => n.id !== item.id));
    try {
      if (item.kind === 'customer') {
        await markCustomerRead(item.id);
        return;
      }
      if (item.kind === 'workorder') {
        saveSeenWorkOrderIds([item.id]);
        return;
      }
      const ok = await markMessageRead(item.id);
      if (!ok) setItems(previous);
    } catch (error) {
      console.error('Failed to dismiss notification:', error);
      setItems(previous);
    }
  };

  const markAllRead = async () => {
    const previous = items;
    setItems([]);
    try {
      if (userRole === 'customer') {
        const res = await fetch(`/api/notifications?customerId=${userId}&action=markAllRead`, {
          method: 'PATCH',
          credentials: 'include',
          headers: authHeaders(),
        });
        if (!res.ok) setItems(previous);
        else setShowDropdown(false);
        return;
      }
      const workOrderIds = previous.filter(item => item.kind === 'workorder').map(item => item.id);
      if (workOrderIds.length > 0) saveSeenWorkOrderIds(workOrderIds);
      const results = await Promise.all(previous.filter(item => item.kind === 'message').map(item => markMessageRead(item.id)));
      if (results.some(ok => !ok)) setItems(previous.filter(item => item.kind === 'message'));
      else setShowDropdown(false);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      setItems(previous);
    }
  };

  const deleteNotif = async (item: BellItem) => {
    if (item.kind !== 'customer') {
      await dismissItem(item);
      return;
    }
    const previous = items;
    setItems(prev => prev.filter(n => n.id !== item.id));
    try {
      const res = await fetch(`/api/notifications?customerId=${userId}&id=${item.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: authHeaders(),
      });
      if (!res.ok) setItems(previous);
    } catch (error) {
      console.error('Failed to delete notification:', error);
      setItems(previous);
    }
  };

  const handleNotifClick = (item: BellItem) => {
    void dismissItem(item);
    setShowDropdown(false);
    if (item.workOrderId) {
      const path = userRole === 'customer'
        ? `/customer/workorders/${item.workOrderId}`
        : `/workorders/${item.workOrderId}`;
      router.push(path as Route);
      return;
    }
    router.push(messagesLink(userRole) as Route);
  };

  const unreadCount = items.filter(n => !n.read).length;

  return (
    <div style={{position:'relative'}}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="btn-outline"
        style={{position:'relative', padding:'8px 12px'}}
        aria-label={say("Notifications")}
      >
        <FaBell />
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
            {items.length === 0 ? (
              <div style={{padding:'40px 20px', textAlign:'center', color:'#9aa3b2', fontSize:13}}>
                {say("No notifications")}{' '}</div>
            ) : (
              items.map(notif => (
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
                      aria-label={say("Dismiss")}
                      onClick={(e) => { e.stopPropagation(); void deleteNotif(notif); }}
                      style={{fontSize:16, color:'#6b7280', lineHeight:1, background:'none', border:'none', cursor:'pointer'}}
                    >
                      ×
                    </button>
                  </div>
                  <div style={{fontSize:12, color:'#9ca3af', marginBottom:4}}>{say(notif.message)}</div>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div style={{fontSize:10, color:'#6b7280'}}>
                      {new Date(notif.createdAt).toLocaleString()}
                    </div>
                    <div style={{fontSize:11, color:'#93c5fd'}}>{say("View")}</div>
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
