export type MessageContact = {
  id: string;
  name: string;
  role: string;
  shopId: string;
  contextLabel: string;
};

export function mapFixTrayAdminContacts(
  admins: Array<{ id: string; username?: string | null; email?: string | null; isSuperAdmin?: boolean }>,
  currentUserId?: string,
): MessageContact[] {
  return admins
    .filter((admin) => admin.id !== currentUserId)
    .map((admin) => ({
      id: admin.id,
      name: admin.username || admin.email || 'FixTray staff',
      role: admin.isSuperAdmin ? 'superadmin' : 'admin',
      shopId: '',
      contextLabel: admin.isSuperAdmin ? 'FixTray Super Admin' : 'FixTray Employee',
    }));
}

export function mapShopStaffContacts(
  staff: Array<{ id: string; firstName: string; lastName: string; role: string; shopId: string }>,
  currentUserId?: string,
): MessageContact[] {
  return staff
    .filter((member) => member.id !== currentUserId)
    .map((member) => ({
      id: member.id,
      name: `${member.firstName} ${member.lastName}`.trim(),
      role: member.role,
      shopId: member.shopId,
      contextLabel: member.role === 'manager' ? 'Shop Manager' : 'Shop Technician',
    }));
}

export function mapShopEntityContact(
  shop: { id: string; shopName: string } | null,
  currentUserId?: string,
): MessageContact[] {
  if (!shop || shop.id === currentUserId) return [];
  return [{
    id: shop.id,
    name: shop.shopName,
    role: 'shop',
    shopId: shop.id,
    contextLabel: 'Shop',
  }];
}

export function mapCustomerContacts(
  customers: Array<{ id: string; firstName: string; lastName: string }>,
  shopId: string,
): MessageContact[] {
  return customers.map((customer) => ({
    id: customer.id,
    name: `${customer.firstName} ${customer.lastName}`.trim(),
    role: 'customer',
    shopId,
    contextLabel: 'Shop Customer',
  }));
}

export function canShopStaffMessageRole(receiverRole: string): boolean {
  return ['customer', 'shop', 'manager', 'tech', 'admin', 'superadmin'].includes(receiverRole);
}
