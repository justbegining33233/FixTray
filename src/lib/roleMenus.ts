/**
 * One menu per role, shared by the computer sidebar and the phone tabs + More sheet.
 * A page that is not in that menu (and is not a child, a work-order detail, or a
 * personal page such as profile, notifications, messages, or two-factor) sends
 * the role home. /admin stays a 403 for shop, manager, tech, and customer.
 */

import { ROLE_HOME } from './roleConfig';
import { isRouteAllowed, type RouteActor } from './roleAccess';
import { normalizeRole, shellHrefForRole } from './roleNav';
import { isPlatformActor, isShopScopedPath, isStaticAssetPath } from './platformOwnerScope';
import { isPlatformEmailAccount, PLATFORM_EMAIL_HREF, isPlatformEmailPath } from './platformEmailAccess';
import { isPlatformFeeYearAccount, isPlatformFeeYearPath, PLATFORM_FEE_YEAR_HREF } from './books/access';
import { PLATFORM_VISITS_HREF, isPlatformVisitsPath } from './platformVisits';
import { isShopEdgeSensitivePath } from './shopRestrictedRoutes';

export type MenuRole = 'superadmin' | 'shop' | 'manager' | 'tech' | 'customer' | 'accountant';

export type MenuIcon =
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

export interface RoleMenuItem {
  label: string;
  href: string;
  icon: MenuIcon;
  badge?: number;
}

export interface RoleMenuGroup {
  label: string;
  icon: MenuIcon;
  defaultOpen?: boolean;
  items: RoleMenuItem[];
}

export type SidebarRole = 'shop' | 'manager' | 'tech' | 'admin' | 'superadmin' | 'accountant';

/** Customer dashboard tiles. The phone menu includes these same links. */
export const CUSTOMER_TILE_HREFS = {
  findshops: '/customer/findshops',
  appointments: '/customer/appointments',
  workorders: '/customer/workorders',
  quotes: '/customer/estimates',
  tracking: '/customer/tracking',
  vehicles: '/customer/vehicles',
  reviews: '/customer/reviews',
  favorites: '/customer/favorites',
  rewards: '/customer/rewards',
  payments: '/customer/payments',
  'recurring-approvals': '/customer/recurring-approvals',
  overview: '/customer/overview',
  history: '/customer/history',
  documents: '/customer/documents',
  insights: '/customer/insights',
} as const;

export type CustomerTileId = keyof typeof CUSTOMER_TILE_HREFS;

export function customerTileHref(id: CustomerTileId): string {
  return CUSTOMER_TILE_HREFS[id];
}

export const TOP_BAR: Record<MenuRole, { home: string; profile: string; messages: string }> = {
  superadmin: { home: '/admin/home', profile: '/superadmin/profile', messages: '/admin/messaging' },
  shop: { home: '/shop/admin', profile: '/shop/profile', messages: '/shop/customer-messages' },
  manager: { home: '/manager/home', profile: '/manager/profile', messages: '/manager/messages' },
  tech: { home: '/tech/home', profile: '/tech/profile', messages: '/tech/messages' },
  customer: { home: '/customer/dashboard', profile: '/customer/profile', messages: '/customer/messages' },
  accountant: { home: '/shop/books', profile: '/shop/accounting', messages: '/shop/accounting/exports' },
};

export function topBarFor(role?: string | null): { home: string; profile: string; messages: string } | null {
  const menuRole = menuRoleFor(role);
  return menuRole ? TOP_BAR[menuRole] : null;
}

const tile = CUSTOMER_TILE_HREFS;

