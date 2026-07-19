/**
 * Centralized role configuration
 * Single source of truth for role-related constants and mappings
 * Phase 3: Consolidate duplicate ROLE_HOME definitions (was in useRequireAuth.ts and middleware.ts)
 */

/**
 * Where each role's default home page is located.
 * Used for redirects after login and unauthorized access.
 */
export const ROLE_HOME: Record<string, string> = {
  admin: '/admin/home',
  superadmin: '/admin/home',
  shop: '/shop/admin',
  manager: '/manager/home',
  tech: '/tech/home',
  customer: '/customer/dashboard',
};

/**
 * User roles in the system
 */
export type UserRole = 'customer' | 'tech' | 'manager' | 'admin' | 'shop' | 'superadmin';

/**
 * Roles that require business verification
 */
export const VERIFIED_ROLES: UserRole[] = ['shop', 'tech', 'manager'];

/**
 * Roles that can access admin features
 */
export const ADMIN_ROLES: UserRole[] = ['admin', 'superadmin'];

/**
 * Role hierarchy for permission checks
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  customer: 1,
  tech: 2,
  manager: 3,
  shop: 4,
  admin: 5,
  superadmin: 6,
};
