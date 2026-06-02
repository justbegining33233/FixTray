'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { Route } from 'next';
import { FaHistory, FaClock } from 'react-icons/fa';

interface RecentlyViewedItem {
  id: string;
  title: string;
  href: string;
  type: 'workorder' | 'customer' | 'vehicle' | 'page';
  timestamp: number;
}

interface RecentlyViewedProps {
  maxItems?: number;
  showInSidebar?: boolean;
}

export default function RecentlyViewed({ maxItems = 5, showInSidebar = false }: RecentlyViewedProps) {
  const [recentItems, setRecentItems] = useState<RecentlyViewedItem[]>([]);
  const [currentTimestamp, setCurrentTimestamp] = useState<number>(() => Date.now());
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimestamp(Date.now());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Load recently viewed items from localStorage
    const stored = localStorage.getItem('recentlyViewed');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setRecentItems(parsed);
      } catch (error) {
        console.error('Error parsing recently viewed items:', error);
      }
    }
  }, []);

  useEffect(() => {
    // Track current page view
    if (!pathname) return;

    const now = Date.now();
    let title = '';
    let type: RecentlyViewedItem['type'] = 'page';

    // Extract meaningful titles and types from pathname
    if (pathname.includes('/workorders/') && pathname.split('/').length > 2) {
      const id = pathname.split('/')[2];
      title = `Work Order ${id}`;
      type = 'workorder';
    } else if (pathname.includes('/customers/')) {
      title = 'Customer Details';
      type = 'customer';
    } else if (pathname.includes('/vehicles/')) {
      title = 'Vehicle Details';
      type = 'vehicle';
    } else {
      // Map common pages to readable titles
      const pageTitles: Record<string, string> = {
        '/shop/home': 'Shop Dashboard',
        '/shop/admin': 'Shop Admin',
        '/tech/home': 'Tech Dashboard',
        '/admin/home': 'Admin Dashboard',
        '/customer/dashboard': 'Customer Dashboard',
        '/workorders/list': 'Work Orders',
        '/workorders/new': 'New Work Order',
      };
      title = pageTitles[pathname] || pathname.split('/').pop()?.replace(/-/g, ' ') || 'Page';
    }

    const newItem: RecentlyViewedItem = {
      id: `${type}-${pathname}`,
      title: title.charAt(0).toUpperCase() + title.slice(1),
      href: pathname,
      type,
      timestamp: now,
    };

    setRecentItems(prev => {
      // Remove duplicates and add new item at the beginning
      const filtered = prev.filter(item => item.id !== newItem.id);
      const updated = [newItem, ...filtered].slice(0, maxItems);

      // Save to localStorage
      localStorage.setItem('recentlyViewed', JSON.stringify(updated));

      return updated;
    });
  }, [pathname, maxItems]);

  const getTypeIcon = (type: RecentlyViewedItem['type']) => {
    switch (type) {
      case 'workorder': return '📋';
      case 'customer': return '👤';
      case 'vehicle': return '🚗';
      default: return '📄';
    }
  };

  const getTypeColor = (type: RecentlyViewedItem['type']) => {
    switch (type) {
      case 'workorder': return '#3b82f6';
      case 'customer': return '#10b981';
      case 'vehicle': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const diff = currentTimestamp - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  if (recentItems.length === 0) return null;

  if (showInSidebar) {
    return (
      <div style={{ marginTop: 16 }}>
        <div style={{
          padding: '8px 14px',
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.09em',
          color: '#64748b',
          marginBottom: 8,
        }}>
          <FaHistory style={{ marginRight: 6 }} />
          Recently Viewed
        </div>
        <div style={{ padding: '0 6px' }}>
          {recentItems.slice(0, 3).map((item) => (
            <button
              key={item.id}
              onClick={() => router.push(item.href as Route)}
              style={{
                width: '100%',
                padding: '8px 8px',
                background: 'transparent',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                textAlign: 'left',
                marginBottom: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <span style={{ fontSize: 12 }}>{getTypeIcon(item.type)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12,
                  color: '#e2e8f0',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {item.title}
                </div>
                <div style={{
                  fontSize: 10,
                  color: '#64748b',
                  marginTop: 1,
                }}>
                  {formatTimeAgo(item.timestamp)}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'rgba(8, 13, 26, 0.75)',
      backdropFilter: 'blur(22px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
      }}>
        <FaHistory style={{ color: '#64748b' }} />
        <h3 style={{
          fontSize: 14,
          fontWeight: 600,
          color: '#e2e8f0',
          margin: 0,
        }}>
          Recently Viewed
        </h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {recentItems.map((item) => (
          <button
            key={item.id}
            onClick={() => router.push(item.href as Route)}
            style={{
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 8,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <span style={{
                fontSize: 16,
                color: getTypeColor(item.type),
              }}>
                {getTypeIcon(item.type)}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#e2e8f0',
                  marginBottom: 2,
                }}>
                  {item.title}
                </div>
                <div style={{
                  fontSize: 11,
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  <FaClock style={{ fontSize: 9 }} />
                  {formatTimeAgo(item.timestamp)}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}