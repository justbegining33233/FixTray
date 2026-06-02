'use client';
import { FaBook, FaSave, FaSlidersH, FaStethoscope } from 'react-icons/fa';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { useRequireAuth, useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useIsNative } from '@/context/NativeContext';
import MobileShell from '@/components/MobileShell';
import { DashboardTab } from '@/app/admin/home/components/DashboardTabClean';
import { UsersTab } from '@/app/admin/home/components/UsersTab';
import { HierarchyTab } from '@/components/admin/HierarchyTab';
import { useAdminData } from '@/hooks/useAdminData';
import Breadcrumbs from '@/components/Breadcrumbs';

export const dynamic = 'force-dynamic';

function AdminHomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading } = useRequireAuth(['admin', 'superadmin']);
  const isMobile = useIsMobile();
  const isNative = useIsNative();
  const isSuperAdmin = user?.isSuperAdmin;
  const isOwnerProfile = Boolean(user?.isOwner);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const {
    platformStats,
    allUsers,
    pendingShops,
    approvedShops,
    recentActivity,
    planDistribution,
    weeklyOverview,
    threeMonthAverages,
    liveMetrics,
    infraHealth,
    usersLiveMetrics,
    shopsLiveMetrics,
    dataLoaded: _dataLoaded
  } = useAdminData();

  const { logout } = useAuth();

  const pendingApprovalsCount = platformStats.pendingShops ?? pendingShops.length;
  const approvedShopsCount = shopsLiveMetrics?.approvedShops ?? approvedShops.length;
  const activeShopsCount = shopsLiveMetrics?.activeShops ?? 0;
  const customersCount = usersLiveMetrics?.totalCustomers ?? allUsers.length;

  const handleSignOut = () => {
    // Use shared auth logout to clear state and navigate
    logout();
  };

  const handleSectionSelect = (sectionId: string) => {
    setActiveSection(sectionId);
    setSearchOpen(false);

    // Keep URL in sync so only one active tab persists on refresh/back
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('section', sectionId);
      router.replace(`?${params.toString()}` as Route, { scroll: false });
    }
  };

  // Sync active section from query param so only one item is ever highlighted
  useEffect(() => {
    const sectionFromUrl = searchParams?.get('section');
    if (sectionFromUrl && sectionFromUrl !== activeSection) {
      setActiveSection(sectionFromUrl);
    }
  }, [searchParams, activeSection]);

  // Super admins land on this home dashboard (left menu, cards)
  useEffect(() => {
    // No redirect; this is the target dashboard
  }, [isSuperAdmin, router]);

  // Keyboard shortcut for search (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Mobile / native: show tile-grid shell immediately, before auth loading guard
  if (isNative || isMobile) {
    return <MobileShell role="admin" isHome userName={user?.name} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#000000] flex items-center justify-center">
        <div className="space-y-3 w-48">
          <div className="h-2 bg-[#27272A] rounded animate-pulse" />
          <div className="h-2 bg-[#27272A] rounded animate-pulse w-3/4" />
          <div className="h-2 bg-[#27272A] rounded animate-pulse w-1/2" />
        </div>
      </div>
    );
  }

  // While redirecting super admins, avoid rendering this dashboard to prevent flicker or hook order noise
  // Render dashboard for super admins as well

  if (!user) {
    return (
      <div className="min-h-screen bg-[#000000] flex items-center justify-center">
        <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-6 text-center">
          <div className="w-10 h-10 bg-[#27272A] rounded-md flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-[#52525B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="text-[#71717A] text-[13px]">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // Navigation organized by category for better UX
  const navigationItems = [
    // Overview & Analytics
    { id: 'dashboard', label: 'Overview', icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z', category: 'main' },
    // Customer & Users Management
    { id: 'users', label: 'Customers', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', badge: customersCount, category: 'business' },
    // Shops & Organizations
    { id: 'hierarchy', label: 'Shops', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', badge: approvedShopsCount, category: 'business' },
  ];

  const quickLinks = [
    { href: '/admin/command-center', label: <><FaSlidersH style={{marginRight:4}} /> Command Center</>, icon: 'command', highlight: true },
    { href: '/admin/messages', label: ' Messages', icon: 'messages' },
    ...(isOwnerProfile ? [{ href: '/admin/revenue', label: ' Revenue & Payouts', icon: 'money' }] : []),
    { href: '/admin/pending-shops', label: 'Pending Approvals', badge: pendingApprovalsCount, icon: 'clock' },
    { href: '/admin/accepted-shops', label: ' Accepted Shops', icon: 'shops' },
    { href: '/admin/manage-shops', label: ' Manage Shops', icon: 'shops' },
    { href: '/admin/manage-customers', label: ' Manage Customers', icon: 'users' },
    { href: '/admin/user-management', label: ' User Management', icon: 'users' },
    { href: '/admin/platform-analytics', label: ' Platform Analytics', icon: 'analytics' },
    { href: '/admin/financial-reports', label: ' Financial Reports', icon: 'finance' },
    { href: '/admin/email-templates', label: ' Email Templates', icon: 'email' },
    { href: '/admin/sessions', label: ' Active Sessions', icon: 'sessions' },
    { href: '/admin/security-settings', label: ' Security Settings', icon: 'security' },
    { href: '/admin/system-settings', label: ' System Settings', icon: 'settings' },
    { href: '/admin/backup-restore', label: <><FaSave style={{marginRight:4}} /> Backup & Restore</>, icon: 'backup' },
    { href: '/admin/guide', label: <><FaBook style={{marginRight:4}} /> Documentation</>, icon: 'book' },
    { href: '/admin/test', label: <><FaStethoscope style={{marginRight:4}} /> Health Check</>, icon: 'health' },
  ];

  const _signalItems = [
    { label: 'Pending approvals', value: pendingApprovalsCount ?? 0 },
    { label: 'Approved shops', value: approvedShopsCount ?? 0 },
    { label: 'Active shops', value: activeShopsCount ?? 0 },
    { label: 'Customers', value: customersCount ?? 0 },
  ];

  const actionButtons = [
    { label: 'Approve shops', href: '/admin/pending-shops' },
    { label: 'Manage customers', href: '/admin/manage-customers' },
    ...(isOwnerProfile ? [{ label: 'Revenue & payouts', href: '/admin/revenue' }] : []),
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return <DashboardTab platformStats={platformStats} pendingShops={pendingShops} approvedShops={approvedShops} shopsLiveMetrics={shopsLiveMetrics} recentActivity={recentActivity} planDistribution={planDistribution} weeklyOverview={weeklyOverview} threeMonthAverages={threeMonthAverages} liveMetrics={liveMetrics} infraHealth={infraHealth} />;
      case 'users':
        return <UsersTab users={allUsers} liveMetrics={usersLiveMetrics} />;
      case 'hierarchy':
        return <HierarchyTab shops={approvedShops} liveMetrics={shopsLiveMetrics} />;
      default:
        return <DashboardTab platformStats={platformStats} pendingShops={pendingShops} approvedShops={approvedShops} shopsLiveMetrics={shopsLiveMetrics} recentActivity={recentActivity} planDistribution={planDistribution} weeklyOverview={weeklyOverview} threeMonthAverages={threeMonthAverages} liveMetrics={liveMetrics} infraHealth={infraHealth} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#000000] text-slate-100">
      <div className="relative z-10">
        {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh]">
          <div className="absolute inset-0 bg-black/70" onClick={() => setSearchOpen(false)} />
          <div className="relative w-full max-w-xl mx-4 bg-[#000000] border border-[#1f2937] rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1f2937]">
              <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search or jump to a section..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-slate-50 placeholder-slate-500 outline-none text-sm"
                autoFocus
              />
              <kbd className="px-1.5 py-0.5 bg-[#000000] border border-[#1f2937] rounded text-[10px] text-slate-400 font-mono">esc</kbd>
            </div>
            <div className="p-3 max-h-80 overflow-auto space-y-1">
              <div className="px-2 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Navigate</div>
              {[
                { label: 'Overview', action: () => handleSectionSelect('dashboard'), key: 'D' },
                { label: 'Customers', action: () => handleSectionSelect('users'), key: 'U' },
                ...(isOwnerProfile ? [{ label: 'Revenue', action: () => { router.push('/admin/revenue' as Route); setSearchOpen(false); }, key: 'R' }] : []),
                { label: 'Shops', action: () => handleSectionSelect('hierarchy'), key: 'S' },
                { label: 'Pending Approvals', action: () => { router.push('/admin/pending-shops' as Route); setSearchOpen(false); }, key: 'P' },
                { label: 'Accepted Shops', action: () => { router.push('/admin/accepted-shops' as Route); setSearchOpen(false); }, key: '' },
                { label: 'Manage Shops', action: () => { router.push('/admin/manage-shops' as Route); setSearchOpen(false); }, key: '' },
                { label: 'Manage Customers', action: () => { router.push('/admin/manage-customers' as Route); setSearchOpen(false); }, key: '' },
                { label: 'User Management', action: () => { router.push('/admin/user-management' as Route); setSearchOpen(false); }, key: '' },
                { label: 'Platform Analytics', action: () => { router.push('/admin/platform-analytics' as Route); setSearchOpen(false); }, key: '' },
                { label: 'Financial Reports', action: () => { router.push('/admin/financial-reports' as Route); setSearchOpen(false); }, key: '' },
                { label: 'Email Templates', action: () => { router.push('/admin/email-templates' as Route); setSearchOpen(false); }, key: '' },
                { label: 'Active Sessions', action: () => { router.push('/admin/sessions' as Route); setSearchOpen(false); }, key: '' },
                { label: 'Security Settings', action: () => { router.push('/admin/security-settings' as Route); setSearchOpen(false); }, key: '' },
                { label: 'System Settings', action: () => { router.push('/admin/system-settings' as Route); setSearchOpen(false); }, key: '' },
                { label: 'Backup & Restore', action: () => { router.push('/admin/backup-restore' as Route); setSearchOpen(false); }, key: '' },
                { label: 'System Status', action: () => { router.push('/admin/test' as Route); setSearchOpen(false); }, key: 'T' },
              ].map((item, i) => (
                <button
                  key={i}
                  onClick={() => { item.action(); setSearchOpen(false); }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-slate-100 hover:bg-[#000000] transition-colors group"
                >
                  <span>{item.label}</span>
                  <kbd className="px-1.5 py-0.5 bg-[#0b1220] border border-[#1f2937] rounded text-[10px] text-slate-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity">{item.key}</kbd>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-5 py-8 space-y-6">
        <header className="rounded-2xl bg-[#000000] border border-[#1f2937] p-5 shadow-xl shadow-black/40">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#f97316] to-[#ea580c] text-white flex items-center justify-center font-semibold text-lg">F</div>
              <div>
                <p className="text-sm text-slate-400">Admin Console</p>
                <h1 className="text-xl font-semibold text-white">{activeSection === 'dashboard' ? 'Overview' : activeSection === 'users' ? 'Customers' : activeSection === 'hierarchy' ? 'Shops' : 'Admin'}</h1>
              </div>
            </div>
            <Breadcrumbs />

            <div className="flex flex-wrap gap-2 lg:justify-end">
              <button
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-100 text-sm transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span>Search</span>
              </button>

              <div className="relative" ref={profileMenuRef}>
                <button
                  onClick={() => setShowProfileMenu((prev) => !prev)}
                  className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 hover:bg-white/10 transition-colors"
                >
                  <div className="w-9 h-9 rounded-md bg-gradient-to-br from-[#f97316] to-[#ea580c] text-white flex items-center justify-center text-xs font-semibold">
                    {user.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'A'}
                  </div>
                  <div className="hidden sm:block leading-tight text-left">
                    <p className="text-sm text-white font-medium">{user.name || 'Admin'}</p>
                    <p className="text-xs text-slate-300 capitalize">{user.role || 'administrator'}</p>
                  </div>
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-72 rounded-xl border border-white/10 bg-[#0b1220] shadow-2xl shadow-black/40 overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-white/10">
                      <p className="text-sm text-white font-semibold">{user.name || 'Admin'}</p>
                      <p className="text-xs text-slate-400 capitalize">{user.role || 'administrator'}</p>
                    </div>

                    {isOwnerProfile && (
                      <div className="px-4 py-3 border-b border-white/10">
                        <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">FixTray Owner</p>
                        <p className="text-xs text-slate-300">Platform control center and account recovery tools.</p>
                      </div>
                    )}

                    <div className="py-2">
                      <Link
                        href={(isOwnerProfile ? '/admin/owner?section=profile' : isSuperAdmin ? '/superadmin/profile' : '/admin/profile') as Route}
                        className="block px-4 py-2 text-sm text-slate-200 hover:bg-white/10 no-underline"
                        onClick={() => setShowProfileMenu(false)}
                      >
                        My Profile
                      </Link>

                      {isOwnerProfile && (
                        <>
                          <Link
                            href={'/admin/owner?section=quick-edit' as Route}
                            className="block px-4 py-2 text-sm text-slate-200 hover:bg-white/10 no-underline"
                            onClick={() => setShowProfileMenu(false)}
                          >
                            Quick Edit User Info
                          </Link>
                          <Link
                            href={'/admin/owner?section=reset-password' as Route}
                            className="block px-4 py-2 text-sm text-slate-200 hover:bg-white/10 no-underline"
                            onClick={() => setShowProfileMenu(false)}
                          >
                            Reset User Password
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#ef4444] hover:bg-[#dc2626] text-white text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[320px,1fr]">
          {/* Left rail */}
          <section className="space-y-4">
            <div className="rounded-2xl bg-[#000000] border border-[#1f2937] p-4 shadow-lg shadow-black/30">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Status</p>
                <span className="text-[11px] text-emerald-400">Live</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
                  <div>
                    <p className="text-xs text-slate-300">Pending approvals</p>
                    <p className="text-lg font-semibold text-white">{pendingApprovalsCount ?? 0}</p>
                  </div>
                  <Link href="/admin/pending-shops" className="text-xs text-orange-300 hover:text-orange-200 no-underline">Review</Link>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
                  <div>
                    <p className="text-xs text-slate-300">Active shops</p>
                    <p className="text-lg font-semibold text-white">{approvedShopsCount ?? 0}</p>
                  </div>
                  <Link href="/admin/revenue" className="text-xs text-orange-300 hover:text-orange-200 no-underline">View</Link>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
                  <div>
                    <p className="text-xs text-slate-300">Customers</p>
                    <p className="text-lg font-semibold text-white">{customersCount ?? 0}</p>
                  </div>
                  <Link href="/admin/manage-customers" className="text-xs text-orange-300 hover:text-orange-200 no-underline">Manage</Link>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
                  <div>
                    <p className="text-xs text-slate-300">Approved shops</p>
                    <p className="text-lg font-semibold text-white">{approvedShopsCount ?? 0}</p>
                  </div>
                  <Link href="/admin/manage-shops" className="text-xs text-orange-300 hover:text-orange-200 no-underline">Open</Link>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-[#000000] border border-[#1f2937] p-4 shadow-lg shadow-black/30 space-y-2">
              <p className="text-xs uppercase tracking-wide text-slate-400">Quick actions</p>
              <div className="flex flex-wrap gap-2">
                {actionButtons.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href as Route}
                    className="rounded-full bg-gradient-to-r from-[#f97316] to-[#fb923c] text-white text-sm px-3 py-2 no-underline shadow-md shadow-[#f97316]/30 hover:brightness-110 transition"
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* Main canvas */}
          <section className="space-y-4">
            <div className="rounded-2xl bg-[#000000] border border-[#1f2937] p-5 shadow-xl shadow-black/40">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {navigationItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSectionSelect(item.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-full border text-sm transition-all ${
                      activeSection === item.id
                        ? 'bg-white text-[#000000] border-white shadow-lg'
                        : 'bg-white/5 text-slate-200 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                    </svg>
                    <span>{item.label}</span>
                    {item.badge !== undefined && (
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${activeSection === item.id ? 'bg-[#000000]/10 text-[#000000]' : 'bg-white/10 text-white'}`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="rounded-2xl border border-[#1f2937] bg-[#0b1220] p-4 md:p-6 shadow-inner shadow-black/30">
                {renderContent()}
              </div>

              {activeSection === 'dashboard' && (
                <div className="mt-5">
                  <p className="text-xs uppercase tracking-wide text-slate-400 mb-3">Quick Navigation</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {quickLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href as Route}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm no-underline transition-all hover:bg-white/10 ${
                          link.highlight
                            ? 'bg-gradient-to-r from-[#f97316]/20 to-[#fb923c]/10 border-[#f97316]/30 text-orange-300'
                            : 'bg-white/5 border-white/10 text-slate-200'
                        }`}
                      >
                        <span className="truncate">{link.label}</span>
                        {link.badge !== undefined && link.badge > 0 && (
                          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white shrink-0">{link.badge}</span>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </section>
        </div>
      </div>
      </div>
    </div>
  );
}

export default function AdminHome() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AdminHomeContent />
    </Suspense>
  );
}



