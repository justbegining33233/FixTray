/**
 * Phone tab bars for every FixTray role.
 * Primary tabs match the approved mobile draft. More lists every other
 * static page for that role so nothing on the website is unreachable.
 * Super Admin tabs are returned only for a superadmin actor.
 */

import { normalizeRole } from '@/lib/roleNav';

export type MobileIconName =
  | 'home'
  | 'orders'
  | 'messages'
  | 'team'
  | 'calendar'
  | 'wrench'
  | 'clock'
  | 'settings'
  | 'inventory'
  | 'dollar'
  | 'chart'
  | 'car'
  | 'star'
  | 'user'
  | 'card'
  | 'search'
  | 'camera'
  | 'pin'
  | 'clipboard'
  | 'tools'
  | 'grid'
  | 'file'
  | 'bell';

export interface MobileLink {
  label: string;
  href: string;
  icon: MobileIconName;
}

export interface MobileTab extends MobileLink {
  /**
   * Path patterns. A pattern ending in /* matches that path and its children.
   * Any other pattern is an exact path match.
   */
  match: string[];
}

export interface MobileSection {
  title: string;
  items: MobileLink[];
}

export interface MobileRoleNav {
  id: 'superadmin' | 'shop' | 'manager' | 'tech' | 'customer';
  roleLabel: string;
  homeHref: string;
  messagesHref: string;
  superadminOnly: boolean;
  tabs: MobileTab[];
  more: MobileSection[];
}

export type ShellRole = 'shop' | 'tech' | 'customer' | 'manager' | 'admin' | 'superadmin';

type Actor = { role?: string | null; isSuperAdmin?: boolean | null; isOwner?: boolean | null } | null | undefined;

/** Owner tools stay in the catalog so the page is reachable, but only the platform owner sees them. */
export function withoutOwnerOnlyLinks(nav: MobileRoleNav, isOwner: boolean): MobileRoleNav {
  if (isOwner) return nav;
  return {
    ...nav,
    more: nav.more
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.label !== 'Owner Tools' && !item.href.startsWith('/admin/owner')),
      }))
      .filter((group) => group.items.length > 0),
  };
}

function link(label: string, href: string, icon: MobileIconName = 'grid'): MobileLink {
  return { label, href, icon };
}

function section(title: string, items: MobileLink[]): MobileSection {
  return { title, items };
}

