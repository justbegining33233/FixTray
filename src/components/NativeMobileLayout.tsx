'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useState, useEffect, useRef } from 'react';
import { FaBars, FaHome, FaClipboardList, FaComments, FaUser, FaCog, FaBell, FaSearch, FaPlus } from 'react-icons/fa';
import { Capacitor } from '@capacitor/core';
import { nativeMobileService } from '@/lib/nativeMobileService';
import { offlineStorageService } from '@/lib/offlineStorageService';
import { useAuth } from '@/contexts/AuthContext';
import RoleTabBar from '@/components/RoleTabBar';
import { mobileNavForActor, type ShellRole } from '@/lib/mobileRoleNav';

interface NativeMobileLayoutProps {
  children: React.ReactNode;
  userRole: ShellRole;
  userName?: string;
  unreadNotifications?: number;
  onMenuToggle?: () => void;
  onSearchToggle?: () => void;
  onNotificationToggle?: () => void;
  onAddNew?: () => void;
}

interface BottomNavItem {
  icon: React.ReactNode;
  label: string;
  path: string;
  badge?: number;
  action?: () => void;
}

export default function NativeMobileLayout({
  children,
  userRole,
  userName,
  unreadNotifications = 0,
  onMenuToggle,
  onSearchToggle,
  onNotificationToggle,
  onAddNew,
}: NativeMobileLayoutProps) {
  const say = usePhrase();
  const { user } = useAuth();
  const roleNav = mobileNavForActor(userRole, {
    role: user?.role ?? userRole,
    isSuperAdmin: user?.isSuperAdmin,
    isOwner: user?.isOwner,
  });
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState(offlineStorageService.getSyncStatus());
  const [currentPath, setCurrentPath] = useState('/');
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const lastOnlineStatus = useRef(true);

  useEffect(() => {
    // Set up network monitoring
    nativeMobileService.onNetworkChange = (status) => {
      const wasOnline = lastOnlineStatus.current;
      const isNowOnline = status.connected;

      setIsOnline(isNowOnline);
      lastOnlineStatus.current = isNowOnline;

      // Show offline banner when going offline
      if (wasOnline && !isNowOnline) {
        setShowOfflineBanner(true);
        // Auto-hide after 5 seconds
        setTimeout(() => setShowOfflineBanner(false), 5000);
      }

      // Trigger sync when coming back online
      if (!wasOnline && isNowOnline) {
        offlineStorageService.forceSync();
      }
    };

    // Update sync status periodically
    const updateSyncStatus = () => {
      setSyncStatus(offlineStorageService.getSyncStatus());
    };

    const interval = setInterval(updateSyncStatus, 5000);
    updateSyncStatus();

    // Get current path
    if (typeof window !== 'undefined') {
      setCurrentPath(window.location.pathname);
    }

    return () => clearInterval(interval);
  }, []);

  // Define bottom navigation based on user role
  const getBottomNavItems = (): BottomNavItem[] => {
    const baseItems: Record<string, BottomNavItem[]> = {
      customer: [
        {
          icon: <FaHome size={20} />,
          label: 'Home',
          path: '/customer/dashboard',
        },
        {
          icon: <FaClipboardList size={20} />,
          label: 'Orders',
          path: '/customer/workorders',
        },
        {
          icon: <FaPlus size={20} />,
          label: 'New',
          path: '/customer/new-request',
          action: onAddNew,
        },
        {
          icon: <FaComments size={20} />,
          label: 'Chat',
          path: '/customer/messages',
        },
        {
          icon: <FaUser size={20} />,
          label: 'Profile',
          path: '/customer/overview',
        },
      ],
      shop: [
        {
          icon: <FaHome size={20} />,
          label: 'Home',
          path: '/shop/home',
        },
        {
          icon: <FaClipboardList size={20} />,
          label: 'Orders',
          path: '/shop/home',
        },
        {
          icon: <FaPlus size={20} />,
          label: 'New',
          path: '/shop/new-inshop-job',
          action: onAddNew,
        },
        {
          icon: <FaComments size={20} />,
          label: 'Messages',
          path: '/shop/customer-messages',
        },
        {
          icon: <FaCog size={20} />,
          label: 'Manage',
          path: '/shop/manage-team',
        },
      ],
      tech: [
        {
          icon: <FaHome size={20} />,
          label: 'Home',
          path: '/tech/home',
        },
        {
          icon: <FaClipboardList size={20} />,
          label: 'My Jobs',
          path: '/tech/home',
        },
        {
          icon: <FaPlus size={20} />,
          label: 'Clock',
          path: '/tech/home#timeclock',
          action: onAddNew,
        },
        {
          icon: <FaComments size={20} />,
          label: 'Messages',
          path: '/tech/messages',
        },
        {
          icon: <FaUser size={20} />,
          label: 'Profile',
          path: '/tech/profile',
        },
      ],
      manager: [
        {
          icon: <FaHome size={20} />,
          label: 'Home',
          path: '/manager/home',
        },
        {
          icon: <FaClipboardList size={20} />,
          label: 'Assign',
          path: '/manager/assignments',
        },
        {
          icon: <FaPlus size={20} />,
          label: 'New',
          path: '/shop/new-inshop-job',
          action: onAddNew,
        },
        {
          icon: <FaComments size={20} />,
          label: 'Team',
          path: '/manager/team',
        },
        {
          icon: <FaCog size={20} />,
          label: 'Reports',
          path: '/manager/reports',
        },
      ],
    };

    return baseItems[userRole] || baseItems.customer;
  };

  const bottomNavItems = getBottomNavItems();

  const handleNavClick = (item: BottomNavItem) => {
    if (item.action) {
      item.action();
    } else {
      window.location.assign(item.path);
    }

    // Haptic feedback on native
    if (Capacitor.isNativePlatform()) {
      nativeMobileService.triggerHapticFeedback();
    }
  };

  const isActivePath = (path: string) => {
    return currentPath === path || currentPath.startsWith(path + '/');
  };

  return (
    <div style={{
      minHeight: '100dvh',
      height: '100dvh',
      background: 'transparent',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      width: '100%',
      maxWidth: '100vw',
    }}>
      {/* Offline Banner */}
      {showOfflineBanner && (
        <div style={{
          background: '#ef4444',
          color: 'white',
          padding: '8px 16px',
          textAlign: 'center',
          fontSize: '14px',
          fontWeight: '500',
          position: 'relative',
          zIndex: 1000,
        }}>
          {say("You're offline. Some features may be limited.")}{' '}<button
            onClick={() => setShowOfflineBanner(false)}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '16px',
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Top Navigation Bar */}
      <div style={{
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        {/* Left: Menu Button */}
        <button
          onClick={onMenuToggle}
          style={{
            background: 'none',
            border: 'none',
            color: '#e5e7eb',
            padding: '8px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <FaBars size={18} />
        </button>

        {/* Center: User/Brand */}
        <div style={{
          flex: 1,
          textAlign: 'center',
          margin: '0 12px',
        }}>
          <div style={{
            color: '#e5e7eb',
            fontSize: '16px',
            fontWeight: '600',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            <span style={{ color: 'var(--accent, #e5332a)', fontWeight: 800, fontFamily: 'var(--font)' }}>{say('FixTray')}</span>
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onSearchToggle}
            style={{
              background: 'none',
              border: 'none',
              color: '#e5e7eb',
              padding: '8px',
              borderRadius: '6px',
              position: 'relative',
            }}
          >
            <FaSearch size={18} />
          </button>

          <button
            onClick={onNotificationToggle}
            style={{
              background: 'none',
              border: 'none',
              color: '#e5e7eb',
              padding: '8px',
              borderRadius: '6px',
              position: 'relative',
            }}
          >
            <FaBell size={18} />
            {unreadNotifications > 0 && (
              <span style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                background: '#ef4444',
                color: 'white',
                borderRadius: '50%',
                width: '16px',
                height: '16px',
                fontSize: '10px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {unreadNotifications > 99 ? '99+' : unreadNotifications}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Sync Status Bar */}
      {syncStatus.pendingItems > 0 && (
        <div style={{
          background: isOnline ? 'rgba(59, 130, 246, 0.1)' : 'rgba(156, 163, 175, 0.1)',
          borderBottom: `1px solid ${isOnline ? 'rgba(59, 130, 246, 0.3)' : 'rgba(156, 163, 175, 0.3)'}`,
          padding: '6px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isOnline ? '#3b82f6' : '#9ca3af',
            animation: isOnline ? 'pulse 2s infinite' : 'none',
          }} />
          <span style={{
            color: isOnline ? '#3b82f6' : '#9ca3af',
            fontSize: '12px',
            fontWeight: '500',
          }}>
            {isOnline
              ? `Syncing ${syncStatus.pendingItems} item${syncStatus.pendingItems > 1 ? 's' : ''}...`
              : `Offline: ${syncStatus.pendingItems} item${syncStatus.pendingItems > 1 ? 's' : ''} pending`
            }
          </span>
        </div>
      )}

      {/* Main Content */}
      <div style={{
        flex: 1,
        padding: '16px',
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: '80px', // Account for bottom nav
      }}>
        {children}
      </div>

      {roleNav && <RoleTabBar nav={roleNav} />}

      {/* Add styles for animations */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}