export const ROLE_MENUS: Record<MenuRole, RoleMenuGroup[]> = {
  superadmin: [
    {
      label: 'Overview',
      icon: 'home',
      defaultOpen: true,
      items: [
        { icon: 'home', label: 'Dashboard', href: '/admin/home' },
        { icon: 'messages', label: 'Messaging', href: '/admin/messaging' },
        { icon: 'user', label: 'Profile', href: '/superadmin/profile' },
      ],
    },
    {
      label: 'Platform Management',
      icon: 'grid',
      defaultOpen: true,
      items: [
        { icon: 'grid', label: 'Shops', href: '/admin/shops' },
        { icon: 'clipboard', label: 'Shop Approvals', href: '/admin/pending-shops' },
        { icon: 'grid', label: 'Accepted Shops', href: '/admin/accepted-shops' },
        { icon: 'team', label: 'Users', href: '/admin/user-management' },
        { icon: 'user', label: 'Customers', href: '/admin/manage-customers' },
        { icon: 'grid', label: 'Tenants', href: '/admin/manage-tenants' },
      ],
    },
    {
      label: 'Communications',
      icon: 'bell',
      defaultOpen: false,
      items: [
        { icon: 'file', label: 'Email Templates', href: '/admin/email-templates' },
      ],
    },
    {
      label: 'Financial & Reporting',
      icon: 'chart',
      defaultOpen: false,
      items: [
        { icon: 'chart', label: 'Analytics', href: '/admin/platform-analytics' },
        { icon: 'dollar', label: 'Fee Revenue', href: '/admin/revenue' },
        { icon: 'file', label: 'Financial Reports', href: '/admin/financial-reports' },
      ],
    },
    {
      label: 'Security & Compliance',
      icon: 'settings',
      defaultOpen: false,
      items: [
        { icon: 'settings', label: 'Security', href: '/admin/security' },
        { icon: 'file', label: 'Activity Logs', href: '/admin/activity-logs' },
        { icon: 'clock', label: 'Sessions', href: '/admin/sessions' },
        { icon: 'search', label: 'Health', href: '/admin/test' },
      ],
    },
    {
      label: 'System Administration',
      icon: 'tools',
      defaultOpen: false,
      items: [
        { icon: 'settings', label: 'Platform Settings', href: '/admin/settings' },
        { icon: 'tools', label: 'Admin Tools', href: '/admin/admin-tools' },
        { icon: 'user', label: 'Owner Tools', href: '/admin/owner' },
        { icon: 'inventory', label: 'Backup/Restore', href: '/admin/backup-restore' },
        { icon: 'tools', label: 'Deployments', href: '/superadmin/deployments' },
        { icon: 'settings', label: 'Infrastructure', href: '/superadmin/infrastructure' },
      ],
    },
  ],
  shop: [
    {
      label: 'Overview',
      icon: 'chart',
      defaultOpen: true,
      items: [
        { icon: 'home', label: 'Dashboard', href: '/shop/admin' },
        { icon: 'grid', label: 'Shop Home', href: '/shop/home' },
        { icon: 'messages', label: 'Messages', href: '/shop/customer-messages' },
      ],
    },
    {
      label: 'Work Orders',
      icon: 'clipboard',
      defaultOpen: true,
      items: [
        { icon: 'orders', label: 'All Orders', href: '/shop/jobs' },
        { icon: 'wrench', label: 'In-Shop Jobs', href: '/shop/new-inshop-job' },
        { icon: 'pin', label: 'Roadside Jobs', href: '/workorders/roadside' },
        { icon: 'pin', label: 'Road Map', href: '/shop/map' },
        { icon: 'clipboard', label: 'Estimates', href: '/shop/estimates' },
        { icon: 'file', label: 'Authorizations', href: '/shop/work-authorizations' },
        { icon: 'tools', label: 'Templates', href: '/shop/templates' },
        { icon: 'clock', label: 'Recurring', href: '/shop/recurring-workorders' },
        { icon: 'grid', label: 'Waiting Room', href: '/shop/waiting-room' },
      ],
    },
    {
      label: 'Team & Payroll',
      icon: 'team',
      defaultOpen: false,
      items: [
        { icon: 'team', label: 'Manage Team', href: '/shop/manage-team' },
        { icon: 'settings', label: 'Permissions', href: '/shop/settings/permissions' },
        { icon: 'dollar', label: 'Payroll', href: '/shop/payroll' },
        { icon: 'clock', label: 'Time Clock', href: '/shop/timeclock' },
        { icon: 'clock', label: 'Staff Clocks', href: '/shop/clocks' },
        { icon: 'calendar', label: 'Schedule', href: '/shop/settings/schedule' },
      ],
    },
    {
      label: 'Inventory & Parts',
      icon: 'inventory',
      defaultOpen: false,
      items: [
        { icon: 'inventory', label: 'Inventory', href: '/shop/inventory' },
        { icon: 'inventory', label: 'Shared Inventory', href: '/shop/inventory/shared' },
        { icon: 'wrench', label: 'Vendors', href: '/shop/vendors' },
        { icon: 'orders', label: 'Purchase Orders', href: '/shop/purchase-orders' },
        { icon: 'inventory', label: 'Core Returns', href: '/shop/core-returns' },
      ],
    },
    {
      label: 'Vehicle Services',
      icon: 'car',
      defaultOpen: false,
      items: [
        { icon: 'wrench', label: 'Services', href: '/shop/services' },
        { icon: 'car', label: 'Loaners', href: '/shop/loaners' },
        { icon: 'car', label: 'Fleet Accounts', href: '/shop/fleet' },
        { icon: 'search', label: 'DVI Inspections', href: '/shop/dvi' },
        { icon: 'camera', label: 'Condition Reports', href: '/shop/condition-reports' },
        { icon: 'camera', label: 'Photos', href: '/shop/photos' },
        { icon: 'car', label: 'State Inspections', href: '/shop/inspections' },
        { icon: 'dollar', label: 'Environmental Fees', href: '/shop/environmental-fees' },
      ],
    },
    {
      label: 'Financials',
      icon: 'chart',
      defaultOpen: false,
      items: [
        { icon: 'chart', label: 'Reports', href: '/shop/analytics' },
        { icon: 'dollar', label: 'Books', href: '/shop/books' },
        { icon: 'chart', label: 'Statements', href: '/shop/accounting' },
        { icon: 'chart', label: 'Profit & Loss', href: '/shop/accounting/pl' },
        { icon: 'chart', label: 'Balance Sheet', href: '/shop/accounting/balance-sheet' },
        { icon: 'file', label: 'Chart of Accounts', href: '/shop/accounting/chart' },
        { icon: 'dollar', label: 'Sales Tax', href: '/shop/accounting/tax' },
        { icon: 'file', label: 'Vendor Bills', href: '/shop/accounting/ap' },
        { icon: 'file', label: 'EOD Report', href: '/shop/eod-report' },
        { icon: 'clock', label: 'SLA Metrics', href: '/shop/analytics/sla' },
        { icon: 'user', label: 'Employee Perf', href: '/shop/analytics/performance' },
        { icon: 'user', label: 'Customer CRM', href: '/shop/customer-reports' },
        { icon: 'chart', label: 'AR Aging', href: '/shop/ar-aging' },
        { icon: 'chart', label: 'Job Profit', href: '/shop/profit-margins' },
        { icon: 'user', label: 'Tech Productivity', href: '/shop/accounting/productivity' },
        { icon: 'chart', label: 'QuickBooks', href: '/shop/accounting/quickbooks' },
        { icon: 'card', label: 'Payment Links', href: '/shop/payment-links' },
        { icon: 'star', label: 'Reviews', href: '/shop/reviews' },
      ],
    },
    {
      label: 'Growth',
      icon: 'bell',
      defaultOpen: false,
      items: [
        { icon: 'star', label: 'Referrals', href: '/shop/referrals' },
        { icon: 'bell', label: 'Campaigns', href: '/shop/campaigns' },
        { icon: 'tools', label: 'Integrations', href: '/shop/integrations' },
        { icon: 'tools', label: 'Automations', href: '/shop/automations' },
        { icon: 'pin', label: 'Locations', href: '/shop/locations' },
      ],
    },
    {
      label: 'Settings',
      icon: 'settings',
      defaultOpen: false,
      items: [
        { icon: 'settings', label: 'Shop Settings', href: '/shop/settings' },
        { icon: 'tools', label: 'Admin Panel', href: '/shop/admin/settings' },
        { icon: 'dollar', label: 'Tax Settings', href: '/shop/tax-settings' },
        { icon: 'settings', label: 'Security', href: '/shop/settings?tab=security' },
        { icon: 'user', label: 'Profile', href: '/shop/profile' },
      ],
    },
  ],
  manager: [
    {
      label: 'Overview',
      icon: 'chart',
      defaultOpen: true,
      items: [
        { icon: 'home', label: 'Dashboard', href: '/manager/home' },
        { icon: 'messages', label: 'Messages', href: '/manager/messages' },
        { icon: 'user', label: 'Profile', href: '/manager/profile' },
      ],
    },
    {
      label: 'Work Orders',
      icon: 'clipboard',
      defaultOpen: true,
      items: [
        { icon: 'orders', label: 'All Orders', href: '/manager/assignments' },
        { icon: 'wrench', label: 'In-Shop Jobs', href: '/shop/new-inshop-job' },
        { icon: 'pin', label: 'Roadside Jobs', href: '/workorders/roadside' },
        { icon: 'pin', label: 'Road Map', href: '/manager/map' },
        { icon: 'clipboard', label: 'Estimates', href: '/manager/estimates' },
        { icon: 'file', label: 'Authorizations', href: '/manager/work-authorizations' },
        { icon: 'clipboard', label: 'Approvals', href: '/manager/approvals' },
        { icon: 'search', label: 'Inspections', href: '/manager/inspections' },
        { icon: 'tools', label: 'Templates', href: '/manager/templates' },
        { icon: 'clock', label: 'Recurring', href: '/manager/recurring-workorders' },
      ],
    },
    {
      label: 'Team',
      icon: 'team',
      defaultOpen: false,
      items: [
        { icon: 'team', label: 'Manage Team', href: '/manager/team' },
        { icon: 'settings', label: 'Permissions', href: '/manager/settings/permissions' },
        { icon: 'calendar', label: 'Schedule', href: '/manager/schedule' },
        { icon: 'file', label: 'Leave Requests', href: '/manager/leave-requests' },
        { icon: 'dollar', label: 'Payroll', href: '/manager/payroll' },
        { icon: 'clock', label: 'Time Clock', href: '/manager/timeclock' },
        { icon: 'clock', label: 'Staff Clocks', href: '/manager/clocks' },
        { icon: 'inventory', label: 'Inventory', href: '/manager/inventory' },
      ],
    },
    {
      label: 'Reports',
      icon: 'chart',
      defaultOpen: false,
      items: [
        { icon: 'chart', label: 'Reports', href: '/manager/reports' },
        { icon: 'dollar', label: 'Books', href: '/manager/books' },
      ],
    },
    {
      label: 'Settings',
      icon: 'settings',
      defaultOpen: false,
      items: [
        { icon: 'settings', label: 'Manager Settings', href: '/manager/settings' },
        { icon: 'tools', label: 'Admin Panel', href: '/manager/admin/settings' },
        { icon: 'file', label: 'Audit Logs', href: '/manager/admin/logs' },
        { icon: 'settings', label: 'Two-Factor Auth', href: '/manager/settings/two-factor' },
      ],
    },
  ],
  tech: [
    {
      label: 'Overview',
      icon: 'home',
      defaultOpen: true,
      items: [
        { icon: 'home', label: 'Home', href: '/tech/home' },
        { icon: 'messages', label: 'Messages', href: '/tech/messages' },
        { icon: 'user', label: 'Profile', href: '/tech/profile' },
      ],
    },
    {
      label: 'Time & Jobs',
      icon: 'clock',
      defaultOpen: true,
      items: [
        { icon: 'clock', label: 'Time Clock', href: '/tech/timeclock' },
        { icon: 'clock', label: 'My Clocks', href: '/tech/clocks' },
        { icon: 'clock', label: 'Timesheet', href: '/tech/timesheet' },
        { icon: 'file', label: 'Leave Requests', href: '/tech/leave-requests' },
        { icon: 'clipboard', label: 'Command Center', href: '/tech/command-center' },
        { icon: 'clipboard', label: 'Active Jobs', href: '/tech/jobs?view=active' },
        { icon: 'clipboard', label: 'Job History', href: '/tech/jobs?view=history' },
        { icon: 'file', label: 'Estimates', href: '/tech/estimates' },
        { icon: 'wrench', label: 'New In-Shop Job', href: '/tech/new-inshop-job' },
        { icon: 'pin', label: 'New Roadside Job', href: '/tech/new-roadside-job' },
      ],
    },
    {
      label: 'Tools',
      icon: 'tools',
      defaultOpen: false,
      items: [
        { icon: 'tools', label: 'All Tools', href: '/tech/all-tools' },
        { icon: 'search', label: 'DVI Form', href: '/tech/dvi' },
        { icon: 'file', label: 'DTC Lookup', href: '/tech/dtc-lookup' },
        { icon: 'search', label: 'Diagnostics', href: '/tech/diagnostics' },
        { icon: 'file', label: 'Manuals', href: '/tech/manuals' },
        { icon: 'user', label: 'Customers', href: '/tech/customers' },
        { icon: 'camera', label: 'Photos', href: '/tech/photos' },
        { icon: 'inventory', label: 'Inventory', href: '/tech/inventory' },
        { icon: 'pin', label: 'Share Location', href: '/tech/share-location' },
        { icon: 'settings', label: 'Two-Factor Auth', href: '/tech/settings/two-factor' },
        { icon: 'clipboard', label: 'Offline jobs', href: '/tech-offline' },
      ],
    },
  ],
  customer: [
    {
      label: 'Overview',
      icon: 'home',
      defaultOpen: true,
      items: [
        { icon: 'home', label: 'Home', href: '/customer/dashboard' },
        { icon: 'messages', label: 'Messages', href: '/customer/messages' },
        { icon: 'user', label: 'Profile', href: '/customer/profile' },
      ],
    },
    {
      label: 'Discover',
      icon: 'search',
      defaultOpen: true,
      items: [
        { icon: 'search', label: 'Find Shops', href: tile.findshops },
        { icon: 'calendar', label: 'Appointments', href: tile.appointments },
        { icon: 'orders', label: 'Work Orders', href: tile.workorders },
        { icon: 'file', label: 'My Estimates', href: tile.quotes },
      ],
    },
    {
      label: 'Service',
      icon: 'wrench',
      defaultOpen: false,
      items: [
        { icon: 'pin', label: 'Live Tracking', href: tile.tracking },
        { icon: 'car', label: 'My Vehicles', href: tile.vehicles },
        { icon: 'wrench', label: 'Service History', href: tile.history },
      ],
    },
    {
      label: 'Account',
      icon: 'user',
      defaultOpen: false,
      items: [
        { icon: 'star', label: 'Reviews', href: tile.reviews },
        { icon: 'star', label: 'Favorite Shops', href: tile.favorites },
        { icon: 'star', label: 'Rewards', href: tile.rewards },
        { icon: 'card', label: 'Payments', href: tile.payments },
        { icon: 'clock', label: 'Recurring Approvals', href: tile['recurring-approvals'] },
        { icon: 'chart', label: 'Account Overview', href: tile.overview },
        { icon: 'file', label: 'Documents', href: tile.documents },
        { icon: 'chart', label: 'Insights', href: tile.insights },
      ],
    },
  ],
  accountant: [
    {
      label: 'Books',
      icon: 'dollar',
      defaultOpen: true,
      items: [
        { icon: 'dollar', label: 'Books', href: '/shop/books' },
        { icon: 'chart', label: 'Statements', href: '/shop/accounting' },
        { icon: 'chart', label: 'Profit & Loss', href: '/shop/accounting/pl' },
        { icon: 'chart', label: 'Balance Sheet', href: '/shop/accounting/balance-sheet' },
        { icon: 'file', label: 'Chart of Accounts', href: '/shop/accounting/chart' },
        { icon: 'dollar', label: 'Sales Tax', href: '/shop/accounting/tax' },
        { icon: 'file', label: 'Vendor Bills', href: '/shop/accounting/ap' },
        { icon: 'chart', label: 'Job Profit', href: '/shop/profit-margins' },
        { icon: 'user', label: 'Tech Productivity', href: '/shop/accounting/productivity' },
        { icon: 'chart', label: 'QuickBooks', href: '/shop/accounting/quickbooks' },
        { icon: 'file', label: 'Exports', href: '/shop/accounting/exports' },
        { icon: 'chart', label: 'AR Aging', href: '/shop/ar-aging' },
      ],
    },
  ],
};