const superadminNav: MobileRoleNav = {
  id: 'superadmin',
  roleLabel: 'Super Admin',
  homeHref: '/admin/home',
  messagesHref: '/admin/messages',
  superadminOnly: true,
  tabs: [
    {
      label: 'Overview',
      href: '/admin/home',
      icon: 'home',
      match: ['/admin/home', '/admin', '/admin/dashboard', '/admin/command-center', '/superadmin', '/superadmin/dashboard'],
    },
    {
      label: 'Shops',
      href: '/admin/manage-shops',
      icon: 'wrench',
      match: ['/admin/manage-shops/*', '/admin/shops/*', '/admin/pending-shops', '/admin/accepted-shops', '/admin/shop-details/*'],
    },
    {
      label: 'Customers',
      href: '/admin/manage-customers',
      icon: 'user',
      match: ['/admin/manage-customers/*'],
    },
    {
      label: 'Analytics',
      href: '/admin/platform-analytics',
      icon: 'chart',
      match: ['/admin/platform-analytics/*', '/superadmin/analytics/*'],
    },
  ],
  more: [
    section('Operations', [
      link('Command Center', '/admin/command-center', 'clipboard'),
      link('Dashboard', '/admin/dashboard', 'home'),
      link('Pending Shops', '/admin/pending-shops', 'clock'),
      link('Accepted Shops', '/admin/accepted-shops', 'wrench'),
      link('Shops', '/admin/shops', 'wrench'),
      link('Manage Shops', '/admin/manage-shops', 'wrench'),
      link('Add Shop', '/admin/manage-shops/new', 'wrench'),
      link('DVI Approvals', '/admin/dvi-approvals', 'clipboard'),
      link('Compliance', '/admin/compliance-dashboard', 'search'),
      link('Inventory', '/admin/inventory', 'inventory'),
      link('Environmental Fees', '/admin/environmental-fees', 'dollar'),
    ]),
    section('People & Insight', [
      link('Manage Customers', '/admin/manage-customers', 'user'),
      link('User Management', '/admin/user-management', 'team'),
      link('New User', '/admin/user-management/new', 'user'),
      link('Platform Users', '/superadmin/users', 'team'),
      link('New Platform User', '/superadmin/users/new', 'user'),
      link('Tenants', '/admin/manage-tenants', 'grid'),
      link('Platform Tenants', '/superadmin/tenants', 'grid'),
      link('Platform Analytics', '/admin/platform-analytics', 'chart'),
      link('Enterprise Analytics', '/superadmin/analytics', 'chart'),
      link('Revenue & Payouts', '/admin/revenue', 'dollar'),
      link('Financial Reports', '/admin/financial-reports', 'file'),
    ]),
    section('Messages', [
      link('Messages', '/admin/messages', 'messages'),
      link('Messaging', '/admin/messaging', 'messages'),
      link('Email Templates', '/admin/email-templates', 'file'),
      link('Campaigns', '/admin/campaigns', 'bell'),
    ]),
    section('System', [
      link('Security', '/admin/security', 'settings'),
      link('Security Settings', '/admin/security-settings', 'settings'),
      link('Platform Security', '/superadmin/security', 'settings'),
      link('Activity Logs', '/admin/activity-logs', 'file'),
      link('Active Sessions', '/admin/sessions', 'clock'),
      link('Settings', '/admin/settings', 'settings'),
      link('System Settings', '/admin/system-settings', 'settings'),
      link('Platform Settings', '/superadmin/settings', 'settings'),
      link('Admin Tools', '/admin/admin-tools', 'tools'),
      link('Backup & Restore', '/admin/backup-restore', 'inventory'),
      link('Performance', '/admin/performance', 'chart'),
      link('Health Check', '/admin/test', 'search'),
      link('Documentation', '/admin/guide', 'file'),
      link('Enhanced Tools', '/admin/enhanced', 'tools'),
      link('Profile', '/admin/profile', 'user'),
      link('Owner Tools', '/admin/owner', 'user'),
      link('My Profile', '/admin/owner/my-profile', 'user'),
      link('Quick Edit User', '/admin/owner/quick-edit-user-info', 'user'),
      link('Reset User Password', '/admin/owner/reset-user-password', 'settings'),
      link('Deployments', '/superadmin/deployments', 'tools'),
      link('Infrastructure', '/superadmin/infrastructure', 'settings'),
      link('Platform Profile', '/superadmin/profile', 'user'),
      link('Platform Home', '/superadmin', 'home'),
      link('Admin Home', '/admin', 'home'),
    ]),
  ],
};

