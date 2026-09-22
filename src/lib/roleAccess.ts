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

export type RouteActor = {
  role?: string | null;
  isOwner?: boolean;
  isSuperAdmin?: boolean;
};

/**
 * Page gates that list `superadmin` also admit the platform owner and the
 * superadmin flag. Admin login stores role `admin` even when the token is the
 * owner (isOwner) or a superadmin, which otherwise 403s `/superadmin/tenants`.
 * The flag does not elevate shop, tech, or customer roles.
 */
export function actorSatisfiesRoles(
  actor: RouteActor | null | undefined,
  requiredRoles?: string[] | null,
): boolean {
  if (!requiredRoles || requiredRoles.length === 0) return true;
  if (!actor) return false;
  if (actor.role && requiredRoles.includes(actor.role)) return true;
  if (!requiredRoles.includes('superadmin')) return false;
  const platformOperator = actor.role === 'admin' || actor.role === 'superadmin';
  if (!platformOperator) return false;
  return actor.isOwner === true || actor.isSuperAdmin === true;
}

export function isRouteAllowed(
  pathname: string,
  actor: RouteActor | string | null | undefined,
): boolean {
  if (typeof actor !== 'object' || actor === null) {
    return isRoleAllowed(pathname, actor);
  }
  if (isRoleAllowed(pathname, actor.role)) return true;
  const allowed = rolesForPath(pathname);
  if (!allowed) return true;
  return actorSatisfiesRoles(actor, allowed);
}

export function forbiddenFromPath(pathname: string): string {
  return `/forbidden?from=${encodeURIComponent(pathname)}`;
}
