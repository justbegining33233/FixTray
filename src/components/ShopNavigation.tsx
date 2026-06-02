// Enhanced Navigation Component for Shop Owner Role
// Focuses on business management, customer service, and shop operations

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  FaHome,
  FaStore,
  FaUsers,
  FaClipboardList,
  FaChartLine,
  FaCalendarAlt,
  FaComments,
  FaUser,
  FaBell,
  FaCog,
  FaSignOutAlt,
  FaBars,
  FaTimes,
  FaDollarSign,
  FaStar
} from 'react-icons/fa';

interface ShopNavProps {
  unreadMessages?: number;
  pendingJobs?: number;
  newReviews?: number;
  revenueAlerts?: number;
}

export default function ShopNavigation({
  unreadMessages = 0,
  pendingJobs = 0,
  newReviews = 0,
  revenueAlerts = 0
}: ShopNavProps) {
  const { logout, user } = useAuth();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState(0);

  useEffect(() => {
    setNotifications(unreadMessages + pendingJobs + newReviews + revenueAlerts);
  }, [unreadMessages, pendingJobs, newReviews, revenueAlerts]);

  const navigationItems = [
    {
      name: 'Dashboard',
      href: '/shop/home',
      icon: FaHome,
      description: 'Business overview'
    },
    {
      name: 'My Shop',
      href: '/shop/profile',
      icon: FaStore,
      description: 'Shop information'
    },
    {
      name: 'Customers',
      href: '/shop/customers',
      icon: FaUsers,
      description: 'Customer management'
    },
    {
      name: 'Jobs',
      href: '/shop/home',
      icon: FaClipboardList,
      badge: pendingJobs > 0 ? pendingJobs : undefined,
      description: 'Service requests'
    },
    {
      name: 'Revenue',
      href: '/shop/analytics',
      icon: FaDollarSign,
      badge: revenueAlerts > 0 ? revenueAlerts : undefined,
      description: 'Financial reports'
    },
    {
      name: 'Reviews',
      href: '/shop/reviews',
      icon: FaStar,
      badge: newReviews > 0 ? newReviews : undefined,
      description: 'Customer feedback'
    },
    {
      name: 'Schedule',
      href: '/shop/calendar',
      icon: FaCalendarAlt,
      description: 'Appointment booking'
    },
    {
      name: 'Messages',
      href: '/shop/customer-messages',
      icon: FaComments,
      badge: unreadMessages > 0 ? unreadMessages : undefined,
      description: 'Customer communications'
    },
    {
      name: 'Analytics',
      href: '/shop/analytics',
      icon: FaChartLine,
      description: 'Business insights'
    },
    {
      name: 'Settings',
      href: '/shop/settings',
      icon: FaCog,
      description: 'Shop configuration'
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
            <Link href={"/shop/home" as Route} className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">F</span>
              </div>
              <span className="text-xl font-bold text-white">FixTray</span>
              <span className="text-sm text-[#94a3b8]">Shop Portal</span>
            </Link>

            {/* Main Navigation */}
            <div className="flex items-center space-x-1">
              {navigationItems.slice(0, 5).map((item) => (
                <Link
                  key={item.name}
                  href={item.href as Route}
                  className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? 'bg-[rgba(34,197,94,0.15)] text-green-400'
                      : 'text-[#94a3b8] hover:text-white hover:bg-[rgba(255,255,255,0.06)]'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <item.icon className="w-4 h-4" />
                    <span>{item.name}</span>
                    {item.badge && (
                      <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {item.badge > 9 ? '9+' : item.badge}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center space-x-4">
              {/* Business Alerts */}
              {(newReviews > 0 || revenueAlerts > 0) && (
                <div className="flex items-center space-x-2 bg-yellow-50 text-yellow-700 px-3 py-1 rounded-full text-sm">
                  <FaStar className="w-4 h-4" />
                  <span>Updates</span>
                  <span className="bg-yellow-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {newReviews + revenueAlerts}
                  </span>
                </div>
              )}

              {/* Notifications */}
              <button className="relative p-2 text-[#94a3b8] hover:text-white hover:bg-[rgba(255,255,255,0.06)] rounded-lg transition-colors">
                <FaBell className="w-5 h-5" />
                {notifications > 0 && (
                  <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {notifications > 9 ? '9+' : notifications}
                  </span>
                )}
              </button>

              {/* Quick Actions */}
              <Link
                  href={"/shop/home" as Route}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                View Jobs
              </Link>

              {/* User Menu */}
              <div className="relative">
                <button className="flex items-center space-x-2 p-2 rounded-lg hover:bg-[rgba(255,255,255,0.06)] transition-colors">
                  <div className="w-8 h-8 bg-[rgba(255,255,255,0.1)] rounded-full flex items-center justify-center">
                    <FaUser className="w-4 h-4 text-gray-600" />
                  </div>
                  <span className="text-sm font-medium text-[#f1f5f9]">{user?.name || 'Shop Owner'}</span>
                </button>
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
                isActive(item.href) ? 'text-green-500' : 'text-gray-600'
              }`}
            >
              <div className="relative">
                <item.icon className="w-5 h-5" />
                {item.badge && (
                  <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
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
                    isActive(item.href) ? 'bg-[rgba(34,197,94,0.15)] text-green-400' : 'text-[#94a3b8] hover:bg-[rgba(255,255,255,0.06)]'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-gray-500">{item.description}</div>
                  </div>
                  {item.badge && (
                    <span className="bg-green-500 text-white text-xs rounded-full px-2 py-1">
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