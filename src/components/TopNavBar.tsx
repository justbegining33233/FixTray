'use client';

import React from 'react';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { Route } from 'next';
import { useSocket } from '@/lib/socket';
import OilSlickNavCanvas from '@/components/OilSlickNavCanvas';
import ShopSwitcher from '@/components/ShopSwitcher';
import GlobalSearch from '@/components/GlobalSearch';
import { FaArrowRight, FaBell, FaCaretDown, FaCaretRight, FaCog, FaSignOutAlt, FaSquare, FaStore, FaUser, FaUserTie, FaWrench } from 'react-icons/fa';

interface TopNavBarProps {
  onMenuToggle?: () => void;
  showMenuButton?: boolean;
}

export default function TopNavBar({ onMenuToggle, showMenuButton = false }: TopNavBarProps) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const { isConnected, emit, on, off } = useSocket();
  const [userRole, setUserRole] = useState('');
  const [userName, setUserName] = useState('');
  const [shopName, setShopName] = useState('');
  const [shopId, setShopId] = useState('');
  const [userId, setUserId] = useState('');
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [navMsg, setNavMsg] = useState<{type:'success'|'error';text:string}|null>(null);
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; body: string; time: string; read?: boolean; type?: string; icon?: string }>>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notificationSoundEnabled, setNotificationSoundEnabled] = useState(true);
  const [_notificationPreferences, setNotificationPreferences] = useState<Record<string, boolean>>({});
  const [notificationPrefs, setNotificationPrefs] = useState({
    messages: true,
    workOrders: true,
    system: true,
  });
  const lastUnreadRef = useRef(0);

  const pathRole = pathname.split('/')[1] || '';
  const activeRole = userRole || pathRole;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const roleFromStorage = localStorage.getItem('userRole');
    const nameFromStorage = localStorage.getItem('userName');
    const shopFromStorage = localStorage.getItem('shopId');
    const userFromStorage = localStorage.getItem('userId');

    let resolvedRole = roleFromStorage || '';
    let resolvedName = nameFromStorage || 'User';
    let resolvedShop = shopFromStorage || '';
    let resolvedUserId = userFromStorage || '';

    try {
      const rawUser = localStorage.getItem('user');
      if (rawUser) {
        const parsed = JSON.parse(rawUser) as Record<string, unknown>;
        if (typeof parsed.role === 'string') resolvedRole = parsed.role;
        if (typeof parsed.name === 'string' && parsed.name.trim()) resolvedName = parsed.name;
        if (typeof parsed.id === 'string' && parsed.id.trim()) resolvedUserId = parsed.id;
        if (typeof parsed.shopId === 'string' && parsed.shopId.trim()) resolvedShop = parsed.shopId;
      }
    } catch {
      // Ignore malformed legacy payloads.
    }

    if (resolvedRole) localStorage.setItem('userRole', resolvedRole);
    if (resolvedName) localStorage.setItem('userName', resolvedName);
    if (resolvedUserId) localStorage.setItem('userId', resolvedUserId);
    if (resolvedShop) localStorage.setItem('shopId', resolvedShop);

    setUserRole(resolvedRole);
    setUserName(resolvedName);
    setUserId(resolvedUserId);

    if (resolvedShop) {
      setShopId(resolvedShop);
      fetchShopName(resolvedShop);
    }

    if (resolvedUserId && (resolvedRole === 'tech' || resolvedRole === 'manager')) {
      checkClockInStatus(resolvedUserId);
    }

    // Load notification preferences from localStorage
    const savedPrefs = localStorage.getItem('notificationPrefs');
    if (savedPrefs) {
      try {
        setNotificationPrefs(JSON.parse(savedPrefs));
      } catch (error) {
        console.error('Error parsing notification preferences:', error);
      }
    }

    const interval = setInterval(() => {
      if (resolvedUserId && (resolvedRole === 'tech' || resolvedRole === 'manager')) checkClockInStatus(resolvedUserId);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!shopId) return;

    const fetchNotificationSettings = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (!token) return;
        const response = await fetch(`/api/shops/settings?shopId=${shopId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include',
        });

        if (!response.ok) return;

        const data = await response.json();
        const settings = data.settings || data.shop?.settings || {};
        if (settings) {
          setNotificationsEnabled(settings.notificationsEnabled ?? true);
          setNotificationSoundEnabled(settings.notificationSoundEnabled ?? true);
          setNotificationPreferences(settings.notificationPreferences || {});
        }
      } catch {
      }
    };

    fetchNotificationSettings();
    const interval = setInterval(fetchNotificationSettings, 30000);
    return () => clearInterval(interval);
  }, [shopId]);

  const formatTimeAgo = (dateValue: string) => {
    const date = new Date(dateValue);
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const fetchMessageNotifications = async () => {
    try {
      if (typeof window === 'undefined') return;
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/messages', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) return;
      const data = await response.json();
      const conversations = Array.isArray(data?.conversations) ? data.conversations : [];

      const messageNotifications = conversations
        .filter((conv: any) => conv.unreadCount > 0)
        .map((conv: any) => ({
          id: `msg-${conv.contactRole}-${conv.contactId}`,
          title: `New message from ${conv.contactName || 'Contact'}`,
          body: conv.lastMessage,
          time: formatTimeAgo(conv.lastMessageAt),
          read: false,
          type: 'messages',
          icon: '💬',
        }));

      // Add work order notifications for shop owners/managers
      let workOrderNotifications: any[] = [];
      if (activeRole === 'shop' || activeRole === 'manager') {
        try {
          const woResponse = await fetch('/api/workorders?status=pending&limit=5', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (woResponse.ok) {
            const woData = await woResponse.json();
            const workOrders = Array.isArray(woData) ? woData : woData.workOrders || [];
            workOrderNotifications = workOrders
              .filter((wo: any) => {
                const createdAt = new Date(wo.createdAt);
                const hoursAgo = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
                return hoursAgo < 24; // Only show work orders from last 24 hours
              })
              .slice(0, 3)
              .map((wo: any) => ({
                id: `wo-${wo.id}`,
                title: `New work order: ${wo.serviceType || 'Service'}`,
                body: `${wo.customerName || 'Customer'} - ${wo.vehicleType || 'Vehicle'}`,
                time: formatTimeAgo(wo.createdAt),
                read: false,
                type: 'workorders',
                icon: '🔧',
              }));
          }
        } catch (_error) {
          // Ignore transient notification fetch failures.
        }
      }

      // Add system notifications
      const systemNotifications: Array<{ id: string; type: string; title: string; message: string; time: string }> = [
        // You can add system-wide notifications here
        // For example: maintenance notices, feature updates, etc.
      ];

      setNotifications([...messageNotifications, ...workOrderNotifications, ...systemNotifications]);
    } catch {
    }
  };

  useEffect(() => {
    fetchMessageNotifications();
    const interval = setInterval(fetchMessageNotifications, 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isConnected) return;

    const handleClockStatusChanged = (data: any) => {
      if (data.userId === userId) {
        setIsClockedIn(data.isClockedIn);
      }
    };

    on('clock-status-changed', handleClockStatusChanged);

    return () => {
      off('clock-status-changed', handleClockStatusChanged);
    };
  }, [isConnected, on, off, userId]);

  const fetchShopName = async (id: string) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const response = await fetch(`/api/shop?shopId=${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (response.ok) {
        const { shop } = await response.json();
        setShopName(shop.shopName || 'Shop');
      }
    } catch (error) {
      console.error('Error fetching shop name:', error);
    }
  };

  const checkClockInStatus = async (id: string) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const response = await fetch(`/api/timeclock/status?userId=${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (response.ok) {
        const { isClockedIn: status } = await response.json();
        setIsClockedIn(status);
      }
    } catch (error) {
      console.error('Error checking clock-in status:', error);
    }
  };

  const getRoleBadge = () => {
    const roles: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
      shop: { icon: <FaStore />, label: 'Shop Owner', color: '#e5332a' },
      manager: { icon: <FaUserTie />, label: 'Manager', color: '#e5332a' },
      tech: { icon: <FaWrench />, label: 'Tech', color: '#e5332a' },
      admin: { icon: <FaCog />, label: 'Admin', color: '#e5332a' },
      customer: { icon: <FaUser />, label: 'Customer', color: '#e5332a' },
    };

    const role = roles[activeRole] || { icon: '', label: 'User', color: '#6b7280' };

    return (
      <span style={{
        padding: '3px 9px',
        background: `${role.color}18`,
        color: role.color,
        border: `1px solid ${role.color}30`,
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        whiteSpace: 'nowrap',
        letterSpacing: '0.02em',
      }}>
        <span style={{ fontSize: 11 }}>{role.icon}</span>
        <span>{role.label}</span>
      </span>
    );
  };

  const getHomeLink = () => {
    switch (activeRole) {
      case 'shop': return '/shop/admin';
      case 'manager': return '/manager/home';
      case 'tech': return '/tech/home';
      case 'admin': return '/admin/home';
      case 'superadmin': return '/admin/home';
      case 'customer': return '/customer/dashboard';
      default: return '/';
    }
  };

  const getProfileLink = (): Route => {
    switch (activeRole) {
      case 'shop': return '/shop/profile' as Route;
      case 'manager': return '/manager/profile' as Route;
      case 'tech': return '/tech/profile' as Route;
      case 'admin': return '/admin/profile' as Route;
      case 'superadmin': return '/superadmin/profile' as Route;
      case 'customer': return '/customer/profile' as Route;
      default: return '/' as Route;
    }
  };

  const handleClockToggle = async () => {
    if (typeof window === 'undefined' || !userId) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const action = isClockedIn ? 'clock-out' : 'clock-in';

      const response = await fetch('/api/timeclock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, action }),
      });

      if (response.ok) {
        const result = await response.json();
        setIsClockedIn(!isClockedIn);
        setNavMsg({type:'success',text:result.message});

        if (emit) {
          emit('clock-status-change', { isClockedIn: !isClockedIn });
        }
      } else {
        const error = await response.json();
        setNavMsg({type:'error',text:error.error || 'Failed to update clock status'});
      }
    } catch (error) {
      console.error('Clock toggle error:', error);
      setNavMsg({type:'error',text:'Failed to update clock status'});
    } finally {
      setLoading(false);
    }
  };

  const getMessagesLink = () => {
    switch (activeRole) {
      case 'tech': return '/tech/messages';
      case 'manager': return '/manager/home';
      case 'shop': return '/shop/admin';
      case 'admin': return '/admin/messages';
      case 'customer': return '/customer/messages';
      default: return '/';
    }
  };

  const handleNotificationClick = (n: { id: string; type?: string }) => {
    markAsRead(n.id);
    setShowNotifications(false);

    // Handle different notification types
    switch (n.type) {
      case 'messages':
        router.push(getMessagesLink() as Route);
        break;
      case 'workorders':
        const workOrderId = n.id.replace('wo-', '');
        router.push(`/workorders/${workOrderId}` as Route);
        break;
      default:
        router.push(getMessagesLink() as Route);
    }
  };

  const handleSignOut = () => {
    if (typeof window === 'undefined') return;

    localStorage.removeItem('token');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    localStorage.removeItem('shopId');
    localStorage.removeItem('userId');
    localStorage.removeItem('user');
    window.location.href = '/auth/login';
  };

  const filteredNotifications = notificationsEnabled
    ? notifications.filter((n) => {
        if (!n.type) return true;
        return notificationPrefs[n.type as 'messages' | 'workOrders' | 'system'] !== false;
      })
    : [];

  const unreadCount = filteredNotifications.filter(n => !n.read).length;
  const displayUserName = userName || shopName || 'User';

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const updateNotificationPrefs = (type: string, enabled: boolean) => {
    const newPrefs = {
      ...notificationPrefs,
      [type]: enabled,
    };
    setNotificationPrefs(newPrefs);
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('notificationPrefs', JSON.stringify(newPrefs));
    }
  };

  const playNotificationChime = () => {
    if (!notificationSoundEnabled) return;
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gain.gain.value = 0.04;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.12);
    } catch {
    }
  };

  useEffect(() => {
    if (!notificationsEnabled) return;
    if (unreadCount > lastUnreadRef.current) {
      playNotificationChime();
    }
    lastUnreadRef.current = unreadCount;
  }, [unreadCount, notificationsEnabled, notificationSoundEnabled]);

  const toggleNotificationsMenu = () => {
    setShowNotifications((prev) => !prev);
    setShowProfileMenu(false);
  };

  const toggleProfileMenu = () => {
    setShowProfileMenu((prev) => !prev);
    setShowNotifications(false);
  };

  const NotificationButton = () => (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        onClick={toggleNotificationsMenu}
        style={{
          position: 'relative',
          padding: '8px 12px',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#e5e7eb',
          borderRadius: 8,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
        title={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'No new notifications'}
      >
        <span role="img" aria-label="Notifications">
          <FaBell style={{
            marginRight: 4,
            color: unreadCount > 0 ? '#ef4444' : '#e5e7eb'
          }} />
        </span>
        {unreadCount > 0 && (
          <span style={{
            background: '#ef4444',
            color: 'white',
            borderRadius: 999,
            padding: '2px 8px',
            fontSize: 11,
            fontWeight: 700,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 20,
            height: 20,
          }}>
            !
          </span>
        )}
      </button>

      {showNotifications && (
        <div style={{
          position: 'absolute',
          right: 0,
          marginTop: 8,
          width: 320,
          background: '#0f172a',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
          borderRadius: 12,
          overflow: 'hidden',
          zIndex: 2000,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ color: '#e5e7eb', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FaBell style={{ fontSize: 14 }} />
              Recent Notifications
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={markAllAsRead}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#93c5fd',
                  fontSize: 12,
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: 4,
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(147, 197, 253, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Mark all read
              </button>
            </div>
          </div>

          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {filteredNotifications.length === 0 ? (
              <div style={{ padding: 16, color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🔔</div>
                No new notifications
              </div>
            ) : filteredNotifications.map(n => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                style={{
                  padding: 12,
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  background: n.read ? 'transparent' : 'rgba(37,99,235,0.08)',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = n.read ? 'rgba(255,255,255,0.02)' : 'rgba(37,99,235,0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(37,99,235,0.08)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{
                    fontSize: 16,
                    lineHeight: 1,
                    marginTop: 2,
                    opacity: n.read ? 0.6 : 1,
                  }}>
                    {n.icon || '🔔'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 8,
                      marginBottom: 4,
                    }}>
                      <div style={{
                        color: '#e5e7eb',
                        fontWeight: 600,
                        fontSize: 13,
                        lineHeight: 1.3,
                        opacity: n.read ? 0.8 : 1,
                      }}>
                        {n.title}
                      </div>
                      <span style={{
                        color: '#9ca3af',
                        fontSize: 11,
                        whiteSpace: 'nowrap',
                        opacity: n.read ? 0.6 : 0.8,
                      }}>
                        {n.time}
                      </span>
                    </div>
                    <div style={{
                      color: '#cbd5e1',
                      fontSize: 12,
                      lineHeight: 1.4,
                      marginBottom: 6,
                      opacity: n.read ? 0.7 : 0.9,
                    }}>
                      {n.body}
                    </div>
                    <div style={{
                      color: '#93c5fd',
                      fontSize: 11,
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      {n.type === 'messages' && 'View messages'}
                      {n.type === 'workorders' && 'View work order'}
                      {!n.type && 'View details'}
                      <FaArrowRight style={{ fontSize: 10 }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Notification Preferences */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '12px' }}>
            <div style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Preferences</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: '#d1d5db' }}>
                <input
                  type="checkbox"
                  checked={notificationPrefs.messages !== false}
                  onChange={(e) => updateNotificationPrefs('messages', e.target.checked)}
                  style={{ accentColor: '#3b82f6' }}
                />
                Messages
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: '#d1d5db' }}>
                <input
                  type="checkbox"
                  checked={notificationPrefs.workOrders !== false}
                  onChange={(e) => updateNotificationPrefs('workOrders', e.target.checked)}
                  style={{ accentColor: '#3b82f6' }}
                />
                Work Orders
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: '#d1d5db' }}>
                <input
                  type="checkbox"
                  checked={notificationPrefs.system !== false}
                  onChange={(e) => updateNotificationPrefs('system', e.target.checked)}
                  style={{ accentColor: '#3b82f6' }}
                />
                System Updates
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const liveIndicator = true;

  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      minHeight: 48,
      display: 'flex',
      alignItems: 'center',
      overflowX: 'hidden',
      overflowY: 'visible',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      width: '100%',
      maxWidth: '100vw',
    }}>
      {/* Same oil-on-water canvas as the login page, clipped to nav height */}
      <OilSlickNavCanvas />

      {/* Nav content sits above the canvas */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', padding: '0 10px', display: 'flex', alignItems: 'center', overflowX: 'hidden', overflowY: 'visible' }}>
      <div style={{
        maxWidth: 1400,
        margin: '0 auto',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        flexWrap: 'nowrap',
        overflowX: 'hidden',
        overflowY: 'visible',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {showMenuButton && (
            <button
              onClick={onMenuToggle}
              aria-label="Toggle menu"
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.10)',
                width: 34, height: 34,
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ width: 16, height: 2, borderRadius: 2, background: '#e5332a', display: 'block' }} />
                <span style={{ width: 16, height: 2, borderRadius: 2, background: '#e5332a', display: 'block' }} />
                <span style={{ width: 16, height: 2, borderRadius: 2, background: '#e5332a', display: 'block' }} />
              </span>
            </button>
          )}

          <Link href={getHomeLink() as Route} style={{ textDecoration: 'none' }}>
            <span style={{
              fontSize: 17,
              fontWeight: 800,
              color: '#e5332a',
              letterSpacing: '-0.4px',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}>
              FixTray
            </span>
          </Link>

          {shopName && (
            <div className="nav-shop-name" style={{
              padding: '3px 10px',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 500,
              color: '#475569',
              border: '1px solid rgba(255,255,255,0.07)',
              whiteSpace: 'nowrap',
              letterSpacing: '0.02em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 120,
            }}>
              {shopName}
            </div>
          )}
          {activeRole === 'shop' && <ShopSwitcher />}
          {['shop', 'manager', 'tech'].includes(activeRole) && <GlobalSearch />}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, overflow: 'hidden' }}>
          <NotificationButton />

          {/* Profile / Menu dropdown */}
          <div style={{ position: 'relative' }} ref={profileMenuRef}>
            <button
              onClick={toggleProfileMenu}
              aria-haspopup="menu"
              aria-expanded={showProfileMenu}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                background: showProfileMenu ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#e5e7eb',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              <span style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                background: 'linear-gradient(135deg, #f97316, #ea580c)',
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                flexShrink: 0,
              }}>
                {displayUserName.charAt(0).toUpperCase()}
              </span>
              <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayUserName}</span>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: liveIndicator ? '#22c55e' : '#475569', display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: 14 }}><FaCaretDown style={{marginRight:4}} /></span>
            </button>

            {showProfileMenu && (
              <div style={{
                position: 'absolute',
                right: 0,
                marginTop: 8,
                width: 200,
                background: '#0f172a',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
                borderRadius: 12,
                overflow: 'hidden',
                zIndex: 2000,
              }}>
                {/* Role badge */}
                <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ color: '#e5e7eb', fontSize: 13, fontWeight: 700, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {displayUserName}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {getRoleBadge()}
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: liveIndicator ? '#22c55e' : '#475569', display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: liveIndicator ? '#4ade80' : '#475569', fontWeight: 600 }}>{liveIndicator ? 'Live' : 'Offline'}</span>
                  </div>
                </div>

                {/* My Profile */}
                <Link
                  href={getProfileLink()}
                  onClick={() => setShowProfileMenu(false)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    color: '#e2e8f0',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    textDecoration: 'none',
                    boxSizing: 'border-box',
                  }}
                >
                  <FaUser style={{marginRight:4}} /> My Profile
                </Link>

                {/* Clock In/Out for tech/manager */}
                {(activeRole === 'tech' || activeRole === 'manager') && (
                  <button
                    onClick={() => { handleClockToggle(); setShowProfileMenu(false); }}
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                      color: isClockedIn ? '#f87171' : '#4ade80',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      opacity: loading ? 0.55 : 1,
                    }}
                  >
                    <span style={{ fontSize: 11 }}>{isClockedIn ? <FaSquare /> : <FaCaretRight />}</span>
                    {isClockedIn ? 'Clock Out' : 'Clock In'}
                  </button>
                )}

                {/* Sign Out */}
                <button
                  onClick={() => { handleSignOut(); setShowProfileMenu(false); }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: 'transparent',
                    border: 'none',
                    color: '#e5332a',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <FaSignOutAlt style={{marginRight:4}} /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
      {navMsg && (
        <div style={{position:'fixed',bottom:24,right:24,background:navMsg.type==='success'?'#dcfce7':'#fde8e8',color:navMsg.type==='success'?'#166534':'#991b1b',borderRadius:10,padding:'12px 20px',zIndex:9999,fontSize:14,fontWeight:600,boxShadow:'0 4px 12px rgba(0,0,0,0.3)'}}>
          {navMsg.text}
          <button aria-label="Dismiss" onClick={()=>setNavMsg(null)} style={{marginLeft:12,background:'none',border:'none',cursor:'pointer',fontSize:16,color:'inherit'}}>×</button>
        </div>
      )}
    </nav>
  );
}
