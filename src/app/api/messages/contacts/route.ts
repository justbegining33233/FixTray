import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

/**
 * GET /api/messages/contacts
 *
 * Messaging policy:
 * - Admin / superadmin can message all users.
 * - Shop-side roles (shop / manager / tech) can message their own customers + FixTray staff.
 * - Customers can message approved shops + FixTray staff.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { role } = decoded;
    if (!['customer', 'shop', 'manager', 'tech', 'admin', 'superadmin'].includes(role)) {
      return NextResponse.json({ error: 'Unknown role' }, { status: 400 });
    }

    if (role === 'admin' || role === 'superadmin') {
      return getAdminContacts(decoded.id);
    }

    if (role === 'shop' || role === 'manager' || role === 'tech') {
      return NextResponse.json({ contacts: await getShopScopedContacts(decoded.id, role) });
    }

    if (role === 'customer') {
      return NextResponse.json({ contacts: await getCustomerScopedContacts(decoded.id) });
    }

    return NextResponse.json({ contacts: await getFixTrayContacts(decoded.id) });
  } catch (error) {
    console.error('Error fetching message contacts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── Admin contacts ───────────────────────────────────────────────────────────

async function getAdminContacts(currentUserId?: string) {
  try {
    const [shops, staff, customers, admins] = await Promise.all([
      prisma.shop.findMany({
        where: { status: 'approved' },
        select: { id: true, shopName: true },
        orderBy: { shopName: 'asc' },
      }),
      prisma.tech.findMany({
        where: { terminatedAt: null },
        select: { id: true, firstName: true, lastName: true, role: true, shopId: true },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      }),
      prisma.customer.findMany({
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      }),
      prisma.admin.findMany({
        select: { id: true, username: true, email: true, isSuperAdmin: true },
        orderBy: [{ isSuperAdmin: 'desc' }, { username: 'asc' }],
      }),
    ]);

    const shopContacts = shops.map((s) => ({
      id: s.id,
      name: s.shopName,
      role: 'shop',
      shopId: s.id,
      contextLabel: 'Approved Shop',
    }));

    const staffContacts = staff.map((s) => ({
      id: s.id,
      name: `${s.firstName} ${s.lastName}`,
      role: s.role,
      shopId: s.shopId,
      contextLabel: 'Shop Staff',
    }));

    const customerContacts = customers.map((c) => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`,
      role: 'customer',
      shopId: '',
      contextLabel: 'Platform Customer',
    }));

    const adminContacts = admins
      .filter((a) => a.id !== currentUserId)
      .map((a) => ({
        id: a.id,
        name: a.username || a.email,
        role: a.isSuperAdmin ? 'superadmin' : 'admin',
        shopId: '',
        contextLabel: a.isSuperAdmin ? 'FixTray Super Admin' : 'FixTray Employee',
      }));

    const contacts = [...adminContacts, ...shopContacts, ...staffContacts, ...customerContacts];
    return NextResponse.json({ contacts });
  } catch (err) {
    console.error('Error fetching admin contacts:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function getFixTrayContacts(currentUserId?: string) {
  const admins = await prisma.admin.findMany({
    select: { id: true, username: true, email: true, isSuperAdmin: true },
    orderBy: [{ isSuperAdmin: 'desc' }, { username: 'asc' }],
  });

  return admins
    .filter((a) => a.id !== currentUserId)
    .map((a) => ({
      id: a.id,
      name: a.username || a.email,
      role: a.isSuperAdmin ? 'superadmin' : 'admin',
      shopId: '',
      contextLabel: a.isSuperAdmin ? 'FixTray Super Admin' : 'FixTray Employee',
    }));
}

async function getShopScopedContacts(currentUserId: string, role: string) {
  let shopId: string | null = null;

  if (role === 'shop') {
    shopId = currentUserId;
  } else {
    const staff = await prisma.tech.findUnique({
      where: { id: currentUserId },
      select: { shopId: true, terminatedAt: true },
    });

    if (!staff || staff.terminatedAt) {
      return await getFixTrayContacts(currentUserId);
    }

    shopId = staff.shopId;
  }

  const [customers, fixTrayContacts] = await Promise.all([
    prisma.customer.findMany({
      where: {
        workOrders: {
          some: {
            shopId,
          },
        },
      },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    }),
    getFixTrayContacts(currentUserId),
  ]);

  const customerContacts = customers.map((c) => ({
    id: c.id,
    name: `${c.firstName} ${c.lastName}`,
    role: 'customer',
    shopId: shopId || '',
    contextLabel: 'Shop Customer',
  }));

  return [...fixTrayContacts, ...customerContacts];
}

async function getCustomerScopedContacts(currentUserId: string) {
  const [shops, fixTrayContacts] = await Promise.all([
    prisma.shop.findMany({
      where: { status: 'approved' },
      select: { id: true, shopName: true },
      orderBy: { shopName: 'asc' },
    }),
    getFixTrayContacts(currentUserId),
  ]);

  const shopContacts = shops.map((s) => ({
    id: s.id,
    name: s.shopName,
    role: 'shop',
    shopId: s.id,
    contextLabel: 'Approved Shop',
  }));

  return [...fixTrayContacts, ...shopContacts];
}