const PERSONAL_ROOT: Record<MenuRole, string[]> = {
  superadmin: ['/admin', '/superadmin'],
  shop: ['/shop'],
  manager: ['/manager'],
  tech: ['/tech'],
  customer: ['/customer'],
  accountant: ['/shop/accounting'],
};

const PORTALS = ['/admin', '/superadmin', '/shop', '/tech', '/manager', '/customer', '/workorders', '/reports', '/tech-offline'];

export function cleanMenuPath(pathname: string): string {
  const path = pathname.split('?')[0].split('#')[0].replace(/\/+$/, '');
  return path || '/';
}

export function menuRoleFor(role?: string | null): MenuRole | null {
  const actor = normalizeRole(role);
  if (actor === 'admin' || actor === 'superadmin') return 'superadmin';
  if (actor === 'shop' || actor === 'manager' || actor === 'tech' || actor === 'customer' || actor === 'accountant') return actor;
  return null;
}

export function roleHome(role?: string | null): string {
  const actor = normalizeRole(role);
  return ROLE_HOME[actor] || '/auth/login';
}

export function menuHrefs(role: MenuRole): string[] {
  return ROLE_MENUS[role].flatMap((group) => group.items.map((item) => item.href));
}

export function menuRoleForSidebar(role: SidebarRole): MenuRole {
  if (role === 'admin' || role === 'superadmin') return 'superadmin';
  return role;
}

