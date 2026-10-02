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
