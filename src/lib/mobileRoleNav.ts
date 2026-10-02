/**
 * Phone tab bars for every FixTray role.
 * Tabs plus More are built from the same role menu as the computer sidebar
 * (src/lib/roleMenus.ts), so the two views list the same pages.
 * Super Admin tabs are returned only for a superadmin actor.
 */

import { normalizeRole } from '@/lib/roleNav';
import { isShopScopedHref } from '@/lib/platformOwnerScope';
import { isShopEdgeSensitivePath } from '@/lib/shopRestrictedRoutes';
import { isPlatformEmailAccount, PLATFORM_EMAIL_HREF } from '@/lib/platformEmailAccess';
import { ROLE_MENUS, TOP_BAR, menuHrefs, type MenuRole } from '@/lib/roleMenus';

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

type Actor = { role?: string | null; isSuperAdmin?: boolean | null; isOwner?: boolean | null; username?: string | null } | null | undefined;

function withPlatformEmailLink(nav: MobileRoleNav, username?: string | null): MobileRoleNav {
  if (!isPlatformEmailAccount(username)) return nav;
  const item: MobileLink = { label: 'Emails', href: PLATFORM_EMAIL_HREF, icon: 'bell' };
  let placed = false;
  const more = nav.more.map((group) => {
    if (group.title !== 'Communications') return group;
    if (group.items.some((entry) => entry.href === item.href)) return group;
    placed = true;
    return { ...group, items: [...group.items, item] };
  });
  return {
    ...nav,
    more: placed ? more : [...more, { title: 'Communications', items: [item] }],
  };
}

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

/** Sessions, API keys, health, and the other shop-edge pages stay off shop menus. */
export function withoutShopEdgeSensitiveLinks(nav: MobileRoleNav): MobileRoleNav {
  return {
    ...nav,
    tabs: nav.tabs.filter((tab) => !isShopEdgeSensitivePath(tab.href)),
    more: nav.more
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => !isShopEdgeSensitivePath(item.href)),
      }))
      .filter((group) => group.items.length > 0),
  };
}

/** Platform owner menus never list shop-operational pages. */
export function withoutShopLinks(nav: MobileRoleNav): MobileRoleNav {
  return {
    ...nav,
    tabs: nav.tabs.filter((tab) => !isShopScopedHref(tab.href)),
    more: nav.more
      .map((group) => ({ ...group, items: group.items.filter((item) => !isShopScopedHref(item.href)) }))
      .filter((group) => group.items.length > 0),
  };
}

function buildNav(role: MenuRole, spec: {
  roleLabel: string;
  homeHref: string;
  messagesHref: string;
  tabs: MobileTab[];
}): MobileRoleNav {
  const hrefs = new Set(menuHrefs(role));
  for (const tab of spec.tabs) {
    if (!hrefs.has(tab.href)) {
      throw new Error(`${role} tab ${tab.label} (${tab.href}) is not in the web menu`);
    }
  }
  const tabHrefs = new Set(spec.tabs.map((tab) => tab.href));
  const more = ROLE_MENUS[role]
    .map((group) => ({
      title: group.label,
      items: group.items
        .filter((item) => !tabHrefs.has(item.href))
        .map((item) => ({ label: item.label, href: item.href, icon: item.icon as MobileIconName })),
    }))
    .filter((group) => group.items.length > 0);
  return {
    id: role,
    roleLabel: spec.roleLabel,
    homeHref: spec.homeHref,
    messagesHref: spec.messagesHref,
    superadminOnly: role === 'superadmin',
    tabs: spec.tabs,
    more,
  };
}