function appendPlatformOwnerItem(groups: RoleMenuGroup[], item: RoleMenuItem): RoleMenuGroup[] {
  let placed = false;
  const next = groups.map((group) => {
    if (group.label !== 'Communications') return group;
    if (group.items.some((entry) => entry.href === item.href)) return group;
    placed = true;
    return { ...group, items: [...group.items, item] };
  });
  if (placed) return next;
  return [...next, { label: 'Communications', icon: 'bell', defaultOpen: false, items: [item] }];
}

function withPlatformEmailItem(groups: RoleMenuGroup[], menuRole: MenuRole, username?: string | null): RoleMenuGroup[] {
  if (menuRole !== 'superadmin' || !isPlatformEmailAccount(username)) return groups;
  const withEmail = appendPlatformOwnerItem(groups, { icon: 'bell', label: 'Emails', href: PLATFORM_EMAIL_HREF });
  return appendPlatformOwnerItem(withEmail, { icon: 'chart', label: 'Visits', href: PLATFORM_VISITS_HREF });
}

function withPlatformFeeYearItem(groups: RoleMenuGroup[], menuRole: MenuRole, username?: string | null): RoleMenuGroup[] {
  if (menuRole !== 'superadmin' || !isPlatformFeeYearAccount(username)) return groups;
  let placed = false;
  const next = groups.map((group) => {
    if (group.label !== 'Financial & Reporting') return group;
    if (group.items.some((entry) => entry.href === PLATFORM_FEE_YEAR_HREF)) return group;
    placed = true;
    return { ...group, items: [...group.items, { icon: 'dollar' as const, label: 'Fee Year-End', href: PLATFORM_FEE_YEAR_HREF }] };
  });
  if (placed) return next;
  return [...next, { label: 'Financial & Reporting', icon: 'chart', defaultOpen: false, items: [{ icon: 'dollar', label: 'Fee Year-End', href: PLATFORM_FEE_YEAR_HREF }] }];
}

