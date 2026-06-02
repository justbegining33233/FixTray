'use client';

import { useState, useEffect, useRef, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { Route } from 'next';
import { useIsNative } from '@/context/NativeContext';
import { useIsMobile } from '@/hooks/useIsMobile';

export type ShellRole = 'shop' | 'tech' | 'customer' | 'manager' | 'admin';

interface Tile {
  ico: string;
  name: string;
  sub: string;
  href: string;
  badge?: string | number;
  color: string; // bg hex
  span2?: boolean;
}

interface FooterItem {
  ico: string;
  label: string;
  href: string;
  badge?: string | number;
}

interface DrawerSection {
  title: string;
  items: { ico: string; label: string; href: string; badge?: string | number }[];
}

interface NewOption {
  ico: string;
  title: string;
  sub: string;
  href: string;
}

interface TabGroup {
  /** Pathname prefixes that activate this tab group */
  match: string[];
  tabs: { ico: string; label: string; href: string }[];
}

interface RoleConfig {
  accentColor: string;
  roleLabel: string;
  ico: string;
  tiles: Tile[];
  footer: FooterItem[];
  newOptions: NewOption[];
  drawer: DrawerSection[];
  tabGroups: TabGroup[];
}

const ROLES: Record<ShellRole, RoleConfig> = {
  shop: {
    accentColor: '#e5332a',
    roleLabel: 'Shop Owner',
    ico: '🔧',
    tiles: [
      { ico: '🗂️', name: 'Ops Overview', sub: 'Jobs & repairs', href: '/shop/home', color: '#0f1e3a', badge: undefined, span2: true },
      { ico: '📅', name: 'Calendar', sub: 'Appointments', href: '/shop/calendar', color: '#0f2214' },
      { ico: '👥', name: 'Team', sub: 'Manage staff', href: '/shop/manage-team', color: '#1a0f2e' },
      { ico: '💬', name: 'Messages', sub: 'Customer chat', href: '/shop/customer-messages', color: '#0f0f2e' },
      { ico: '🔩', name: 'Inventory', sub: 'Parts & stock', href: '/shop/inventory', color: '#2e1a0a' },
      { ico: '📊', name: 'Reports', sub: "Today's summary", href: '/shop/analytics', color: '#0a1e2e' },
      { ico: '💳', name: 'Payroll', sub: 'Staff pay', href: '/shop/payroll', color: '#2e0f0f' },
      { ico: '⚙️', name: 'Settings', sub: 'Shop config', href: '/shop/settings', color: '#111318' },
    ],
    footer: [
      { ico: '🏠', label: 'Home', href: '/shop/home' },
      { ico: '🗂️', label: 'Jobs', href: '/shop/home' },
      { ico: '💬', label: 'Chat', href: '/shop/customer-messages' },
      { ico: '📊', label: 'Reports', href: '/shop/analytics' },
    ],
    tabGroups: [
      {
        match: ['/shop/home', '/shop/calendar', '/shop/dvi', '/shop/work-authorizations', '/shop/recurring-workorders', '/shop/new-inshop-job', '/shop/waiting-room'],
        tabs: [
          { ico: '🗂️', label: 'Jobs', href: '/shop/home' },
          { ico: '📅', label: 'Calendar', href: '/shop/calendar' },
          { ico: '🏪', label: 'Ops', href: '/shop/home' },
          { ico: '🔍', label: 'DVI', href: '/shop/dvi' },
          { ico: '📝', label: 'Auth', href: '/shop/work-authorizations' },
        ],
      },
      {
        match: ['/shop/manage-team', '/shop/timeclock', '/shop/payroll'],
        tabs: [
          { ico: '👥', label: 'Team', href: '/shop/manage-team' },
          { ico: '🕐', label: 'Time Clock', href: '/shop/timeclock' },
          { ico: '💳', label: 'Payroll', href: '/shop/payroll' },
        ],
      },
      {
        match: ['/shop/inventory', '/shop/purchase-orders', '/shop/vendors'],
        tabs: [
          { ico: '🔩', label: 'Inventory', href: '/shop/inventory' },
          { ico: '🛒', label: 'Orders', href: '/shop/purchase-orders' },
          { ico: '🏭', label: 'Vendors', href: '/shop/vendors' },
        ],
      },
      {
        match: ['/shop/analytics', '/shop/profit-margins', '/shop/customer-reports'],
        tabs: [
          { ico: '📊', label: 'Reports', href: '/shop/analytics' },
          { ico: '📈', label: 'Analytics', href: '/shop/analytics' },
          { ico: '💰', label: 'Margins', href: '/shop/profit-margins' },
          { ico: '👤', label: 'Customers', href: '/shop/customer-reports' },
        ],
      },
      {
        match: ['/shop/settings', '/shop/services', '/shop/tax-settings', '/shop/integrations'],
        tabs: [
          { ico: '⚙️', label: 'Settings', href: '/shop/settings' },
          { ico: '🔧', label: 'Services', href: '/shop/services' },
          { ico: '🔌', label: 'Integrations', href: '/shop/integrations' },
        ],
      },
    ],
    newOptions: [
      { ico: '🏪', title: 'In-Shop Job', sub: 'Customer at the shop', href: '/shop/new-inshop-job' },
      { ico: '🚐', title: 'Roadside Job', sub: 'Vehicle at another location', href: '/tech/new-roadside-job' },
    ],
    drawer: [
      {
        title: 'Operations',
        items: [
          { ico: '🗂️', label: 'Work Orders', href: '/shop/home' },
          { ico: '📅', label: 'Calendar', href: '/shop/calendar' },
          { ico: '🏪', label: 'Ops Overview / Waiting Room', href: '/shop/home' },
          { ico: '🔍', label: 'DVI Inspections', href: '/shop/dvi' },
          { ico: '📝', label: 'Work Authorizations', href: '/shop/work-authorizations' },
          { ico: '🔄', label: 'Recurring Jobs', href: '/shop/recurring-workorders' },
        ],
      },
      {
        title: 'Team & Pay',
        items: [
          { ico: '👥', label: 'Manage Team', href: '/shop/manage-team' },
          { ico: '🕐', label: 'Time Clock', href: '/shop/timeclock' },
          { ico: '💳', label: 'Payroll', href: '/shop/payroll' },
          { ico: '🗓️', label: 'Schedule', href: '/shop/calendar' },
        ],
      },
      {
        title: 'Inventory',
        items: [
          { ico: '🔩', label: 'Inventory', href: '/shop/inventory' },
          { ico: '🛒', label: 'Purchase Orders', href: '/shop/purchase-orders' },
          { ico: '🏭', label: 'Vendors', href: '/shop/vendors' },
        ],
      },
      {
        title: 'Finance',
        items: [
          { ico: '📊', label: 'Reports', href: '/shop/analytics' },
          { ico: '📈', label: 'Analytics', href: '/shop/analytics' },
          { ico: '💰', label: 'Profit Margins', href: '/shop/profit-margins' },
        ],
      },
      {
        title: 'Settings',
        items: [
          { ico: '⚙️', label: 'Settings', href: '/shop/settings' },
          { ico: '🔒', label: 'Profile', href: '/shop/settings' },
        ],
      },
    ],
  },
  tech: {
    accentColor: '#e5332a',
    roleLabel: 'Technician',
    ico: '⚙️',
    tiles: [
      { ico: '🗂️', name: 'My Jobs', sub: 'Assigned jobs', href: '/tech/dvi', color: '#0f1e3a', span2: true },
      { ico: '🔍', name: 'DVI', sub: 'Inspections', href: '/tech/dvi', color: '#0f2214' },
      { ico: '📸', name: 'Photos', sub: 'Upload pics', href: '/tech/photos', color: '#1a0f2e' },
      { ico: '💬', name: 'Messages', sub: 'Shop & customer', href: '/tech/messages', color: '#0f0f2e' },
      { ico: '🧪', name: 'Diagnostics', sub: 'DTC lookup', href: '/tech/dtc-lookup', color: '#111318' },
      { ico: '📖', name: 'Manuals', sub: 'Service specs', href: '/tech/manuals', color: '#0a1e2e' },
      { ico: '🕐', name: 'Time Clock', sub: 'Clock in / out', href: '/tech/timeclock', color: '#2e0f0f' },
      { ico: '🔧', name: 'All Tools', sub: 'Full toolkit', href: '/tech/all-tools', color: '#2e1a0a' },
    ],
    footer: [
      { ico: '🏠', label: 'Home', href: '/tech/home' },
      { ico: '🗂️', label: 'My Jobs', href: '/tech/dvi' },
      { ico: '💬', label: 'Chat', href: '/tech/messages' },
      { ico: '👤', label: 'Profile', href: '/tech/profile' },
    ],
    tabGroups: [
      {
        match: ['/tech/home', '/tech/dvi', '/tech/photos', '/tech/new-inshop-job', '/tech/new-roadside-job'],
        tabs: [
          { ico: '🗂️', label: 'My Jobs', href: '/tech/dvi' },
          { ico: '🔍', label: 'DVI', href: '/tech/dvi' },
          { ico: '📸', label: 'Photos', href: '/tech/photos' },
          { ico: '🚐', label: 'Roadside', href: '/tech/new-roadside-job' },
        ],
      },
      {
        match: ['/tech/dtc-lookup', '/tech/manuals', '/tech/all-tools', '/tech/inventory', '/tech/diagnostics'],
        tabs: [
          { ico: '🧪', label: 'DTC', href: '/tech/dtc-lookup' },
          { ico: '📖', label: 'Manuals', href: '/tech/manuals' },
          { ico: '🔧', label: 'All Tools', href: '/tech/all-tools' },
          { ico: '📦', label: 'Inventory', href: '/tech/inventory' },
        ],
      },
      {
        match: ['/tech/timeclock', '/tech/timesheet', '/tech/share-location'],
        tabs: [
          { ico: '🕐', label: 'Clock', href: '/tech/timeclock' },
          { ico: '📋', label: 'Timesheet', href: '/tech/timesheet' },
          { ico: '📍', label: 'Location', href: '/tech/share-location' },
        ],
      },
      {
        match: ['/tech/profile', '/tech/messages'],
        tabs: [
          { ico: '💬', label: 'Messages', href: '/tech/messages' },
          { ico: '👤', label: 'Profile', href: '/tech/profile' },
        ],
      },
    ],
    newOptions: [
      { ico: '🏪', title: 'In-Shop Job', sub: 'Start new in-shop repair', href: '/tech/new-inshop-job' },
      { ico: '🚐', title: 'Roadside Job', sub: 'Start roadside service call', href: '/tech/new-roadside-job' },
    ],
    drawer: [
      {
        title: 'My Work',
        items: [
          { ico: '🗂️', label: 'My Jobs', href: '/tech/dvi' },
          { ico: '🔍', label: 'DVI / Inspections', href: '/tech/dvi' },
          { ico: '📸', label: 'Job Photos', href: '/tech/photos' },
          { ico: '🚐', label: 'Roadside Jobs', href: '/tech/new-roadside-job' },
        ],
      },
      {
        title: 'Lookup',
        items: [
          { ico: '🧪', label: 'DTC Lookup', href: '/tech/dtc-lookup' },
          { ico: '📖', label: 'Service Manuals', href: '/tech/manuals' },
          { ico: '🔧', label: 'All Tools', href: '/tech/all-tools' },
          { ico: '📦', label: 'Inventory', href: '/tech/inventory' },
        ],
      },
      {
        title: 'Time',
        items: [
          { ico: '🕐', label: 'Time Clock', href: '/tech/timeclock' },
          { ico: '📋', label: 'My Timesheet', href: '/tech/timesheet' },
          { ico: '📍', label: 'Share Location', href: '/tech/share-location' },
        ],
      },
      {
        title: 'Account',
        items: [
          { ico: '👤', label: 'Profile', href: '/tech/profile' },
          { ico: '⚙️', label: 'Settings', href: '/tech/profile' },
        ],
      },
    ],
  },
  customer: {
    accentColor: '#e5332a',
    roleLabel: 'Customer',
    ico: '👤',
    tiles: [
      { ico: '🚗', name: 'My Vehicles', sub: 'Your cars', href: '/customer/vehicles', color: '#0f1e3a', span2: true },
      { ico: '🗂️', name: 'Service History', sub: 'Past jobs', href: '/customer/history', color: '#0f2214' },
      { ico: '📅', name: 'Appointments', sub: 'Scheduled visits', href: '/customer/appointments', color: '#1a0f2e' },
      { ico: '💬', name: 'Messages', sub: 'Shop chat', href: '/customer/messages', color: '#0f0f2e' },
      { ico: '💰', name: 'Estimates', sub: 'Pending approval', href: '/customer/estimates', color: '#2e1a0a' },
      { ico: '💳', name: 'Payments', sub: 'Invoices & pay', href: '/customer/payments', color: '#2e0f0f' },
      { ico: '📍', name: 'Find Shops', sub: 'Near me', href: '/customer/findshops', color: '#0a1e2e' },
      { ico: '⭐', name: 'Reviews', sub: 'Leave feedback', href: '/customer/reviews', color: '#2e2a0a' },
    ],
    footer: [
      { ico: '🏠', label: 'Home', href: '/customer/dashboard' },
      { ico: '🗂️', label: 'History', href: '/customer/history' },
      { ico: '💬', label: 'Chat', href: '/customer/messages' },
      { ico: '👤', label: 'Profile', href: '/customer/overview' },
    ],
    tabGroups: [
      {
        match: ['/customer/vehicles', '/customer/history', '/customer/tracking'],
        tabs: [
          { ico: '🚗', label: 'Vehicles', href: '/customer/vehicles' },
          { ico: '🗂️', label: 'History', href: '/customer/history' },
          { ico: '📍', label: 'Tracking', href: '/customer/tracking' },
        ],
      },
      {
        match: ['/customer/appointments', '/customer/recurring-approvals'],
        tabs: [
          { ico: '📅', label: 'Appointments', href: '/customer/appointments' },
          { ico: '🔄', label: 'Recurring', href: '/customer/recurring-approvals' },
        ],
      },
      {
        match: ['/customer/estimates', '/customer/payments', '/customer/documents'],
        tabs: [
          { ico: '💰', label: 'Estimates', href: '/customer/estimates' },
          { ico: '💳', label: 'Payments', href: '/customer/payments' },
          { ico: '📄', label: 'Docs', href: '/customer/documents' },
        ],
      },
      {
        match: ['/customer/findshops', '/customer/favorites', '/customer/reviews', '/customer/rewards'],
        tabs: [
          { ico: '📍', label: 'Find Shops', href: '/customer/findshops' },
          { ico: '❤️', label: 'Favorites', href: '/customer/favorites' },
          { ico: '⭐', label: 'Reviews', href: '/customer/reviews' },
          { ico: '🏆', label: 'Rewards', href: '/customer/rewards' },
        ],
      },
      {
        match: ['/customer/profile', '/customer/overview', '/customer/notifications'],
        tabs: [
          { ico: '👤', label: 'Profile', href: '/customer/profile' },
          { ico: '🔔', label: 'Notifications', href: '/customer/notifications' },
        ],
      },
    ],
    newOptions: [
      { ico: '📅', title: 'Book Appointment', sub: 'Schedule at a shop near you', href: '/customer/appointments' },
      { ico: '🔔', title: 'Request Service', sub: 'Send a service request', href: '/customer/findshops' },
    ],
    drawer: [
      {
        title: 'My Cars',
        items: [
          { ico: '🚗', label: 'My Vehicles', href: '/customer/vehicles' },
          { ico: '🗂️', label: 'Service History', href: '/customer/history' },
          { ico: '📋', label: 'Active Work Orders', href: '/customer/history' },
        ],
      },
      {
        title: 'Appointments',
        items: [
          { ico: '📅', label: 'Appointments', href: '/customer/appointments' },
          { ico: '🔄', label: 'Recurring Approvals', href: '/customer/recurring-approvals' },
        ],
      },
      {
        title: 'Finances',
        items: [
          { ico: '💰', label: 'Estimates', href: '/customer/estimates' },
          { ico: '💳', label: 'Payments', href: '/customer/payments' },
          { ico: '📄', label: 'Documents', href: '/customer/documents' },
        ],
      },
      {
        title: 'Discover',
        items: [
          { ico: '📍', label: 'Find Shops', href: '/customer/findshops' },
          { ico: '❤️', label: 'Favorites', href: '/customer/favorites' },
          { ico: '🏆', label: 'Rewards', href: '/customer/rewards' },
          { ico: '⭐', label: 'Reviews', href: '/customer/reviews' },
        ],
      },
      {
        title: 'Account',
        items: [
          { ico: '👤', label: 'Profile', href: '/customer/profile' },
          { ico: '🔔', label: 'Notifications', href: '/customer/notifications' },
        ],
      },
    ],
  },
  manager: {
    accentColor: '#e5332a',
    roleLabel: 'Manager',
    ico: '📊',
    tiles: [
      { ico: '📋', name: 'Assignments', sub: 'Assign jobs', href: '/manager/assignments', color: '#0f1e3a', span2: true },
      { ico: '✅', name: 'Approvals', sub: 'Pending review', href: '/manager/approvals', color: '#0f2214' },
      { ico: '👥', name: 'Team', sub: 'Staff overview', href: '/manager/team', color: '#1a0f2e' },
      { ico: '💬', name: 'Messages', sub: 'Team & customers', href: '/manager/messages', color: '#0f0f2e' },
      { ico: '📊', name: 'Reports', sub: 'KPIs & metrics', href: '/manager/reports', color: '#0a1e2e' },
      { ico: '🗓️', name: 'Schedule', sub: "Today's shifts", href: '/manager/schedule', color: '#2e1a0a' },
      { ico: '💳', name: 'Payroll', sub: 'Review timesheets', href: '/manager/payroll', color: '#2e0f0f' },
      { ico: '⚙️', name: 'Settings', sub: 'Permissions', href: '/manager/settings', color: '#111318' },
    ],
    footer: [
      { ico: '🏠', label: 'Home', href: '/manager/home' },
      { ico: '📋', label: 'Assign', href: '/manager/assignments' },
      { ico: '💬', label: 'Chat', href: '/manager/messages' },
      { ico: '📊', label: 'Reports', href: '/manager/reports' },
    ],
    tabGroups: [
      {
        match: ['/manager/assignments', '/manager/approvals', '/manager/work-authorizations', '/manager/recurring-workorders', '/manager/inspections'],
        tabs: [
          { ico: '📋', label: 'Assignments', href: '/manager/assignments' },
          { ico: '✅', label: 'Approvals', href: '/manager/approvals' },
          { ico: '📝', label: 'Auth', href: '/manager/work-authorizations' },
          { ico: '🔍', label: 'Inspections', href: '/manager/inspections' },
          { ico: '🔄', label: 'Recurring', href: '/manager/recurring-workorders' },
        ],
      },
      {
        match: ['/manager/team', '/manager/schedule', '/manager/timeclock', '/manager/payroll'],
        tabs: [
          { ico: '👥', label: 'Team', href: '/manager/team' },
          { ico: '🗓️', label: 'Schedule', href: '/manager/schedule' },
          { ico: '🕐', label: 'Time Clock', href: '/manager/timeclock' },
          { ico: '💳', label: 'Payroll', href: '/manager/payroll' },
        ],
      },
      {
        match: ['/manager/reports', '/manager/templates', '/manager/inventory', '/manager/estimates'],
        tabs: [
          { ico: '📊', label: 'Reports', href: '/manager/reports' },
          { ico: '📋', label: 'Templates', href: '/manager/templates' },
          { ico: '📦', label: 'Inventory', href: '/manager/inventory' },
          { ico: '💰', label: 'Estimates', href: '/manager/estimates' },
        ],
      },
      {
        match: ['/manager/settings', '/manager/profile', '/manager/messages'],
        tabs: [
          { ico: '💬', label: 'Messages', href: '/manager/messages' },
          { ico: '⚙️', label: 'Settings', href: '/manager/settings' },
          { ico: '👤', label: 'Profile', href: '/manager/profile' },
        ],
      },
    ],
    newOptions: [
      { ico: '🏪', title: 'In-Shop Job', sub: 'Create new in-shop work order', href: '/shop/new-inshop-job' },
      { ico: '🚐', title: 'Roadside Job', sub: 'Dispatch a roadside job', href: '/tech/new-roadside-job' },
    ],
    drawer: [
      {
        title: 'Operations',
        items: [
          { ico: '📋', label: 'Assignments', href: '/manager/assignments' },
          { ico: '✅', label: 'Approvals', href: '/manager/approvals' },
          { ico: '📝', label: 'Work Authorizations', href: '/manager/work-authorizations' },
          { ico: '🔄', label: 'Recurring Jobs', href: '/manager/recurring-workorders' },
          { ico: '🔍', label: 'Inspections', href: '/manager/inspections' },
        ],
      },
      {
        title: 'Team',
        items: [
          { ico: '👥', label: 'Team', href: '/manager/team' },
          { ico: '🗓️', label: 'Schedule', href: '/manager/schedule' },
          { ico: '🕐', label: 'Time Clock', href: '/manager/timeclock' },
          { ico: '💳', label: 'Payroll', href: '/manager/payroll' },
        ],
      },
      {
        title: 'Reports',
        items: [
          { ico: '📊', label: 'Reports', href: '/manager/reports' },
          { ico: '📋', label: 'Templates', href: '/manager/templates' },
          { ico: '📦', label: 'Inventory', href: '/manager/inventory' },
        ],
      },
      {
        title: 'Settings',
        items: [
          { ico: '⚙️', label: 'Settings', href: '/manager/settings' },
          { ico: '👤', label: 'Profile', href: '/manager/profile' },
        ],
      },
    ],
  },
  admin: {
    accentColor: '#e5332a',
    roleLabel: 'Super Admin',
    ico: '🛡️',
    tiles: [
      { ico: '🏪', name: 'Manage Shops', sub: 'All shops', href: '/admin/manage-shops', color: '#0f1e3a', span2: true },
      { ico: '⏳', name: 'Pending Shops', sub: 'Awaiting review', href: '/admin/pending-shops', color: '#2e1a0a' },
      { ico: '👥', name: 'Users', sub: 'All accounts', href: '/superadmin/users', color: '#0f2214' },
      { ico: '💰', name: 'Revenue', sub: 'Platform MRR', href: '/admin/revenue', color: '#0a1e2e' },
      { ico: '📊', name: 'Analytics', sub: 'Platform-wide', href: '/superadmin/analytics', color: '#1a0f2e' },
      { ico: '🔐', name: 'Security', sub: 'Logs & threats', href: '/superadmin/security', color: '#0f0f2e' },
      { ico: '📧', name: 'Email Templates', sub: 'System emails', href: '/admin/email-templates', color: '#2e0f0f' },
      { ico: '⚙️', name: 'System', sub: 'All settings', href: '/admin/settings', color: '#111318' },
    ],
    footer: [
      { ico: '🏠', label: 'Home', href: '/admin/home' },
      { ico: '🏪', label: 'Shops', href: '/admin/manage-shops' },
      { ico: '💬', label: 'Chat', href: '/admin/messages' },
      { ico: '⚙️', label: 'System', href: '/admin/settings' },
    ],
    newOptions: [
      { ico: '🏪', title: 'Add Shop', sub: 'Manually register a new shop', href: '/admin/manage-shops' },
      { ico: '👤', title: 'Add User', sub: 'Create new admin or user', href: '/superadmin/users' },
    ],
    drawer: [
      {
        title: 'Shops',
        items: [
          { ico: '🏪', label: 'Manage Shops', href: '/admin/manage-shops' },
          { ico: '⏳', label: 'Pending Shops', href: '/admin/pending-shops' },
        ],
      },
      {
        title: 'Users',
        items: [
          { ico: '👥', label: 'User Management', href: '/superadmin/users' },
          { ico: '👤', label: 'Customers', href: '/admin/manage-customers' },
        ],
      },
      {
        title: 'Finance',
        items: [
          { ico: '💰', label: 'Revenue', href: '/admin/revenue' },
          { ico: '📊', label: 'Analytics', href: '/superadmin/analytics' },
        ],
      },
      {
        title: 'Platform',
        items: [
          { ico: '🔐', label: 'Security', href: '/superadmin/security' },
          { ico: '📋', label: 'Activity Logs', href: '/admin/activity-logs' },
          { ico: '📧', label: 'Email Templates', href: '/admin/email-templates' },
          { ico: '⚙️', label: 'System Settings', href: '/admin/settings' },
        ],
      },
    ],
    tabGroups: [
      {
        match: ['/admin/manage-shops', '/admin/pending-shops', '/admin/accepted-shops'],
        tabs: [
          { ico: '🏪', label: 'Shops', href: '/admin/manage-shops' },
          { ico: '⏳', label: 'Pending', href: '/admin/pending-shops' },
          { ico: '✅', label: 'Accepted', href: '/admin/accepted-shops' },
        ],
      },
      {
        match: ['/superadmin/users', '/admin/manage-customers', '/admin/user-management'],
        tabs: [
          { ico: '👥', label: 'Users', href: '/superadmin/users' },
          { ico: '👤', label: 'Customers', href: '/admin/manage-customers' },
          { ico: '🔑', label: 'User Mgmt', href: '/admin/user-management' },
        ],
      },
      {
        match: ['/admin/revenue', '/superadmin/analytics', '/admin/financial-reports', '/admin/platform-analytics'],
        tabs: [
          { ico: '💰', label: 'Revenue', href: '/admin/revenue' },
          { ico: '📊', label: 'Analytics', href: '/superadmin/analytics' },
          { ico: '📈', label: 'Platform', href: '/admin/platform-analytics' },
          { ico: '📑', label: 'Reports', href: '/admin/financial-reports' },
        ],
      },
      {
        match: ['/superadmin/security', '/admin/activity-logs', '/admin/email-templates', '/admin/settings', '/admin/system-settings'],
        tabs: [
          { ico: '🔐', label: 'Security', href: '/superadmin/security' },
          { ico: '📋', label: 'Logs', href: '/admin/activity-logs' },
          { ico: '📧', label: 'Email', href: '/admin/email-templates' },
          { ico: '⚙️', label: 'Settings', href: '/admin/settings' },
        ],
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Shell props
// ---------------------------------------------------------------------------
interface MobileShellProps {
  role: ShellRole;
  userName?: string;
  /** Show the home tile-grid instead of children */
  isHome?: boolean;
  /** Title shown in header when not on home */
  sectionTitle?: string;
  /** Page content (shown in section views, ignored when isHome=true) */
  children?: ReactNode;
  unreadMessages?: number;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function MobileShell({
  role,
  userName,
  isHome = false,
  sectionTitle,
  children,
  unreadMessages = 0,
}: MobileShellProps) {
  const isNative = useIsNative();
  const isMobile = useIsMobile();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [newMenuMounted, setNewMenuMounted] = useState(false);
  const [tabsCollapsed, setTabsCollapsed] = useState(true);
  const drawerCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newMenuCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawerTouchStartXRef = useRef<number | null>(null);
  const newMenuTouchStartYRef = useRef<number | null>(null);

  const homePathByRole: Record<ShellRole, string> = {
    shop: '/shop/admin',
    tech: '/tech/home',
    customer: '/customer/dashboard',
    manager: '/manager/home',
    admin: '/admin/home',
  };

  // Close overlays on route change
  useEffect(() => {
    setDrawerOpen(false);
    setNewMenuOpen(false);
    if (drawerCloseTimerRef.current) clearTimeout(drawerCloseTimerRef.current);
    if (newMenuCloseTimerRef.current) clearTimeout(newMenuCloseTimerRef.current);
    drawerCloseTimerRef.current = setTimeout(() => setDrawerMounted(false), 180);
    newMenuCloseTimerRef.current = setTimeout(() => setNewMenuMounted(false), 180);
    setTabsCollapsed(true);
  }, [pathname]);

  useEffect(() => {
    return () => {
      if (drawerCloseTimerRef.current) clearTimeout(drawerCloseTimerRef.current);
      if (newMenuCloseTimerRef.current) clearTimeout(newMenuCloseTimerRef.current);
    };
  }, []);

  // Keep a single scroll container on handheld to avoid dual-scroll jitter.
  useEffect(() => {
    if (!isNative && !isMobile) return;
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    const body = document.body;

    const prevHtmlOverflow = html.style.overflow;
    const prevHtmlHeight = html.style.height;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyHeight = body.style.height;
    const prevBodyOverscroll = body.style.overscrollBehavior;

    html.style.overflow = 'hidden';
    html.style.height = '100%';
    body.style.overflow = 'hidden';
    body.style.height = '100%';
    body.style.overscrollBehavior = 'none';

    return () => {
      html.style.overflow = prevHtmlOverflow;
      html.style.height = prevHtmlHeight;
      body.style.overflow = prevBodyOverflow;
      body.style.height = prevBodyHeight;
      body.style.overscrollBehavior = prevBodyOverscroll;
    };
  }, [isNative, isMobile]);

  // Render shell in native app (server-detected) or mobile browser (client-detected).
  if (!isNative && !isMobile) return <>{children}</>;

  const cfg = ROLES[role];
  const accent = cfg.accentColor;

  const isActivePath = (href: string) =>
    href === pathname || (href !== '/' && (pathname ?? '').startsWith(href + '/'));

  const go = (href: string) => router.push(href as Route);

  const signOut = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('userRole');
      localStorage.removeItem('userName');
      localStorage.removeItem('shopId');
      localStorage.removeItem('userId');
      window.location.href = '/auth/login';
    }
  };

  const openDrawer = () => {
    if (drawerCloseTimerRef.current) clearTimeout(drawerCloseTimerRef.current);
    setDrawerMounted(true);
    requestAnimationFrame(() => setDrawerOpen(true));
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    if (drawerCloseTimerRef.current) clearTimeout(drawerCloseTimerRef.current);
    drawerCloseTimerRef.current = setTimeout(() => setDrawerMounted(false), 180);
  };

  const openNewMenu = () => {
    if (newMenuCloseTimerRef.current) clearTimeout(newMenuCloseTimerRef.current);
    setNewMenuMounted(true);
    requestAnimationFrame(() => setNewMenuOpen(true));
  };

  const closeNewMenu = () => {
    setNewMenuOpen(false);
    if (newMenuCloseTimerRef.current) clearTimeout(newMenuCloseTimerRef.current);
    newMenuCloseTimerRef.current = setTimeout(() => setNewMenuMounted(false), 180);
  };

  const toggleNewMenu = () => {
    if (newMenuOpen) {
      closeNewMenu();
      return;
    }
    openNewMenu();
  };

  const handleHeaderBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    go(homePathByRole[role]);
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div style={{
      position: 'relative',
      minHeight: '100dvh',
      width: '100%',
      background: 'linear-gradient(160deg,#060709 0%,#0b0d14 100%)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif',
      zIndex: 0,
      color: '#e2e8f0',
    }}>

      {/* ─── APP HEADER ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'calc(env(safe-area-inset-top, 0px) + 6px) 14px 8px',
        background: 'rgba(6,7,9,0.95)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        flexShrink: 0,
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Wrench (drawer) on home; back arrow on sections */}
          <button
            onClick={() => isHome ? openDrawer() : handleHeaderBack()}
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 17, cursor: 'pointer', color: '#fff',
              flexShrink: 0,
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {isHome ? '🔧' : '←'}
          </button>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.2 }}>
              {isHome ? 'FixTray' : (sectionTitle || 'FixTray')}
            </div>
            {isHome && (
              <div style={{ fontSize: 9, color: '#718096', marginTop: 1 }}>{cfg.roleLabel}</div>
            )}
          </div>
        </div>

        {/* Avatar */}
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: accent + '22',
          border: `1.5px solid ${accent}55`,
          color: accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, fontWeight: 800,
        }}>
          {cfg.ico}
        </div>
      </div>

      {/* ─── COLLAPSIBLE SECTION TAB BAR (sub-pages only) ──────── */}
      {!isHome && (() => {
        const activeGroup = cfg.tabGroups.find(g =>
          g.match.some(m => (pathname ?? '').startsWith(m))
        );
        if (!activeGroup) return null;
        const activeTab = activeGroup.tabs.find(t =>
          (pathname ?? '') === t.href ||
          ((pathname ?? '').startsWith(t.href + '/') && t.href !== '/')
        ) ?? activeGroup.tabs[0];
        return (
          <div style={{
            background: 'rgba(6,7,9,0.95)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
          }}>
            {/* Collapsed bar — always visible */}
            <button
              onClick={() => setTabsCollapsed(c => !c)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '8px 14px',
                background: 'transparent', border: 'none', cursor: 'pointer',
                borderLeft: `3px solid ${accent}`,
                textAlign: 'left',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span style={{ fontSize: 14 }}>{activeTab.ico}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', flex: 1 }}>
                {activeTab.label}
              </span>
              <span style={{ fontSize: 10, color: '#718096', marginRight: 4 }}>Switch View</span>
              <span style={{
                fontSize: 11, color: accent,
                transform: tabsCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
                transition: 'transform 0.2s',
                display: 'inline-block',
              }}>▲</span>
            </button>

            {/* Expanded tab pills */}
            {!tabsCollapsed && (
              <div style={{
                display: 'flex', overflowX: 'auto', overflowY: 'hidden',
                gap: 6, padding: '6px 10px 8px',
                scrollbarWidth: 'none',
              }}>
                {activeGroup.tabs.map(tab => {
                  const active = (pathname ?? '') === tab.href ||
                    ((pathname ?? '').startsWith(tab.href + '/') && tab.href !== '/');
                  return (
                    <button
                      key={tab.href}
                      onClick={() => { go(tab.href); setTabsCollapsed(true); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 14px', borderRadius: 20, flexShrink: 0,
                        border: active
                          ? `1.5px solid ${accent}88`
                          : '1px solid rgba(255,255,255,0.08)',
                        background: active
                          ? accent + '22'
                          : 'rgba(255,255,255,0.04)',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                        touchAction: 'manipulation',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      <span style={{ fontSize: 14 }}>{tab.ico}</span>
                      <span style={{
                        fontSize: 12, fontWeight: active ? 700 : 500,
                        color: active ? accent : '#9ca3af',
                        whiteSpace: 'nowrap',
                      }}>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ─── CONTENT AREA ────────────────────────────────────────── */}
      <div data-mobile-shell-body style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        overscrollBehaviorY: 'contain',
        paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
      }}>
        {isHome ? <TileGrid cfg={cfg} accent={accent} onTile={go} /> : children}
      </div>

      {/* ─── FOOTER NAV ──────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(6,7,9,0.97)',
        backdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '6px 4px calc(10px + env(safe-area-inset-bottom, 0px))',
        display: 'flex', alignItems: 'flex-end',
        zIndex: 40,
      }}>
        {/* Item 1 */}
        <FooterBtn item={cfg.footer[0]} isActive={isActivePath(cfg.footer[0].href)} onClick={() => go(cfg.footer[0].href)} />
        {/* Item 2 */}
        <FooterBtn
          item={{ ...cfg.footer[1], badge: cfg.footer[1].label === 'Chat' ? (unreadMessages || undefined) : cfg.footer[1].badge }}
          isActive={isActivePath(cfg.footer[1].href)}
          onClick={() => go(cfg.footer[1].href)}
        />
        {/* CENTER FAB */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
          <button
            onClick={toggleNewMenu}
            style={{
              width: 54, height: 54, borderRadius: '50%',
              background: accent,
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, color: '#fff',
              marginTop: -22,
              boxShadow: `0 4px 20px ${accent}88`,
              transition: 'transform 0.2s, box-shadow 0.2s',
              transform: newMenuOpen ? 'rotate(45deg)' : 'rotate(0deg)',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
            }}
          >＋</button>
          <span style={{ fontSize: 9, fontWeight: 600, color: '#4a5568', marginTop: 3 }}>New</span>

          {/* New submenu */}
          {newMenuMounted && (
            <div style={{
              position: 'absolute', bottom: '110%', left: '50%',
              transform: 'translateX(-50%)',
              background: '#13161f',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 18, padding: 12, width: 210,
              boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
              zIndex: 100,
              opacity: newMenuOpen ? 1 : 0,
              marginBottom: newMenuOpen ? 0 : -8,
              transition: 'opacity 0.18s ease, margin-bottom 0.18s ease',
              pointerEvents: newMenuOpen ? 'auto' : 'none',
            }}
            onTouchStart={(e) => {
              newMenuTouchStartYRef.current = e.touches[0]?.clientY ?? null;
            }}
            onTouchEnd={(e) => {
              const startY = newMenuTouchStartYRef.current;
              const endY = e.changedTouches[0]?.clientY ?? startY;
              if (startY != null && endY != null && endY - startY > 36) {
                closeNewMenu();
              }
              newMenuTouchStartYRef.current = null;
            }}>
              <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4a5568', textAlign: 'center', marginBottom: 10 }}>
                Create New
              </div>
              {cfg.newOptions.map((opt) => (
                <button
                  key={opt.href}
                  onClick={() => { setNewMenuOpen(false); go(opt.href); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 12, padding: '12px 14px',
                    marginBottom: 7, width: '100%', cursor: 'pointer',
                    color: '#e2e8f0', textAlign: 'left',
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  <span style={{ fontSize: 22 }}>{opt.ico}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{opt.title}</div>
                    <div style={{ fontSize: 10, color: '#718096', marginTop: 1 }}>{opt.sub}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Item 3 */}
        <FooterBtn
          item={{ ...cfg.footer[2], badge: cfg.footer[2].label === 'Chat' ? (unreadMessages || undefined) : cfg.footer[2].badge }}
          isActive={isActivePath(cfg.footer[2].href)}
          onClick={() => go(cfg.footer[2].href)}
        />
        {/* Item 4 */}
        <FooterBtn item={cfg.footer[3]} isActive={isActivePath(cfg.footer[3].href)} onClick={() => go(cfg.footer[3].href)} />
      </div>

      {/* ─── DIM overlay (new menu) ───────────────────────────────── */}
      {newMenuMounted && (
        <div
          onClick={closeNewMenu}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            zIndex: 39,
            opacity: newMenuOpen ? 1 : 0,
            transition: 'opacity 0.18s ease',
            pointerEvents: newMenuOpen ? 'auto' : 'none',
          }}
        />
      )}

      {/* ─── DRAWER ──────────────────────────────────────────────── */}
      {drawerMounted && (
        <div
          onClick={closeDrawer}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 150,
            opacity: drawerOpen ? 1 : 0,
            transition: 'opacity 0.18s ease',
            pointerEvents: drawerOpen ? 'auto' : 'none',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute', top: 0, left: 0, bottom: 0,
              width: 260,
              background: '#0d0f16',
              borderRight: '1px solid rgba(255,255,255,0.07)',
              display: 'flex', flexDirection: 'column',
              overflowY: 'auto',
              transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
              transition: 'transform 0.2s ease',
            }}
            onTouchStart={(e) => {
              drawerTouchStartXRef.current = e.touches[0]?.clientX ?? null;
            }}
            onTouchEnd={(e) => {
              const startX = drawerTouchStartXRef.current;
              const endX = e.changedTouches[0]?.clientX ?? startX;
              if (startX != null && endX != null && startX - endX > 48) {
                closeDrawer();
              }
              drawerTouchStartXRef.current = null;
            }}
          >
            {/* Drawer head */}
            <div style={{ padding: '44px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: accent + '22', border: `1.5px solid ${accent}55`, color: accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, marginBottom: 8,
              }}>{cfg.ico}</div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{userName || cfg.roleLabel}</div>
              <div style={{ fontSize: 10, color: '#718096', marginTop: 2 }}>{cfg.roleLabel}</div>
            </div>

            {/* Drawer sections */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
              {cfg.drawer.map((sec) => (
                <div key={sec.title}>
                  <div style={{
                    fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
                    letterSpacing: '0.09em', color: '#4a5568',
                    padding: '10px 16px 4px',
                  }}>{sec.title}</div>
                  {sec.items.map((item) => (
                    <button
                      key={item.href + item.label}
                      onClick={() => { closeDrawer(); go(item.href); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 12px', cursor: 'pointer',
                        fontSize: 12, fontWeight: 500, color: '#e2e8f0',
                        background: isActivePath(item.href) ? 'rgba(255,255,255,0.07)' : 'transparent',
                        border: 'none', textAlign: 'left',
                        borderRadius: 8, margin: '1px 6px', boxSizing: 'border-box',
                        width: 'calc(100% - 12px)',
                        touchAction: 'manipulation',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      <span style={{ fontSize: 14, width: 20, textAlign: 'center', flexShrink: 0 }}>{item.ico}</span>
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {item.badge != null && (
                        <span style={{
                          background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 800,
                          borderRadius: 8, padding: '1px 5px',
                        }}>{item.badge}</span>
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>

            {/* Sign out */}
            <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <button
                onClick={signOut}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: 12, color: '#f87171', cursor: 'pointer',
                  background: 'transparent', border: 'none', padding: '8px 6px',
                  borderRadius: 8, width: '100%', textAlign: 'left',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >🚪 Sign Out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TileGrid
// ---------------------------------------------------------------------------
function TileGrid({ cfg, onTile }: { cfg: RoleConfig; accent?: string; onTile: (href: string) => void }) {
  return (
    <div style={{ padding: '10px 12px 0' }}>
      <div style={{
        fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
        letterSpacing: '0.1em', color: '#4a5568', marginBottom: 8,
      }}>Quick Access</div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
      }}>
        {cfg.tiles.map((tile) => (
          <button
            key={tile.href}
            onClick={() => onTile(tile.href)}
            style={{
              gridColumn: tile.span2 ? 'span 2' : undefined,
              background: tile.color,
              border: '1px solid rgba(255,255,255,0.04)',
              borderRadius: 16,
              padding: tile.span2 ? '14px 16px' : '14px 12px 12px',
              minHeight: tile.span2 ? 72 : 94,
              display: 'flex',
              flexDirection: tile.span2 ? 'row' : 'column',
              alignItems: tile.span2 ? 'center' : 'flex-start',
              gap: tile.span2 ? 14 : 0,
              justifyContent: tile.span2 ? undefined : 'space-between',
              cursor: 'pointer',
              position: 'relative',
              textAlign: 'left',
              transition: 'filter 0.15s, transform 0.15s',
              color: '#fff',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {tile.badge != null && (
              <div style={{
                position: 'absolute', top: 8, right: 8,
                background: '#ef4444', color: '#fff',
                borderRadius: 10, fontSize: 9, fontWeight: 800,
                padding: '1px 6px', minWidth: 16, textAlign: 'center',
                border: '1.5px solid rgba(0,0,0,0.3)',
              }}>{tile.badge}</div>
            )}
            <div style={{ fontSize: tile.span2 ? 22 : 24, marginBottom: tile.span2 ? 0 : 8 }}>{tile.ico}</div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#fff', lineHeight: 1.3 }}>{tile.name}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{tile.sub}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FooterBtn
// ---------------------------------------------------------------------------
function FooterBtn({
  item, isActive, onClick,
}: {
  item: FooterItem;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        fontSize: 9, fontWeight: 600,
        color: isActive ? '#fff' : '#4a5568',
        cursor: 'pointer', padding: '4px 2px',
        background: 'transparent', border: 'none',
        position: 'relative',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {isActive && (
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: 4, height: 4, borderRadius: '50%',
          background: 'currentColor',
        }} />
      )}
      <span style={{ fontSize: 21, transform: isActive ? 'scale(1.1)' : 'none' }}>{item.ico}</span>
      <span>{item.label}</span>
      {item.badge != null && Number(item.badge) > 0 && (
        <div style={{
          position: 'absolute', top: 1, right: 'calc(50% - 18px)',
          background: '#ef4444', color: '#fff',
          width: 14, height: 14, borderRadius: '50%',
          fontSize: 7, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1.5px solid #060709',
        }}>{item.badge}</div>
      )}
    </button>
  );
}
