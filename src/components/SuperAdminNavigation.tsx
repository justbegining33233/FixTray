// Enhanced navigation component for the super admin role.
// Focuses on enterprise-level management and system-wide control.

'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  FaHome,
  FaUsers,
  FaShieldAlt,
  FaChartBar,
  FaServer,
  FaGlobe,
  FaBell,
  FaUser,
  FaSignOutAlt,
  FaBars,
  FaTimes,
  FaExclamationTriangle,
  FaRocket
} from 'react-icons/fa';

interface SuperAdminNavProps {
  systemAlerts?: number;
  securityIncidents?: number;
  deploymentTasks?: number;
}

export default function SuperAdminNavigation({
  systemAlerts = 0,
  securityIncidents = 0,
  deploymentTasks = 0
}: SuperAdminNavProps) {
  const { logout, user } = useAuth();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const notificationRef = useRef<HTMLDivElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const recentNotifications = [
    ...(systemAlerts > 0 ? [{ id: 'system-alerts', title: 'System Alerts', description: `${systemAlerts} infrastructure alert(s)`, href: '/superadmin/infrastructure' }] : []),
    ...(securityIncidents > 0 ? [{ id: 'security-incidents', title: 'Security Incidents', description: `${securityIncidents} security incident(s)`, href: '/superadmin/security' }] : []),
    ...(deploymentTasks > 0 ? [{ id: 'deployments', title: 'Deployment Tasks', description: `${deploymentTasks} pending deployment task(s)`, href: '/superadmin/deployments' }] : []),
  ];

  useEffect(() => {
    setNotifications(systemAlerts + securityIncidents + deploymentTasks);
  }, [systemAlerts, securityIncidents, deploymentTasks]);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const navigationItems = [
    {
      name: 'Dashboard',
      href: '/superadmin/analytics',
      icon: FaHome,
      description: 'Enterprise overview'
    },
    {
      name: 'Users',
      href: '/superadmin/users',
      icon: FaUsers,
      description: 'Global user management'
    },
    {
      name: 'Security',
      href: '/superadmin/security',
      icon: FaShieldAlt,
      badge: securityIncidents > 0 ? securityIncidents : undefined,
      description: 'Enterprise security'
    },
    {
      name: 'Infrastructure',
      href: '/superadmin/infrastructure',
      icon: FaServer,
      badge: systemAlerts > 0 ? systemAlerts : undefined,
      description: 'System infrastructure'
    },
    {
      name: 'Deployments',
      href: '/superadmin/deployments',
      icon: FaRocket,
      badge: deploymentTasks > 0 ? deploymentTasks : undefined,
      description: 'Release management'
    },
    {
      name: 'Analytics',
      href: '/superadmin/analytics',
      icon: FaChartBar,
      description: 'Enterprise metrics'
    },
    {
      name: 'Global Settings',
      href: '/superadmin/settings',
      icon: FaGlobe,
      description: 'Platform configuration'
    },
    {
      name: 'Profile',
      href: '/superadmin/profile',
      icon: FaUser,
      description: 'Account settings'
    }
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden md:flex fixed top-0 left-0 right-0 z-50 bg-[rgba(8,14,28,0.88)] backdrop-blur-md border-b border-[rgba(255,255,255,0.08)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link href={"/superadmin/analytics" as Route} className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">F</span>
              </div>
              <span className="text-xl font-bold text-white">FixTray</span>
              <span className="text-sm text-[#94a3b8]">Super Admin</span>
            </Link>

            {/* Main Navigation */}
            <div className="flex items-center space-x-1">
              {navigationItems.slice(0, 5).map((item) => (
                <Link
                  key={item.name}
                  href={item.href as Route}
                  className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? 'bg-[rgba(99,102,241,0.15)] text-indigo-400'
                      : 'text-[#94a3b8] hover:text-white hover:bg-[rgba(255,255,255,0.06)]'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <item.icon className="w-4 h-4" />
                    <span>{item.name}</span>
                    {item.badge && (
                      <span className="absolute -top-1 -right-1 bg-indigo-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {item.badge > 9 ? '9+' : item.badge}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center space-x-4">
              {/* Critical Alerts */}
              {(systemAlerts > 0 || securityIncidents > 0) && (
                <div className="flex items-center space-x-2 bg-red-50 text-red-700 px-3 py-1 rounded-full text-sm">
                  <FaExclamationTriangle className="w-4 h-4" />
                  <span>Critical Alerts</span>
                  <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {systemAlerts + securityIncidents}
                  </span>
                </div>
              )}

              {/* Notifications */}
              <div className="relative" ref={notificationRef}>
                <button
                  onClick={() => setShowNotifications((prev) => !prev)}
                  aria-haspopup="menu"
                  aria-expanded={showNotifications}
                  className="relative p-2 text-[#94a3b8] hover:text-white hover:bg-[rgba(255,255,255,0.06)] rounded-lg transition-colors"
                >
                  <FaBell className="w-5 h-5" />
                  {notifications > 0 && (
                    <span className="absolute -top-1 -right-1 bg-indigo-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {notifications > 9 ? '9+' : notifications}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 rounded-xl border border-[rgba(255,255,255,0.1)] bg-[#0f172a] shadow-2xl overflow-hidden z-[1200]">
                    <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.08)] text-sm font-semibold text-[#f1f5f9]">Recent Notifications</div>
                    <div className="max-h-80 overflow-y-auto">
                      {recentNotifications.length === 0 ? (
                        <div className="px-4 py-6 text-sm text-[#94a3b8] text-center">No new notifications</div>
                      ) : recentNotifications.map((n) => (
                        <Link
                          key={n.id}
                          href={n.href as Route}
                          onClick={() => setShowNotifications(false)}
                          className="block px-4 py-3 border-b border-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.04)]"
                        >
                          <div className="text-sm font-medium text-[#e2e8f0]">{n.title}</div>
                          <div className="text-xs text-[#94a3b8] mt-1">{n.description}</div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <Link
                href={"/superadmin/users" as Route}
                className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Manage Users
              </Link>

              {/* User Menu */}
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setShowUserMenu((prev) => !prev)}
                  aria-haspopup="menu"
                  aria-expanded={showUserMenu}
                  className="flex items-center space-x-2 p-2 rounded-lg hover:bg-[rgba(255,255,255,0.06)] transition-colors"
                >
                  <div className="w-8 h-8 bg-[rgba(255,255,255,0.1)] rounded-full flex items-center justify-center">
                    <FaUser className="w-4 h-4 text-gray-600" />
                  </div>
                  <span className="text-sm font-medium text-[#f1f5f9]">{user?.name || 'Super Admin'}</span>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl border border-[rgba(255,255,255,0.1)] bg-[#0f172a] shadow-2xl overflow-hidden z-[1200]">
                    <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.08)]">
                      <div className="text-sm font-semibold text-[#f1f5f9] truncate">{user?.name || 'Super Admin'}</div>
                      <div className="text-xs text-[#94a3b8] mt-1">superadmin</div>
                    </div>
                    <Link
                      href={'/superadmin/profile' as Route}
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2 px-4 py-3 text-sm text-[#e2e8f0] hover:bg-[rgba(255,255,255,0.04)]"
                    >
                      <FaUser className="w-4 h-4" />
                      My Profile
                    </Link>
                    <Link
                      href={'/superadmin/settings' as Route}
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2 px-4 py-3 text-sm text-[#e2e8f0] hover:bg-[rgba(255,255,255,0.04)]"
                    >
                      <FaGlobe className="w-4 h-4" />
                      Settings
                    </Link>
                    <button
                      onClick={logout}
                      className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[#f87171] hover:bg-[rgba(248,113,113,0.08)] text-left"
                    >
                      <FaSignOutAlt className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[rgba(8,14,28,0.95)] border-t border-[rgba(255,255,255,0.08)]">
        <div className="grid grid-cols-5 h-16">
          {navigationItems.slice(0, 4).map((item) => (
            <Link
              key={item.name}
              href={item.href as Route}
              className={`flex flex-col items-center justify-center space-y-1 ${
                isActive(item.href) ? 'text-indigo-500' : 'text-gray-600'
              }`}
            >
              <div className="relative">
                <item.icon className="w-5 h-5" />
                {item.badge && (
                  <span className="absolute -top-1 -right-1 bg-indigo-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    {item.badge > 9 ? '9' : item.badge}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium">{item.name.split(' ')[0]}</span>
            </Link>
          ))}

          {/* More Menu */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center space-y-1 text-[#64748b]"
          >
            <FaBars className="w-5 h-5" />
            <span className="text-xs font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black bg-opacity-50" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="absolute bottom-0 left-0 right-0 bg-[#0d1425] rounded-t-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-[#f1f5f9]">Menu</h3>
              <button onClick={() => setIsMobileMenuOpen(false)}>
                <FaTimes className="w-5 h-5 text-[#94a3b8]" />
              </button>
            </div>

            <div className="space-y-4">
              {navigationItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href as Route}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center space-x-3 p-3 rounded-lg ${
                    isActive(item.href) ? 'bg-[rgba(99,102,241,0.15)] text-indigo-400' : 'text-[#94a3b8] hover:bg-[rgba(255,255,255,0.06)]'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-gray-500">{item.description}</div>
                  </div>
                  {item.badge && (
                    <span className="bg-indigo-500 text-white text-xs rounded-full px-2 py-1">
                      {item.badge}
                    </span>
                  )}
                </Link>
              ))}

              <hr className="my-4" />

              <button
                onClick={logout}
                className="flex items-center space-x-3 p-3 rounded-lg text-[#94a3b8] hover:bg-[rgba(255,255,255,0.06)] w-full text-left"
              >
                <FaSignOutAlt className="w-5 h-5" />
                <span className="font-medium">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spacer for fixed navigation */}
      <div className="h-16 md:h-16" />
    </>
  );
}