/** Computer sidebar groups after the same filters the sidebar applies. */
export function filterMenuGroups(
  sidebarRole: SidebarRole,
  actorRole: string,
  platformActor: boolean,
  username?: string | null,
): RoleMenuGroup[] {
  const menuRole = menuRoleForSidebar(sidebarRole);
  const groups = ROLE_MENUS[menuRole]
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => !(sidebarRole === 'shop' && isShopEdgeSensitivePath(item.href)))
        .filter((item) => item.href !== '/admin/coupons')
        .filter((item) => !(platformActor && isShopScopedPath(item.href)))
        .map((item) => ({ ...item, href: shellHrefForRole(item.href, actorRole) })),
    }))
    .filter((group) => group.items.length > 0);
  return withPlatformFeeYearItem(withPlatformEmailItem(groups, menuRole, username), menuRole, username);
}

export function renderedMenuHrefs(
  sidebarRole: SidebarRole,
  actorRole: string,
  platformActor: boolean,
  username?: string | null,
): string[] {
  return filterMenuGroups(sidebarRole, actorRole, platformActor, username).flatMap((group) => group.items.map((item) => item.href));
}

function isPortal(path: string): boolean {
  return PORTALS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function isPersonal(path: string, role: MenuRole): boolean {
  const last = path.split('/').filter(Boolean).pop() || '';
  const personal = last === 'profile'
    || last === 'my-profile'
    || last === 'notifications'
    || last === 'messages'
    || last === 'messaging'
    || last === 'customer-messages'
    || path.includes('/two-factor');
  if (!personal) return false;
  return PERSONAL_ROOT[role].some((root) => path === root || path.startsWith(`${root}/`));
}

function isChild(path: string, role: MenuRole): boolean {
  return menuHrefs(role).some((href) => {
    const base = cleanMenuPath(href);
    return base !== '/' && path.startsWith(`${base}/`);
  });
}

function isWorkOrderDetail(path: string, role: MenuRole): boolean {
  if (!/^\/workorders\/[^/]+$/.test(path)) return false;
  const reserved = new Set(['/workorders/roadside', '/workorders/inshop', '/workorders/new', '/workorders/list']);
  if (reserved.has(path)) return false;
  return menuHrefs(role).some((href) => {
    const base = cleanMenuPath(href);
    return base === '/workorders'
      || base.startsWith('/workorders/')
      || base.includes('/jobs')
      || base.includes('/workorders')
      || base.endsWith('/assignments');
  });
}

function isShopRecordDetail(path: string, role: MenuRole): boolean {
  if (role !== 'superadmin') return false;
  if (!/^\/admin\/shop-details\/[^/]+$/.test(path)) return false;
  return menuHrefs(role).some((href) => cleanMenuPath(href) === '/admin/shops');
}

/**
 * Shop Customer CRM lives at /shop/customer-reports. The directory at
 * /shop/customers is that same list. Per-customer records stay children of
 * the menu page (/shop/customer-reports/:id).
 */
function isShopCustomerDirectory(path: string, role: MenuRole): boolean {
  if (role !== 'shop' || path !== '/shop/customers') return false;
  return menuHrefs(role).some((href) => cleanMenuPath(href) === '/shop/customer-reports');
}

/**
 * Saved addresses stay a customer profile link, not a second sidebar item.
 * The page at /customer/addresses already exists; opening it must not bounce home.
 */
function isCustomerAddressBook(path: string, role: MenuRole): boolean {
  return role === 'customer' && path === '/customer/addresses';
}

export function canOpenMenuPath(role: MenuRole, pathname: string): boolean {
  const path = cleanMenuPath(pathname);
  const hrefs = menuHrefs(role);
  if (hrefs.includes(pathname.split('#')[0]) || hrefs.some((href) => cleanMenuPath(href) === path)) return true;
  if (isPersonal(path, role)) return true;
  if (isChild(path, role)) return true;
  if (isWorkOrderDetail(path, role)) return true;
  if (isShopRecordDetail(path, role)) return true;
  if (isShopCustomerDirectory(path, role)) return true;
  if (isCustomerAddressBook(path, role)) return true;
  return false;
}

export type PortalDecision = 'allow' | 'home' | 'forbidden' | 'skip';

export function portalAccessDecision(pathname: string, actor: string | RouteActor | null | undefined): PortalDecision {
  const path = cleanMenuPath(pathname);
  if (isStaticAssetPath(path)) return 'skip';
  const role = typeof actor === 'string' ? actor : actor?.role;
  const menuRole = menuRoleFor(role);
  if (!menuRole) return isPortal(path) ? 'home' : 'skip';
  const normalized = normalizeRole(role);
  const adminArea = path === '/admin' || path.startsWith('/admin/');
  if (adminArea && normalized !== 'admin' && normalized !== 'superadmin') return 'forbidden';
  if (isPlatformActor({ role: normalized }) && isShopScopedPath(path)) return 'home';
  if (isPlatformEmailPath(path) || isPlatformVisitsPath(path)) {
    const username = typeof actor === 'object' && actor ? actor.username : undefined;
    return isPlatformEmailAccount(username) ? 'allow' : 'home';
  }
  if (isPlatformFeeYearPath(path)) {
    const username = typeof actor === 'object' && actor ? actor.username : undefined;
    return isPlatformFeeYearAccount(username) ? 'allow' : 'home';
  }
  const allowed = isRouteAllowed(path, typeof actor === 'string' ? actor : (actor ?? null));
  if (canOpenMenuPath(menuRole, path) && allowed) return 'allow';
  if (!isPortal(path)) return allowed ? 'allow' : 'skip';
  if (adminArea && !allowed) return 'forbidden';
  return 'home';
}

function assertUniqueMenus(): void {
  (Object.keys(ROLE_MENUS) as MenuRole[]).forEach((role) => {
    const hrefs = menuHrefs(role);
    const dupes = hrefs.filter((href, index) => hrefs.indexOf(href) !== index);
    if (dupes.length > 0) {
      throw new Error(`duplicate ${role} menu hrefs: ${dupes.join(', ')}`);
    }
    const bar = TOP_BAR[role];
    for (const href of [bar.home, bar.profile, bar.messages]) {
      if (!hrefs.includes(href)) {
        throw new Error(`${role} top bar ${href} is missing from the web menu`);
      }
    }
  });
  for (const href of Object.values(CUSTOMER_TILE_HREFS)) {
    if (!menuHrefs('customer').includes(href)) {
      throw new Error(`customer tile ${href} is missing from the web menu`);
    }
  }
}

assertUniqueMenus();
