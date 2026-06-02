// Enhanced Navigation Component for Customer Role
// Focuses on simplicity, clear actions, and customer-centric features

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  FaHome,
  FaClipboardList,
  FaCar,
  FaHeart,
  FaComments,
  FaUser,
  FaBell,
  FaSignOutAlt,
  FaBars,
  FaTimes
} from 'react-icons/fa';

interface CustomerNavProps {
  unreadMessages?: number;
  activeOrders?: number;
}

export default function CustomerNavigation({ unreadMessages = 0, activeOrders = 0 }: CustomerNavProps) {
  const { logout, user } = useAuth();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState(0);

  useEffect(() => {
    setNotifications(unreadMessages + (activeOrders > 0 ? 1 : 0));
  }, [unreadMessages, activeOrders]);

  const navigationItems = [
    {
      name: 'Dashboard',
      href: '/customer/dashboard',
      icon: FaHome,
      description: 'Overview of your account'
    },
    {
      name: 'My Orders',
      href: '/customer/workorders',
      icon: FaClipboardList,
      badge: activeOrders > 0 ? activeOrders : undefined,
      description: 'Track your service requests'
    },
    {
      name: 'Vehicles',
      href: '/customer/vehicles',
      icon: FaCar,
      description: 'Manage your vehicles'
    },
    {
      name: 'Favorites',
      href: '/customer/favorites',
      icon: FaHeart,
      description: 'Saved shops and services'
    },
    {
      name: 'Messages',
      href: '/customer/messages',
      icon: FaComments,
      badge: unreadMessages > 0 ? unreadMessages : undefined,
      description: 'Chat with service providers'
    },
    {
      name: 'Profile',
      href: '/customer/profile',
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
            <Link href="/customer/dashboard" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">F</span>
              </div>
              <span className="text-xl font-bold text-white">FixTray</span>
            </Link>

            {/* Main Navigation */}
            <div className="flex items-center space-x-1">
              {navigationItems.slice(0, 4).map((item) => (
                <Link
                  key={item.name}
                  href={item.href as Route}
                  className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? 'bg-[rgba(229,51,42,0.15)] text-[#e5332a]'
                      : 'text-[#94a3b8] hover:text-white hover:bg-[rgba(255,255,255,0.06)]'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <item.icon className="w-4 h-4" />
                    <span>{item.name}</span>
                    {item.badge && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {item.badge > 9 ? '9+' : item.badge}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center space-x-4">
              {/* Notifications */}
              <button className="relative p-2 text-[#94a3b8] hover:text-white hover:bg-[rgba(255,255,255,0.06)] rounded-lg transition-colors">
                <FaBell className="w-5 h-5" />
                {notifications > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {notifications > 9 ? '9+' : notifications}
                  </span>
                )}
              </button>

              {/* Quick Actions */}
              <Link
                href={"/customer/appointments/new" as Route}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                New Service Request
              </Link>

              {/* User Menu */}
              <div className="relative">
                <button className="flex items-center space-x-2 p-2 rounded-lg hover:bg-[rgba(255,255,255,0.06)] transition-colors">
                  <div className="w-8 h-8 bg-[rgba(255,255,255,0.1)] rounded-full flex items-center justify-center">
                    <FaUser className="w-4 h-4 text-gray-600" />
                  </div>
                  <span className="text-sm font-medium text-[#f1f5f9]">{user?.name || 'Customer'}</span>
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
                isActive(item.href) ? 'text-red-500' : 'text-gray-600'
              }`}
            >
              <div className="relative">
                <item.icon className="w-5 h-5" />
                {item.badge && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
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
                    isActive(item.href) ? 'bg-[rgba(229,51,42,0.15)] text-[#e5332a]' : 'text-[#94a3b8] hover:bg-[rgba(255,255,255,0.06)]'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-gray-500">{item.description}</div>
                  </div>
                  {item.badge && (
                    <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1">
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