const shopNav: MobileRoleNav = {
  id: 'shop',
  roleLabel: 'Shop Owner',
  homeHref: '/shop/home',
  messagesHref: '/shop/customer-messages',
  superadminOnly: false,
  tabs: [
    { label: 'Home', href: '/shop/home', icon: 'home', match: ['/shop/home', '/shop'] },
    { label: 'Orders', href: '/shop/jobs', icon: 'orders', match: ['/shop/jobs/*', '/workorders/*'] },
    { label: 'Messages', href: '/shop/customer-messages', icon: 'messages', match: ['/shop/customer-messages/*'] },
    { label: 'Team', href: '/shop/manage-team', icon: 'team', match: ['/shop/manage-team/*'] },
  ],
  more: [
    section('Work', [
      link('New In-Shop Job', '/shop/new-inshop-job', 'wrench'),
      link('New Roadside Job', '/shop/new-roadside-job', 'pin'),
      link('In-Shop Work Order', '/workorders/inshop', 'orders'),
      link('Roadside Work Order', '/workorders/roadside', 'pin'),
      link('Work Orders', '/workorders', 'orders'),
      link('Work Order List', '/workorders/list', 'clipboard'),
      link('New Work Order', '/workorders/new', 'clipboard'),
      link('All Orders', '/shop/jobs', 'orders'),
      link('Estimates', '/shop/estimates', 'file'),
      link('Work Authorizations', '/shop/work-authorizations', 'clipboard'),
      link('DVI / Inspections', '/shop/dvi', 'search'),
      link('State Inspections', '/shop/inspections', 'search'),
      link('Waiting Room', '/shop/waiting-room', 'clock'),
      link('Recurring Jobs', '/shop/recurring-workorders', 'clock'),
      link('Templates', '/shop/templates', 'file'),
      link('Map', '/shop/map', 'pin'),
      link('Calendar', '/shop/calendar', 'calendar'),
      link('Service Bays', '/shop/bays', 'wrench'),
    ]),
    section('Business', [
      link('Reports', '/shop/analytics', 'chart'),
      link('Report Archive', '/shop/reports', 'chart'),
      link('SLA Metrics', '/shop/analytics/sla', 'chart'),
      link('Employee Performance', '/shop/analytics/performance', 'chart'),
      link('Team Performance', '/shop/team-performance', 'team'),
      link('EOD Report', '/shop/eod-report', 'file'),
      link('Customer CRM', '/shop/customer-reports', 'user'),
      link('Customers', '/shop/customers', 'user'),
      link('AR Aging', '/shop/ar-aging', 'dollar'),
      link('Profit Margins', '/shop/profit-margins', 'dollar'),
      link('Payroll', '/shop/payroll', 'dollar'),
      link('Payment Links', '/shop/payment-links', 'card'),
      link('Inventory', '/shop/inventory', 'inventory'),
      link('Shared Inventory', '/shop/inventory/shared', 'inventory'),
      link('Vendors & Parts', '/shop/vendors', 'inventory'),
      link('Purchase Orders', '/shop/purchase-orders', 'orders'),
      link('Receiving', '/shop/purchase-orders-receiving', 'orders'),
      link('Core Returns', '/shop/core-returns', 'inventory'),
      link('Parts & Labor', '/shop/parts-labor', 'wrench'),
      link('Reviews', '/shop/reviews', 'star'),
    ]),
    section('Shop', [
      link('Command Center', '/shop/admin', 'clipboard'),
      link('Shop Admin Health', '/shop/admin/health', 'search'),
      link('Shop Admin Logs', '/shop/admin/logs', 'file'),
      link('Shop Admin Settings', '/shop/admin/settings', 'settings'),
      link('Time Clock', '/shop/timeclock', 'clock'),
      link('Services', '/shop/services', 'wrench'),
      link('Loaners', '/shop/loaners', 'car'),
      link('Fleet Accounts', '/shop/fleet', 'car'),
      link('New Fleet Account', '/shop/fleet/new', 'car'),
      link('Photos', '/shop/photos', 'camera'),
      link('Condition Reports', '/shop/condition-reports', 'camera'),
      link('Environmental Fees', '/shop/environmental-fees', 'dollar'),
      link('Locations', '/shop/locations', 'pin'),
      link('Referrals', '/shop/referrals', 'star'),
      link('Campaigns', '/shop/campaigns', 'bell'),
      link('Integrations', '/shop/integrations', 'tools'),
      link('Automations', '/shop/automations', 'tools'),
      link('Branding', '/shop/branding', 'settings'),
      link('Subscribe', '/shop/subscribe', 'card'),
      link('Tax Settings', '/shop/tax-settings', 'dollar'),
      link('Shop Settings', '/shop/settings', 'settings'),
      link('Permissions', '/shop/settings/permissions', 'settings'),
      link('Schedule', '/shop/settings/schedule', 'calendar'),
      link('Sessions', '/shop/settings/sessions', 'clock'),
      link('Two-Factor Auth', '/shop/settings/two-factor', 'settings'),
      link('API Keys', '/shop/settings/api-keys', 'settings'),
      link('Webhooks', '/shop/settings/webhooks', 'settings'),
      link('Profile', '/shop/profile', 'user'),
      link('Complete Profile', '/shop/complete-profile', 'user'),
      link('Shop', '/shop', 'home'),
    ]),
  ],
};

const managerNav: MobileRoleNav = {
  id: 'manager',
  roleLabel: 'Manager',
  homeHref: '/manager/home',
  messagesHref: '/manager/messages',
  superadminOnly: false,
  tabs: [
    { label: 'Home', href: '/manager/home', icon: 'home', match: ['/manager/home', '/manager', '/manager/dashboard', '/manager/overview'] },
    { label: 'Assign', href: '/manager/assignments', icon: 'clipboard', match: ['/manager/assignments/*', '/workorders/*'] },
    { label: 'Team', href: '/manager/team', icon: 'team', match: ['/manager/team/*'] },
    { label: 'Messages', href: '/manager/messages', icon: 'messages', match: ['/manager/messages/*'] },
  ],
  more: [
    section('Jobs', [
      link('Job Queue', '/manager/assignments', 'clipboard'),
      link('Dashboard', '/manager/dashboard', 'home'),
      link('Overview', '/manager/overview', 'chart'),
      link('Estimates', '/manager/estimates', 'file'),
      link('Approvals', '/manager/approvals', 'clipboard'),
      link('Work Authorizations', '/manager/work-authorizations', 'clipboard'),
      link('Inspections', '/manager/inspections', 'search'),
      link('Recurring Jobs', '/manager/recurring-workorders', 'clock'),
      link('Templates', '/manager/templates', 'file'),
      link('Map', '/manager/map', 'pin'),
      link('New In-Shop Job', '/shop/new-inshop-job', 'wrench'),
      link('New Roadside Job', '/shop/new-roadside-job', 'pin'),
      link('Roadside Jobs', '/workorders/roadside', 'pin'),
      link('In-Shop Jobs', '/workorders/inshop', 'orders'),
      link('Work Orders', '/workorders', 'orders'),
    ]),
    section('People', [
      link('Team', '/manager/team', 'team'),
      link('Schedule', '/manager/schedule', 'calendar'),
      link('New Shift', '/manager/schedule/new', 'calendar'),
      link('Time Clock', '/manager/timeclock', 'clock'),
      link('Leave Requests', '/manager/leave-requests', 'file'),
      link('Payroll', '/manager/payroll', 'dollar'),
      link('Inventory', '/manager/inventory', 'inventory'),
      link('Reports', '/manager/reports', 'chart'),
    ]),
    section('Shop', [
      link('Settings', '/manager/settings', 'settings'),
      link('Permissions', '/manager/settings/permissions', 'settings'),
      link('Two-Factor Auth', '/manager/settings/two-factor', 'settings'),
      link('Admin', '/manager/admin', 'tools'),
      link('Admin Settings', '/manager/admin/settings', 'settings'),
      link('Audit Logs', '/manager/admin/logs', 'file'),
      link('Notifications', '/manager/messages', 'bell'),
      link('Profile', '/manager/profile', 'user'),
      link('Manager Home', '/manager', 'home'),
    ]),
  ],
};

