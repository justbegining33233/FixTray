/**
 * Role-correct targets for shell links that otherwise 403.
 * Shop keeps its own pages. A manager using the shop calendar shell
 * (Switch View / New / footer / sidebar) is sent to manager-owned surfaces.
 */

import { forbiddenFromPath } from './roleAccess';

export const SHOP_JOBS_HREF = '/shop/jobs';

/** Shop-switch targets that 403 a manager: Jobs/Ops, Estimates, DVI, Auth. */
export const MANAGER_SHOP_SWITCH_PATHS = [
  '/shop/home',
  '/shop/estimates',
  '/shop/dvi',
  '/shop/work-authorizations',
] as const;

const MANAGER_SHELL_HREFS: Record<string, string> = {
  '/shop/home': '/manager/dashboard',
  '/shop/jobs': '/manager/assignments',
  '/shop/estimates': '/manager/estimates',
  '/shop/dvi': '/manager/inspections',
  '/shop/work-authorizations': '/manager/work-authorizations',
  '/shop/customer-messages': '/manager/messages',
  '/shop/analytics': '/manager/reports',
  '/shop/admin': '/manager/home',
  '/tech/new-roadside-job': '/shop/new-roadside-job',
};

export function normalizeRole(role?: string | null): string {
  return (role || '').trim().toLowerCase();
}

function splitHref(href: string): { path: string; query: string } {
  const queryIndex = href.indexOf('?');
  const rawPath = queryIndex === -1 ? href : href.slice(0, queryIndex);
  const query = queryIndex === -1 ? '' : href.slice(queryIndex);
  const path = rawPath.replace(/\/+$/, '') || '/';
  return { path, query };
}

export function shellHrefForRole(href: string, role?: string | null): string {
  const { path, query } = splitHref(href);
  const actor = normalizeRole(role);

  if (actor === 'manager') {
    const mapped = MANAGER_SHELL_HREFS[path];
    if (mapped) return `${mapped}${query}`;
  }

  if (actor !== 'tech' && path === '/tech/new-roadside-job') {
    return `/shop/new-roadside-job${query}`;
  }

  return href;
}

/**
 * Manager-owned page for a shop path the manager cannot open.
 * Null when this role should stay on the requested path.
 */
export function managerShopRedirect(href: string, role?: string | null): string | null {
  if (normalizeRole(role) !== 'manager') return null;
  const { path } = splitHref(href);
  const dest = shellHrefForRole(path, 'manager');
  return dest === path ? null : dest;
}

/** Forbidden page, or the manager-owned equivalent when one exists. */
export function roleDeniedRedirect(pathname: string, role?: string | null): string {
  const owned = managerShopRedirect(pathname, role);
  if (owned) return owned;
  const { path } = splitHref(pathname);
  return forbiddenFromPath(path);
}

export function roleFromAccessToken(token?: string | null): string | null {
  if (!token) return null;
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.length % 4 === 0 ? base64 : base64 + '='.repeat(4 - (base64.length % 4));
    const decoded = typeof atob === 'function'
      ? atob(padded)
      : Buffer.from(padded, 'base64').toString('utf8');
    const json = JSON.parse(decoded) as { role?: unknown };
    return typeof json.role === 'string' ? json.role : null;
  } catch {
    return null;
  }
}

/** Token wins over a stale stored role or the shop shell's hardcoded role. */
export function actorRoleForShell(sources: {
  tokenRole?: string | null;
  userRole?: string | null;
  storedRole?: string | null;
  shellRole?: string | null;
}): string {
  return (
    normalizeRole(sources.tokenRole) ||
    normalizeRole(sources.userRole) ||
    normalizeRole(sources.storedRole) ||
    normalizeRole(sources.shellRole)
  );
}

export function readClientActorRole(userRole?: string | null, shellRole?: string | null): string {
  if (typeof window === 'undefined') {
    return actorRoleForShell({ userRole, shellRole });
  }
  return actorRoleForShell({
    tokenRole: roleFromAccessToken(localStorage.getItem('token')),
    userRole,
    storedRole: localStorage.getItem('userRole'),
    shellRole,
  });
}
