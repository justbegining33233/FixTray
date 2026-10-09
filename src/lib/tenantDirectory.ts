export type DirectoryKind = 'shop' | 'employee' | 'customer';

export type DirectoryBadge = 'Shop' | 'Manager' | 'Tech' | 'Accountant' | 'Customer';

export function employeeBadge(role: string | null | undefined): DirectoryBadge {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'manager') return 'Manager';
  if (normalized === 'accountant') return 'Accountant';
  return 'Tech';
}

export function directoryBadge(kind: DirectoryKind, role?: string | null): DirectoryBadge {
  if (kind === 'shop') return 'Shop';
  if (kind === 'customer') return 'Customer';
  return employeeBadge(role);
}

/** Walk-in customers are customers, never shops with "No owner". */
export function isCustomerRecord(kind: string | null | undefined): boolean {
  return String(kind || '').trim().toLowerCase() === 'customer';
}

export function splitDirectory<T extends { kind: DirectoryKind }>(rows: T[]) {
  return {
    shops: rows.filter((row) => row.kind === 'shop'),
    employees: rows.filter((row) => row.kind === 'employee'),
    customers: rows.filter((row) => row.kind === 'customer'),
  };
}