const techNav: MobileRoleNav = {
  id: 'tech',
  roleLabel: 'Technician',
  homeHref: '/tech/home',
  messagesHref: '/tech/messages',
  superadminOnly: false,
  tabs: [
    { label: 'Home', href: '/tech/home', icon: 'home', match: ['/tech/home', '/tech'] },
    { label: 'My Jobs', href: '/tech/jobs?view=active', icon: 'clipboard', match: ['/tech/jobs/*', '/tech/work-orders/*', '/workorders/*'] },
    { label: 'Clock', href: '/tech/timeclock', icon: 'clock', match: ['/tech/timeclock'] },
    { label: 'Messages', href: '/tech/messages', icon: 'messages', match: ['/tech/messages/*'] },
  ],
  more: [
    section('Field Tools', [
      link('DVI Form', '/tech/dvi', 'search'),
      link('DTC Lookup', '/tech/dtc-lookup', 'file'),
      link('Diagnostics', '/tech/diagnostics', 'search'),
      link('Offline jobs', '/tech-offline/', 'clipboard'),
      link('Photos', '/tech/photos', 'camera'),
      link('Location', '/tech/share-location', 'pin'),
      link('Inventory', '/tech/inventory', 'inventory'),
      link('All Tools', '/tech/all-tools', 'tools'),
      link('Manuals', '/tech/manuals', 'file'),
      link('Command Center', '/tech/command-center', 'clipboard'),
    ]),
    section('Job Creation', [
      link('Active Jobs', '/tech/jobs?view=active', 'clipboard'),
      link('Job History', '/tech/jobs?view=history', 'clipboard'),
      link('Work Orders', '/tech/work-orders', 'orders'),
      link('Estimates', '/tech/estimates', 'file'),
      link('New In-Shop Job', '/tech/new-inshop-job', 'wrench'),
      link('New Roadside Job', '/tech/new-roadside-job', 'pin'),
      link('Parts Request', '/tech/parts-request', 'inventory'),
      link('Customers', '/tech/customers', 'user'),
    ]),
    section('Me', [
      link('My Shifts', '/tech/my-shifts', 'calendar'),
      link('Timesheet', '/tech/timesheet', 'clock'),
      link('Leave Requests', '/tech/leave-requests', 'file'),
      link('New Leave Request', '/tech/leave-requests/new', 'file'),
      link('Profile', '/tech/profile', 'user'),
      link('Settings', '/tech/settings', 'settings'),
      link('Two-Factor Auth', '/tech/settings/two-factor', 'settings'),
      link('Enhanced', '/tech/enhanced', 'tools'),
      link('Tech Home', '/tech', 'home'),
    ]),
  ],
};

