/**
 * User Management lists customers, shop members (tech and manager), shop
 * owners, and platform staff. System Status uses this same total.
 * Staff accounts are users on that list. They are not a separate hidden set.
 */
export function managedUserTotal(counts: {
  customers?: number | null;
  shopMembers?: number | null;
  shops?: number | null;
  staff?: number | null;
}): number {
  const customers = finite(counts.customers);
  const shopMembers = finite(counts.shopMembers);
  const shops = finite(counts.shops);
  const staff = finite(counts.staff);
  return customers + shopMembers + shops + staff;
}

function finite(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export type ManagedUserRow = {
  role?: string | null;
  userType?: string | null;
  isSuperAdmin?: boolean | null;
};

export type ManagedRoleCounts = {
  total: number;
  admin: number;
  staff: number;
  shop: number;
  manager: number;
  technician: number;
  customer: number;
  other: number;
};

function roleKey(value?: string | null): string {
  return String(value || '').trim().toLowerCase();
}

/**
 * Platform staff are admin accounts, including Super Admin staff.
 * A shop manager is not staff. Super Admin stays on the staff account.
 */
export function isPlatformStaffAccount(user: ManagedUserRow): boolean {
  const role = roleKey(user.role);
  const userType = roleKey(user.userType);
  if (role === 'staff' || role === 'superadmin' || userType === 'staff' || userType === 'superadmin') return true;
  return user.isSuperAdmin === true && (role === 'admin' || userType === 'admin');
}

/** Badge text. Super Admin stays on staff accounts that have it. */
export function accountRoleLabel(user: ManagedUserRow): string {
  if (user.isSuperAdmin === true || roleKey(user.role) === 'superadmin' || roleKey(user.userType) === 'superadmin') {
    return 'Super Admin';
  }
  return roleKey(user.role || user.userType).toUpperCase();
}

/**
 * Every listed user is in one bucket. The cards User Management shows
 * were admin, shop, technician, and customer, so managers and platform
 * staff were in the total and missing from the sum.
 */
export function managedRoleCounts(users: ManagedUserRow[]): ManagedRoleCounts {
  const counts: ManagedRoleCounts = {
    total: users.length,
    admin: 0,
    staff: 0,
    shop: 0,
    manager: 0,
    technician: 0,
    customer: 0,
    other: 0,
  };
  for (const user of users) {
    if (isPlatformStaffAccount(user)) {
      counts.staff += 1;
      continue;
    }
    const role = roleKey(user.role || user.userType);
    if (role === 'admin') counts.admin += 1;
    else if (role === 'shop') counts.shop += 1;
    else if (role === 'manager') counts.manager += 1;
    else if (role === 'tech' || role === 'technician') counts.technician += 1;
    else if (role === 'customer') counts.customer += 1;
    else counts.other += 1;
  }
  return counts;
}

export function roleCountsMatchList(counts: ManagedRoleCounts): boolean {
  return counts.admin + counts.staff + counts.shop + counts.manager + counts.technician + counts.customer + counts.other === counts.total;
}