const superadminNav = buildNav('superadmin', {
  roleLabel: 'Super Admin',
  homeHref: TOP_BAR.superadmin.home,
  messagesHref: TOP_BAR.superadmin.messages,
  tabs: [
    { label: 'Overview', href: '/admin/home', icon: 'home', match: ['/admin/home'] },
    { label: 'Shops', href: '/admin/shops', icon: 'grid', match: ['/admin/shops', '/admin/shops/*', '/admin/pending-shops', '/admin/accepted-shops', '/admin/shop-details/*'] },
    { label: 'Customers', href: '/admin/manage-customers', icon: 'user', match: ['/admin/manage-customers', '/admin/manage-customers/*'] },
    { label: 'Analytics', href: '/admin/platform-analytics', icon: 'chart', match: ['/admin/platform-analytics', '/admin/platform-analytics/*'] },
  ],
});

const shopNav = withoutShopEdgeSensitiveLinks(buildNav('shop', {
  roleLabel: 'Shop Owner',
  homeHref: '/shop/home',
  messagesHref: TOP_BAR.shop.messages,
  tabs: [
    { label: 'Home', href: '/shop/home', icon: 'home', match: ['/shop/home', '/shop'] },
    { label: 'Orders', href: '/shop/jobs', icon: 'orders', match: ['/shop/jobs', '/shop/jobs/*', '/workorders/*'] },
    { label: 'Messages', href: '/shop/customer-messages', icon: 'messages', match: ['/shop/customer-messages', '/shop/customer-messages/*'] },
    { label: 'Team', href: '/shop/manage-team', icon: 'team', match: ['/shop/manage-team', '/shop/manage-team/*'] },
  ],
}));

const managerNav = buildNav('manager', {
  roleLabel: 'Manager',
  homeHref: TOP_BAR.manager.home,
  messagesHref: TOP_BAR.manager.messages,
  tabs: [
    { label: 'Home', href: '/manager/home', icon: 'home', match: ['/manager/home', '/manager'] },
    { label: 'Assign', href: '/manager/assignments', icon: 'clipboard', match: ['/manager/assignments', '/manager/assignments/*', '/workorders/*'] },
    { label: 'Team', href: '/manager/team', icon: 'team', match: ['/manager/team', '/manager/team/*'] },
    { label: 'Messages', href: '/manager/messages', icon: 'messages', match: ['/manager/messages', '/manager/messages/*'] },
  ],
});

const techNav = buildNav('tech', {
  roleLabel: 'Technician',
  homeHref: TOP_BAR.tech.home,
  messagesHref: TOP_BAR.tech.messages,
  tabs: [
    { label: 'Home', href: '/tech/home', icon: 'home', match: ['/tech/home', '/tech'] },
    { label: 'My Jobs', href: '/tech/jobs?view=active', icon: 'clipboard', match: ['/tech/jobs', '/tech/jobs/*', '/tech/work-orders/*', '/workorders/*'] },
    { label: 'Clock', href: '/tech/timeclock', icon: 'clock', match: ['/tech/timeclock'] },
    { label: 'Messages', href: '/tech/messages', icon: 'messages', match: ['/tech/messages', '/tech/messages/*'] },
  ],
});

const customerNav = buildNav('customer', {
  roleLabel: 'Customer',
  homeHref: TOP_BAR.customer.home,
  messagesHref: TOP_BAR.customer.messages,
  tabs: [
    { label: 'Home', href: '/customer/dashboard', icon: 'home', match: ['/customer/dashboard', '/customer/home', '/customer'] },
    { label: 'Appts', href: '/customer/appointments', icon: 'calendar', match: ['/customer/appointments', '/customer/appointments/*'] },
    { label: 'Repairs', href: '/customer/history', icon: 'wrench', match: ['/customer/history', '/customer/workorders', '/customer/workorders/*'] },
    { label: 'Chat', href: '/customer/messages', icon: 'messages', match: ['/customer/messages', '/customer/messages/*'] },
  ],
});

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
    return withPlatformEmailLink(
      withoutShopLinks(withoutOwnerOnlyLinks(MOBILE_ROLE_NAVS.superadmin, actor?.isOwner === true)),
      actor?.username,
    );
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