const customerNav: MobileRoleNav = {
  id: 'customer',
  roleLabel: 'Customer',
  homeHref: '/customer/dashboard',
  messagesHref: '/customer/messages',
  superadminOnly: false,
  tabs: [
    { label: 'Home', href: '/customer/dashboard', icon: 'home', match: ['/customer/dashboard', '/customer/home', '/customer'] },
    { label: 'Appts', href: '/customer/appointments', icon: 'calendar', match: ['/customer/appointments/*'] },
    { label: 'Repairs', href: '/customer/history', icon: 'wrench', match: ['/customer/history', '/customer/workorders/*', '/workorders/*'] },
    { label: 'Chat', href: '/customer/messages', icon: 'messages', match: ['/customer/messages/*'] },
  ],
  more: [
    section('Services', [
      link('Find Shops', '/customer/findshops', 'search'),
      link('Work Orders', '/customer/workorders', 'orders'),
      link('My Estimates', '/customer/estimates', 'file'),
      link('Live Tracking', '/customer/tracking', 'pin'),
      link('Recurring Approvals', '/customer/recurring-approvals', 'clock'),
      link('Service History', '/customer/history', 'wrench'),
      link('Book Appointment', '/customer/appointments/new', 'calendar'),
      link('Appointments', '/customer/appointments', 'calendar'),
    ]),
    section('Account', [
      link('Payments', '/customer/payments', 'card'),
      link('My Vehicles', '/customer/vehicles', 'car'),
      link('Reviews', '/customer/reviews', 'star'),
      link('Favorite Shops', '/customer/favorites', 'star'),
      link('Rewards', '/customer/rewards', 'star'),
      link('Account Overview', '/customer/overview', 'user'),
      link('Profile', '/customer/profile', 'user'),
      link('Addresses', '/customer/addresses', 'pin'),
      link('Features', '/customer/features', 'grid'),
    ]),
    section('Records', [
      link('Documents', '/customer/documents', 'file'),
      link('Insights', '/customer/insights', 'chart'),
      link('Notifications', '/customer/notifications', 'bell'),
      link('Customer Home', '/customer/home', 'home'),
      link('Customer', '/customer', 'home'),
    ]),
  ],
};

export const MOBILE_ROLE_NAVS: Record<MobileRoleNav['id'], MobileRoleNav> = {
  superadmin: superadminNav,
  shop: shopNav,
  manager: managerNav,
  tech: techNav,
  customer: customerNav,
};

export function isSuperAdminActor(actor: Actor): boolean {
  if (!actor) return false;
  if (actor.isSuperAdmin === true) return true;
  return normalizeRole(actor.role) === 'superadmin';
}

/** Shell role for shared routes such as /workorders/[id]. */
export function shellRoleForActor(actor: Actor): ShellRole | null {
  if (!actor) return null;
  if (isSuperAdminActor(actor) || normalizeRole(actor.role) === 'admin') return 'admin';
  const role = normalizeRole(actor.role);
  if (role === 'shop' || role === 'manager' || role === 'tech' || role === 'customer') return role;
  return null;
}

/**
 * Tabs for the shell. Super Admin tabs are withheld unless the actor is a superadmin.
 */
export function mobileNavForActor(shellRole: ShellRole, actor: Actor): MobileRoleNav | null {
  if (shellRole === 'admin' || shellRole === 'superadmin') {
    if (!isSuperAdminActor(actor)) return null;
    return withoutOwnerOnlyLinks(MOBILE_ROLE_NAVS.superadmin, actor?.isOwner === true);
  }
  return MOBILE_ROLE_NAVS[shellRole] ?? null;
}

export function pathMatchesPattern(pattern: string, pathname: string): boolean {
  const path = pathname.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  if (pattern.endsWith('/*')) {
    const base = pattern.slice(0, -2).replace(/\/+$/, '') || '/';
    return path === base || path.startsWith(`${base}/`);
  }
  const exact = pattern.replace(/\/+$/, '') || '/';
  return path === exact;
}

export function activePrimaryTabIndex(nav: MobileRoleNav, pathname: string): number {
  return nav.tabs.findIndex((tab) => tab.match.some((pattern) => pathMatchesPattern(pattern, pathname)));
}

export function hrefPath(href: string): string {
  return href.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
}

export function allMobileNavHrefs(nav: MobileRoleNav): string[] {
  return [
    ...nav.tabs.map((tab) => tab.href),
    ...nav.more.flatMap((group) => group.items.map((item) => item.href)),
  ];
}

/** True when a page path is linked directly, or is a dynamic child of a linked page. */
export function pageCoveredByNav(pagePath: string, hrefs: string[]): boolean {
  const page = pagePath.replace(/\/+$/, '') || '/';
  const paths = hrefs.map(hrefPath);
  if (paths.some((href) => page === href || page.startsWith(`${href}/`))) return true;
  if (!page.includes('[')) return false;
  const parts = page.split('/');
  for (let i = parts.length - 1; i >= 1; i -= 1) {
    const ancestor = parts.slice(0, i).join('/') || '/';
    if (ancestor.includes('[')) continue;
    if (paths.some((href) => ancestor === href || ancestor.startsWith(`${href}/`))) return true;
  }
  return false;
}
