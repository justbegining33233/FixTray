'use client';
import { FaArrowRight, FaBolt, FaClock, FaHourglassHalf, FaSave } from 'react-icons/fa';

import { useState, useEffect, ReactNode } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRequireAuth } from '@/contexts/AuthContext';

interface FeatureStatus {
  name: string;
  status: 'operational' | 'degraded' | 'down' | 'unknown';
}

interface SystemModule {
  name: string;
  icon: ReactNode;
  description: string;
  features: FeatureStatus[];
  route?: string;
}

export default function AdminTestPage() {
  const { user, isLoading } = useRequireAuth(['admin']);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [systemStatus, setSystemStatus] = useState<Record<string, 'checking' | 'operational' | 'down'>>({});
  const [stats, setStats] = useState({
    totalShops: 0,
    pendingShops: 0,
    totalUsers: 0,
    totalWorkOrders: 0,
    totalRevenue: '$0',
  });

  const checkSystemHealth = async () => {
    const endpoints = [
      { key: 'api', url: '/api/health' },
      { key: 'database', url: '/api/admin/stats' },
      { key: 'auth', url: '/api/auth/csrf' },
    ];

    for (const ep of endpoints) {
      setSystemStatus(prev => ({ ...prev, [ep.key]: 'checking' }));
      try {
        const res = await fetch(ep.url);
        setSystemStatus(prev => ({ ...prev, [ep.key]: res.ok ? 'operational' : 'down' }));
      } catch {
        setSystemStatus(prev => ({ ...prev, [ep.key]: 'down' }));
      }
    }
  };

  const fetchStats = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch('/api/admin/stats', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setStats({
          totalShops: data.totalShops || 0,
          pendingShops: data.pendingShops || 0,
          totalUsers: data.totalUsers || 0,
          totalWorkOrders: data.totalJobs || 0,
          totalRevenue: data.totalRevenue || '$0',
        });
      }
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    }
  };

  useEffect(() => {
    if (user && !isLoading) {
      checkSystemHealth();
      fetchStats();
    }
  }, [user, isLoading]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-gray-300 text-lg">Loading...</div>
      </div>
    );
  }

  // If no user, the useRequireAuth hook will handle redirect
  if (!user) {
    return null;
  }

  const systemModules: SystemModule[] = [
    {
      name: 'Shop Management',
      icon: '',
      description: 'Registration, approvals, profiles, settings, services, labor rates',
      route: '/admin/manage-shops',
      features: [
        { name: 'Shop Registration', status: 'operational' },
        { name: 'Pending Approvals', status: 'operational' },
        { name: 'Approved Shops', status: 'operational' },
        { name: 'Shop Profiles', status: 'operational' },
        { name: 'Shop Settings', status: 'operational' },
        { name: 'Service Catalog', status: 'operational' },
        { name: 'Labor Rates', status: 'operational' },
      ]
    },
    {
      name: 'Work Orders',
      icon: '',
      description: 'Create, track, photos, invoices, payments, history',
      route: '/admin/dashboard',
      features: [
        { name: 'Create Work Order', status: 'operational' },
        { name: 'Work Order Status', status: 'operational' },
        { name: 'Photo Uploads', status: 'operational' },
        { name: 'Invoice Generation', status: 'operational' },
        { name: 'Payment Processing', status: 'operational' },
        { name: 'Status History', status: 'operational' },
      ]
    },
    {
      name: 'Customer Portal',
      icon: '',
      description: 'Profiles, vehicles, payments, documents, favorites',
      features: [
        { name: 'Customer Registration', status: 'operational' },
        { name: 'Customer Profiles', status: 'operational' },
        { name: 'Vehicle Management', status: 'operational' },
        { name: 'Payment Methods', status: 'operational' },
        { name: 'Document Storage', status: 'operational' },
        { name: 'Favorite Shops', status: 'operational' },
        { name: 'Tech Tracking', status: 'operational' },
      ]
    },
    {
      name: 'Team Management',
      icon: '',
      description: 'Technicians, roles, assignments, performance',
      features: [
        { name: 'Add Technicians', status: 'operational' },
        { name: 'Role Assignment', status: 'operational' },
        { name: 'Work Assignment', status: 'operational' },
        { name: 'Manager Dashboard', status: 'operational' },
        { name: 'Team Performance', status: 'operational' },
      ]
    },
    {
      name: 'Time & Payroll',
      icon: <FaClock style={{marginRight:4}} />,
      description: 'Clock in/out, GPS, time entries, payroll, overtime',
      features: [
        { name: 'Clock In/Out', status: 'operational' },
        { name: 'GPS Verification', status: 'operational' },
        { name: 'Time Entries', status: 'operational' },
        { name: 'Payroll Reports', status: 'operational' },
        { name: 'Overtime Tracking', status: 'operational' },
      ]
    },
    {
      name: 'Inventory',
      icon: '',
      description: 'Stock list, low alerts, requests, management',
      features: [
        { name: 'Inventory List', status: 'operational' },
        { name: 'Low Stock Alerts', status: 'operational' },
        { name: 'Inventory Requests', status: 'operational' },
        { name: 'Stock Management', status: 'operational' },
        { name: 'Reorder Points', status: 'operational' },
      ]
    },
    {
      name: 'Messaging',
      icon: '',
      description: 'Shop & customer chat, real-time, push notifications',
      features: [
        { name: 'Shop Messaging', status: 'operational' },
        { name: 'Customer Chat', status: 'operational' },
        { name: 'Portal Chat', status: 'operational' },
        { name: 'Real-time Streaming', status: 'operational' },
        { name: 'Push Notifications', status: 'operational' },
      ]
    },
    {
      name: 'Notifications',
      icon: '',
      description: 'In-app, push, email, SMS alerts',
      features: [
        { name: 'In-App Notifications', status: 'operational' },
        { name: 'Push Notifications', status: 'operational' },
        { name: 'Email Notifications', status: 'operational' },
        { name: 'SMS Alerts', status: 'degraded' },
      ]
    },
    {
      name: 'Appointments',
      icon: '',
      description: 'Booking, slots, reminders, calendar',
      features: [
        { name: 'Book Appointment', status: 'operational' },
        { name: 'Manage Slots', status: 'operational' },
        { name: 'Reminders', status: 'operational' },
        { name: 'Calendar View', status: 'operational' },
      ]
    },
    {
      name: 'Reviews',
      icon: '',
      description: 'Submit, moderate, analytics',
      features: [
        { name: 'Submit Reviews', status: 'operational' },
        { name: 'Review Moderation', status: 'operational' },
        { name: 'Rating Analytics', status: 'operational' },
      ]
    },
    {
      name: 'Analytics',
      icon: '',
      description: 'Work orders, platform, financial, usage, export',
      route: '/admin/platform-analytics',
      features: [
        { name: 'Work Order Analytics', status: 'operational' },
        { name: 'Platform Analytics', status: 'operational' },
        { name: 'Financial Reports', status: 'operational' },
        { name: 'Usage Statistics', status: 'operational' },
        { name: 'Performance Metrics', status: 'operational' },
        { name: 'Data Export (CSV)', status: 'operational' },
      ]
    },
    {
      name: 'User Management',
      icon: '',
      description: 'Users list, roles, sessions, activity, audit',
      route: '/admin/user-management',
      features: [
        { name: 'All Users List', status: 'operational' },
        { name: 'Role Management', status: 'operational' },
        { name: 'Session Management', status: 'operational' },
        { name: 'Activity Logs', status: 'operational' },
        { name: 'Audit Trail', status: 'operational' },
      ]
    },
    {
      name: 'Security',
      icon: '',
      description: 'CSRF, rate limiting, JWT, audit logs',
      route: '/admin/security-settings',
      features: [
        { name: 'CSRF Protection', status: 'operational' },
        { name: 'Rate Limiting', status: 'operational' },
        { name: 'JWT Authentication', status: 'operational' },
        { name: 'Audit Logs', status: 'operational' },
        { name: 'Session Control', status: 'operational' },
      ]
    },
    {
      name: 'System',
      icon: '',
      description: 'Health check, uploads, data isolation, backup',
      route: '/admin/system-settings',
      features: [
        { name: 'Health Check', status: 'operational' },
        { name: 'File Upload', status: 'operational' },
        { name: 'Data Isolation', status: 'operational' },
        { name: 'Backup & Restore', status: 'operational' },
      ]
    },
  ];

  const totalFeatures = systemModules.reduce((acc, m) => acc + m.features.length, 0);
  const operationalFeatures = systemModules.reduce((acc, m) => 
    acc + m.features.filter(f => f.status === 'operational').length, 0);

  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', href: '/admin/home', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'status', label: 'System Status', href: '/admin/test', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', active: true },
    { id: 'guide', label: 'Feature Guide', href: '/admin/guide', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  ];

  const quickLinks = [
    { href: '/admin/pending-shops', label: 'Pending Shops', badge: stats.pendingShops },
    { href: '/admin/user-management', label: 'Users' },
  ];

  return (
    <div className="min-h-screen bg-[#000000]">
      {/* Sidebar */}
      <aside 
        className="fixed left-0 top-0 h-full bg-[#000000] border-r border-[#1F2937] transition-all duration-200 z-40"
        style={{ width: sidebarCollapsed ? '64px' : '240px' }}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className={`h-14 flex items-center border-b border-[#1F2937] ${sidebarCollapsed ? 'justify-center px-2' : 'px-4'}`}>
            {sidebarCollapsed ? (
              <div className="w-8 h-8 bg-[#e5332a] rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">F</span>
              </div>
            ) : (
              <Link href="/" className="flex items-center gap-2.5 no-underline">
                <div className="w-8 h-8 bg-[#e5332a] rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">F</span>
                </div>
                <span className="text-[#F1F5F9] font-semibold">FixTray</span>
              </Link>
            )}
          </div>

          <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
            {navigationItems.map((item) => (
              <Link
                key={item.id}
                href={item.href as Route}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group relative no-underline ${
                  item.active
                    ? 'bg-[#e5332a]/10 text-[#e5332a]'
                    : 'text-[#94A3B8] hover:bg-[#1E293B] hover:text-[#E2E8F0]'
                }`}
              >
                {item.active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#e5332a] rounded-r-full" />
                )}
                <svg className={`w-5 h-5 flex-shrink-0 ${sidebarCollapsed ? 'mx-auto' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                </svg>
                {!sidebarCollapsed && (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
              </Link>
            ))}

            {!sidebarCollapsed && (
              <>
                <div className="pt-4 pb-2 px-3">
                  <span className="text-[10px] font-semibold text-[#475569] uppercase tracking-wider">Links</span>
                </div>
                {quickLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href as Route}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-[#94A3B8] hover:bg-[#1E293B] hover:text-[#E2E8F0] transition-all duration-150 no-underline"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#475569]" />
                    <span className="text-sm">{link.label}</span>
                    {link.badge !== undefined && link.badge > 0 && (
                      <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                        {link.badge}
                      </span>
                    )}
                  </Link>
                ))}
              </>
            )}
          </nav>

          {/* Collapse Toggle */}
          <div className="p-2 border-t border-[#1F2937]">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[#64748B] hover:bg-[#1E293B] hover:text-[#94A3B8] transition-all duration-150"
            >
              <svg className={`w-4 h-4 transition-transform duration-200 ${sidebarCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
              {!sidebarCollapsed && <span className="text-xs">Collapse</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div 
        className="min-h-screen bg-[#000000] transition-all duration-200"
        style={{ marginLeft: sidebarCollapsed ? '64px' : '240px' }}
      >
        {/* Top Bar */}
        <header className="h-14 bg-[#000000] border-b border-[#1F2937] flex items-center justify-between px-6 sticky top-0 z-10">
          <div>
            <h1 className="text-lg font-semibold text-[#F1F5F9]">System Status</h1>
            <p className="text-xs text-[#64748B]">{systemModules.length} modules - {totalFeatures} features</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 text-xs font-medium">Systems Online</span>
            </div>
            <button
              onClick={checkSystemHealth}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#e5332a] hover:bg-[#2563EB] rounded-lg text-white text-xs font-medium transition-colors duration-150"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          {/* Two Column Layout */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
            
            {/* Left Column - Main Content */}
            <div className="space-y-6">
              {/* Stats Row */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {[
                  { label: 'Shops', value: stats.totalShops, color: 'text-[#8B5CF6]' },
                  { label: 'Pending', value: stats.pendingShops, color: 'text-amber-400' },
                  { label: 'Users', value: stats.totalUsers, color: 'text-[#e5332a]' },
                  { label: 'Orders', value: stats.totalWorkOrders, color: 'text-emerald-400' },
                  { label: 'Approved Shops', value: stats.totalShops, color: 'text-rose-400' },
                  { label: 'Revenue', value: stats.totalRevenue, color: 'text-emerald-400', isText: true },
                ].map((stat, i) => (
                  <div key={i} className="bg-[#000000] border border-[#1F2937] rounded-lg p-3 text-center">
                    <p className="text-[10px] font-medium text-[#64748B] uppercase tracking-wider">{stat.label}</p>
                    <p className={`text-lg font-bold ${stat.color} mt-0.5`}>
                      {stat.isText ? stat.value : stat.value.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              {/* Modules List - Clean Table Style */}
              <div className="bg-[#000000] border border-[#1F2937] rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[#1F2937] flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-[#E2E8F0]">System Modules</h2>
                    <p className="text-[11px] text-[#64748B] mt-0.5">{systemModules.length} modules - {totalFeatures} features</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-emerald-400">{operationalFeatures} active</span>
                    <span className="text-[#475569]">-</span>
                    <span className="text-[#64748B]">{totalFeatures - operationalFeatures} pending</span>
                  </div>
                </div>
                
                <div className="divide-y divide-[#1F2937]">
                  {systemModules.map((module) => {
                    const operational = module.features.filter(f => f.status === 'operational').length;
                    const isExpanded = activeSection === module.name;
                    const percentage = Math.round((operational / module.features.length) * 100);
                    
                    return (
                      <div key={module.name}>
                        <div 
                          className={`px-5 py-3 flex items-center gap-4 cursor-pointer transition-colors duration-150 ${
                            isExpanded ? 'bg-[#1E293B]/50' : 'hover:bg-[#1E293B]/30'
                          }`}
                          onClick={() => setActiveSection(isExpanded ? null : module.name)}
                        >
                          {/* Icon */}
                          <span className="text-xl w-8 text-center flex-shrink-0">{module.icon}</span>
                          
                          {/* Name & Description */}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-medium text-[#E2E8F0]">{module.name}</h3>
                            <p className="text-[11px] text-[#64748B] truncate">{module.description}</p>
                          </div>
                          
                          {/* Progress */}
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="w-16 h-1.5 bg-[#1E293B] rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                  percentage === 100 ? 'bg-emerald-500' : 'bg-[#e5332a]'
                                }`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className={`text-xs font-medium w-10 text-right ${
                              percentage === 100 ? 'text-emerald-400' : 'text-[#94A3B8]'
                            }`}>
                              {operational}/{module.features.length}
                            </span>
                          </div>
                          
                          {/* Link */}
                          {module.route && (
                            <Link 
                              href={module.route as Route}
                              onClick={(e) => e.stopPropagation()}
                              className="px-2 py-1 text-[#e5332a] hover:bg-[#e5332a]/10 text-xs font-medium rounded transition-colors duration-150 no-underline flex-shrink-0"
                            >
                              Open <FaArrowRight style={{marginRight:4}} />
                            </Link>
                          )}
                          
                          {/* Chevron */}
                          <svg 
                            className={`w-4 h-4 text-[#64748B] transition-transform duration-150 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} 
                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                        
                        {/* Expanded Content */}
                        {isExpanded && (
                          <div className="px-5 py-3 bg-[#000000]/60 border-t border-[#1F2937]">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pl-12">
                              {module.features.map((feature, idx) => (
                                <div key={idx} className="flex items-center gap-2 py-1">
                                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                    feature.status === 'operational' ? 'bg-emerald-400' :
                                    feature.status === 'degraded' ? 'bg-amber-400' : 'bg-[#475569]'
                                  }`} />
                                  <span className="text-[11px] text-[#94A3B8] truncate">{feature.name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            {/* Right Column - Sidebar */}
            <div className="space-y-6">
              {/* System Health Card */}
              <div className="bg-[#000000] border border-[#1F2937] rounded-xl p-5">
                <h3 className="text-sm font-semibold text-[#E2E8F0] mb-4">System Health</h3>
                
                {/* Overall Progress */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[#64748B]">Overall Status</span>
                    <span className="text-xs font-medium text-emerald-400">{Math.round((operationalFeatures / totalFeatures) * 100)}%</span>
                  </div>
                  <div className="h-2 bg-[#1E293B] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-[#e5332a] rounded-full transition-all duration-500"
                      style={{ width: `${(operationalFeatures / totalFeatures) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-[10px] text-[#64748B]">
                    <span>{operationalFeatures} active</span>
                    <span>{totalFeatures} total</span>
                  </div>
                </div>
                
                {/* Services */}
                <div className="space-y-2">
                  {[
                    { key: 'api', label: 'API Server', icon: <FaBolt style={{marginRight:4}} /> },
                    { key: 'database', label: 'Database', icon: <FaSave style={{marginRight:4}} /> },
                    { key: 'auth', label: 'Auth Service', icon: '' },
                  ].map((item) => (
                    <div 
                      key={item.key}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
                        systemStatus[item.key] === 'operational' 
                          ? 'bg-emerald-500/5 border-emerald-500/20' 
                          : systemStatus[item.key] === 'checking'
                          ? 'bg-[#e5332a]/5 border-[#e5332a]/20'
                          : 'bg-rose-500/5 border-rose-500/20'
                      }`}
                    >
                      <span className="text-base">{item.icon}</span>
                      <span className="text-sm text-[#E2E8F0] flex-1">{item.label}</span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        systemStatus[item.key] === 'operational' ? 'bg-emerald-500/10 text-emerald-400' :
                        systemStatus[item.key] === 'checking' ? 'bg-[#e5332a]/10 text-[#e5332a]' :
                        'bg-rose-500/10 text-rose-400'
                      }`}>
                        {systemStatus[item.key] === 'operational' ? 'Online' :
                         systemStatus[item.key] === 'checking' ? 'Checking' : 'Offline'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Quick Actions Card */}
              <div className="bg-[#000000] border border-[#1F2937] rounded-xl p-5">
                <h3 className="text-sm font-semibold text-[#E2E8F0] mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { href: '/admin/pending-shops', icon: <FaHourglassHalf style={{marginRight:4}} />, label: 'Pending', count: stats.pendingShops },
                    { href: '/admin/user-management', icon: '', label: 'Users' },
                    { href: '/admin/platform-analytics', icon: '', label: 'Analytics' },
                    { href: '/admin/activity-logs', icon: '', label: 'Logs' },
                    { href: '/admin/security-settings', icon: '', label: 'Security' },
                    { href: '/admin/system-settings', icon: '', label: 'Settings' },
                    { href: '/admin/activity-logs', icon: '', label: 'Audit' },
                  ].map((link, i) => (
                    <Link
                      key={i}
                      href={link.href as Route}
                      className="flex items-center gap-2.5 p-2.5 bg-[#1E293B]/30 hover:bg-[#1E293B] border border-[#1F2937] hover:border-[#334155] rounded-lg transition-colors duration-150 relative no-underline"
                    >
                      <span className="text-base">{link.icon}</span>
                      <span className="text-[#94A3B8] text-xs font-medium">{link.label}</span>
                      {link.count !== undefined && link.count > 0 && (
                        <span className="ml-auto w-4 h-4 bg-amber-500 text-[#000000] text-[9px] font-bold rounded-full flex items-center justify-center">
                          {link.count}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
              
              {/* API Info Card */}
              <div className="bg-[#000000] border border-[#1F2937] rounded-xl p-5">
                <h3 className="text-sm font-semibold text-[#E2E8F0] mb-3">API Coverage</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#64748B]">Endpoints</span>
                    <span className="text-sm font-medium text-[#E2E8F0]">106+</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#64748B]">Modules</span>
                    <span className="text-sm font-medium text-[#E2E8F0]">{systemModules.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#64748B]">Features</span>
                    <span className="text-sm font-medium text-[#E2E8F0]">{totalFeatures}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-[#1F2937] text-center text-[#64748B] text-xs">
            <p>FixTray Admin Dashboard -  2026</p>
          </div>
        </main>
      </div>
    </div>
  );
}


