import prisma from '@/lib/prisma';
import { ROLE_CACHE_CAPS } from './offlineSafety';
import { shapeOfflineJob } from './offlineBundleShape';
import { ACTIVE_WORK_ORDER_STATUSES } from './workOrderMetrics';

const ACTIVE = [...ACTIVE_WORK_ORDER_STATUSES, 'en-route'];

const jobSelect = {
  id: true,
  status: true,
  paymentStatus: true,
  updatedAt: true,
  dueDate: true,
  issueDescription: true,
  serviceLocation: true,
  vehicleType: true,
  location: true,
  techLabor: true,
  partsUsed: true,
  workPhotos: true,
  completion: true,
  customerId: true,
  shopId: true,
  assignedTechId: true,
  customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
  vehicle: {
    select: { id: true, year: true, make: true, model: true, licensePlate: true, vin: true, vehicleType: true },
  },
  messages: {
    orderBy: { createdAt: 'desc' as const },
    take: 30,
    select: {
      id: true,
      sender: true,
      senderName: true,
      body: true,
      attachmentUrl: true,
      createdAt: true,
      clientMutationId: true,
    },
  },
};

function startOfToday(): Date {
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  return day;
}

async function shopCatalog(shopId: string, take: number) {
  const [settings, laborRates, catalog] = await Promise.all([
    prisma.shopSettings.findUnique({ where: { shopId }, select: { defaultLaborRate: true } }),
    prisma.shopLaborRate.findMany({
      where: { shopId },
      take: 40,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, rate: true, category: true },
    }),
    prisma.inventoryItem.findMany({
      where: { shopId },
      take,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, sku: true, price: true, rate: true, type: true },
    }),
  ]);
  return { laborRate: settings?.defaultLaborRate ?? 0, laborRates, catalog };
}

export async function loadOfflineBundle(auth: { id: string; role: string; shopId?: string }) {
  const role = auth.role === 'admin' ? 'superadmin' : auth.role;
  const cap = ROLE_CACHE_CAPS[role as keyof typeof ROLE_CACHE_CAPS] || ROLE_CACHE_CAPS.customer;
  const fetchedAt = new Date().toISOString();

  if (role === 'superadmin') {
    const shops = await prisma.shop.findMany({
      take: ROLE_CACHE_CAPS.superadmin.shops,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, shopName: true, city: true, state: true, status: true },
    });
    const workOrders = await prisma.workOrder.findMany({
      where: { status: { in: ACTIVE } },
      orderBy: { updatedAt: 'desc' },
      take: cap.jobs,
      select: jobSelect,
    });
    return {
      role,
      userId: auth.id,
      fetchedAt,
      shops,
      laborRate: 0,
      laborRates: [],
      catalog: [],
      workOrders: workOrders.map((row) => shapeOfflineJob(row, { strictPrep: false, catalog: [], laborRate: null })),
    };
  }

  if (role === 'customer') {
    const workOrders = await prisma.workOrder.findMany({
      where: { customerId: auth.id },
      orderBy: { updatedAt: 'desc' },
      take: cap.jobs,
      select: jobSelect,
    });
    return {
      role,
      userId: auth.id,
      fetchedAt,
      shops: [],
      laborRate: 0,
      laborRates: [],
      catalog: [],
      workOrders: workOrders.map((row) => shapeOfflineJob(row, { strictPrep: false, catalog: [], laborRate: null })),
    };
  }

  let shopId = role === 'shop' ? (auth.shopId || auth.id) : (auth.shopId || '');
  let techName = '';
  let clock = null;
  if (role === 'tech' || role === 'manager') {
    const tech = await prisma.tech.findUnique({
      where: { id: auth.id },
      select: { id: true, shopId: true, firstName: true, lastName: true },
    });
    if (!tech) return null;
    shopId = tech.shopId;
    techName = `${tech.firstName} ${tech.lastName}`.trim();
    clock = await prisma.timeEntry.findFirst({
      where: { techId: tech.id, clockOut: null },
      orderBy: { clockIn: 'desc' },
      select: { id: true, clockIn: true, notes: true, workOrderId: true, clientMutationId: true },
    });
  }

  const today = startOfToday();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const where = role === 'tech'
    ? {
        shopId,
        assignedTechId: auth.id,
        OR: [
          { status: { in: ACTIVE } },
          { status: 'assigned', dueDate: { gte: today, lt: tomorrow } },
        ],
      }
    : { shopId, status: { in: ACTIVE } };

  const [rows, rates] = await Promise.all([
    prisma.workOrder.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: cap.jobs,
      select: jobSelect,
    }),
    shopCatalog(shopId, cap.catalog),
  ]);

  return {
    role,
    userId: auth.id,
    shopId,
    techName,
    clock,
    fetchedAt,
    shops: [],
    laborRate: rates.laborRate,
    laborRates: rates.laborRates,
    catalog: rates.catalog,
    workOrders: rows.map((row) => shapeOfflineJob(row, {
      strictPrep: role === 'tech' || role === 'manager',
      laborRate: rates.laborRate,
      laborRates: rates.laborRates,
      catalog: rates.catalog,
    })),
  };
}
