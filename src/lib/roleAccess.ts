/** Which roles may access each top-level route prefix. Mirrors the edge proxy. */
export const ROUTE_ROLES: Record<string, string[]> = {
  '/admin': ['admin', 'superadmin'],
  '/superadmin': ['superadmin'],
  '/shop': ['shop', 'tech', 'manager', 'superadmin'],
  '/tech': ['tech', 'superadmin'],
  '/customer': ['customer', 'superadmin'],
  '/manager': ['manager', 'superadmin'],
  '/workorders': ['shop', 'manager', 'tech', 'superadmin'],
  '/reports': ['admin', 'shop', 'manager', 'superadmin'],
};

export function rolesForPath(pathname: string): string[] | null {
  const entry = Object.entries(ROUTE_ROLES).find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return entry ? entry[1] : null;
}

/** Unprotected paths are allowed. A missing role is not allowed on a protected path. */
export function isRoleAllowed(pathname: string, role: string | undefined | null): boolean {
  const allowed = rolesForPath(pathname);
  if (!allowed) return true;
  if (!role) return false;
  return allowed.includes(role);
}

export function forbiddenFromPath(pathname: string): string {
  return `/forbidden?from=${encodeURIComponent(pathname)}`;
}
