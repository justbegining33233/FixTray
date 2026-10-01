import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { sendEmail } from '@/lib/emailService';
import logger from '@/lib/logger';
import { rememberDemoShop } from '@/lib/demoShopLookup';
import {
  DEMO_DURATION_MS,
  DEMO_ENDED_MESSAGE,
  DEMO_FROM_EMAIL,
  DEMO_SHOP_NAME,
  DEMO_USERNAME_PREFIX,
  buildDemoLoginEmail,
  decideCustomerReset,
  decideDemoLogin,
  demoAccessExpiresIn,
  type DemoSessionClock,
} from '@/lib/demoShopRules';

export { DEMO_ENDED_MESSAGE, DEMO_DURATION_MS };

const DEMO_TABLE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "demo_sessions" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "seedCustomerId" TEXT,
    "firstLoginAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "resetAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "demo_sessions_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "demo_sessions_shopId_key" ON "demo_sessions"("shopId")`,
  `CREATE INDEX IF NOT EXISTS "demo_sessions_email_idx" ON "demo_sessions"("email")`,
  `CREATE INDEX IF NOT EXISTS "demo_sessions_expiresAt_idx" ON "demo_sessions"("expiresAt")`,
  `ALTER TABLE "portal_chat_messages" ADD COLUMN IF NOT EXISTS "shopId" TEXT`,
  `ALTER TABLE "portal_chat_messages" ADD COLUMN IF NOT EXISTS "actorId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "portal_chat_messages_shopId_idx" ON "portal_chat_messages"("shopId")`,
  `CREATE INDEX IF NOT EXISTS "portal_chat_messages_actorId_idx" ON "portal_chat_messages"("actorId")`,
] as const;

let tableReady: Promise<void> | null = null;

export function ensureDemoSessionTable(): Promise<void> {
  if (!process.env.DATABASE_URL) return Promise.resolve();
  if (!tableReady) {
    tableReady = applyDemoSessionTable().catch((error) => {
      tableReady = null;
      throw error;
    });
  }
  return tableReady;
}

async function applyDemoSessionTable(): Promise<void> {
  for (const statement of DEMO_TABLE_STATEMENTS) {
    await prisma.$executeRawUnsafe(statement);
  }
}

export type DemoLoginWindow =
  | { blocked: true; message: string }
  | { blocked: false; demo?: boolean; expiresIn?: number; sessionExpiresAt?: Date };

/**
 * Open or close the demo window for a shop login.
 * Real shops are not blocked when the demo table is unavailable.
 */
export async function demoLoginWindow(shopId: string, startClock: boolean, now = new Date()): Promise<DemoLoginWindow> {
  let session: DemoSessionClock | null = null;
  try {
    await ensureDemoSessionTable();
    const row = await prisma.demoSession.findUnique({
      where: { shopId },
      select: { firstLoginAt: true, expiresAt: true, resetAt: true },
    });
    session = row;
  } catch (error) {
    logger.error('[demo] could not read demo session', {
      shopId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { blocked: false };
  }

  const decision = decideDemoLogin(session, now, { startClock });
  if (decision.action === 'absent') return { blocked: false };
  if (decision.action === 'end') {
    try {
      await endDemoShop(shopId);
    } catch (error) {
      logger.error('[demo] reset failed', {
        shopId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return { blocked: true, message: DEMO_ENDED_MESSAGE };
  }
  if (decision.action === 'start') {
    await prisma.demoSession.update({
      where: { shopId },
      data: { firstLoginAt: decision.firstLoginAt, expiresAt: decision.expiresAt },
    });
    return {
      blocked: false,
      demo: true,
      expiresIn: demoAccessExpiresIn(decision.expiresAt, now),
      sessionExpiresAt: decision.expiresAt,
    };
  }
  if (!decision.expiresAt) return { blocked: false, demo: true };
  return {
    blocked: false,
    demo: true,
    expiresIn: demoAccessExpiresIn(decision.expiresAt, now),
    sessionExpiresAt: decision.expiresAt,
  };
}

export async function sweepExpiredDemos(now = new Date()): Promise<number> {
  await ensureDemoSessionTable();
  const due = await prisma.demoSession.findMany({
    where: { resetAt: null, expiresAt: { lte: now } },
    select: { shopId: true },
    take: 25,
  });
  let reset = 0;
  for (const row of due) {
    try {
      await endDemoShop(row.shopId);
      reset += 1;
    } catch (error) {
      logger.error('[demo] sweep failed', {
        shopId: row.shopId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return reset;
}

function appBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://fixtray.app';
  return raw.replace(/\/$/, '');
}

function randomToken(length: number): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2025';
}

async function bestEffort(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    logger.warn(`[demo] ${label} skipped`, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Rotate the password, clear shop records, and delete the demo shop. */
export async function endDemoShop(shopId: string): Promise<void> {
  await ensureDemoSessionTable();
  const session = await prisma.demoSession.findUnique({ where: { shopId } });
  if (!session || session.resetAt) return;

  await prisma.shop.update({
    where: { id: shopId },
    data: {
      password: crypto.randomBytes(24).toString('hex'),
      status: 'demo-ended',
    },
  }).catch((error) => {
    if (!isNotFound(error)) throw error;
  });

  await revokeDemoSessions(shopId);
  const wiped = await wipeDemoShop(shopId, session.createdAt, session.seedCustomerId);
  if (wiped) {
    await prisma.demoSession.update({
      where: { shopId },
      data: { resetAt: new Date() },
    });
  }
}

async function revokeDemoSessions(shopId: string): Promise<void> {
  const now = new Date();
  await bestEffort('revoke shop refresh', () => prisma.refreshToken.updateMany({
    where: { revoked: false, metadata: { contains: `"shopId":"${shopId}"` } },
    data: { revoked: true, revokedAt: now },
  }));
  const techs = await prisma.tech.findMany({ where: { shopId }, select: { id: true } }).catch(() => []);
  for (const tech of techs) {
    await bestEffort('revoke tech refresh', () => prisma.refreshToken.updateMany({
      where: { revoked: false, metadata: { contains: `"techId":"${tech.id}"` } },
      data: { revoked: true, revokedAt: now },
    }));
  }
}

function addId(target: Set<string>, id: string | null | undefined) {
  if (id) target.add(id);
}

async function collectDemoCustomerIds(shopId: string, seedCustomerId: string | null): Promise<{
  customerIds: Set<string>;
  workOrderIds: string[];
  appointmentIds: string[];
}> {
  const [
    workOrders,
    appointments,
    reviews,
    favorites,
    recurring,
    referrals,
    paymentLinks,
    inspections,
    dvis,
    reports,
  ] = await Promise.all([
    prisma.workOrder.findMany({ where: { shopId }, select: { id: true, customerId: true } }),
    prisma.appointment.findMany({ where: { shopId }, select: { id: true, customerId: true } }),
    prisma.review.findMany({ where: { shopId }, select: { customerId: true } }),
    prisma.favoriteShop.findMany({ where: { shopId }, select: { customerId: true } }),
    prisma.recurringWorkOrder.findMany({ where: { shopId }, select: { customerId: true } }),
    prisma.referral.findMany({ where: { shopId }, select: { referrerCustomerId: true, referredCustomerId: true } }),
    prisma.paymentLink.findMany({ where: { shopId }, select: { customerId: true } }),
    prisma.stateInspection.findMany({ where: { shopId }, select: { customerId: true } }),
    prisma.dVIInspection.findMany({ where: { shopId }, select: { customerId: true } }),
    prisma.vehicleConditionReport.findMany({ where: { shopId }, select: { customerId: true } }),
  ]);

  const customerIds = new Set<string>();
  addId(customerIds, seedCustomerId);
  for (const row of workOrders) addId(customerIds, row.customerId);
  for (const row of appointments) addId(customerIds, row.customerId);
  for (const row of reviews) addId(customerIds, row.customerId);
  for (const row of favorites) addId(customerIds, row.customerId);
  for (const row of recurring) addId(customerIds, row.customerId);
  for (const row of referrals) {
    addId(customerIds, row.referrerCustomerId);
    addId(customerIds, row.referredCustomerId);
  }
  for (const row of paymentLinks) addId(customerIds, row.customerId);
  for (const row of inspections) addId(customerIds, row.customerId);
  for (const row of dvis) addId(customerIds, row.customerId);
  for (const row of reports) addId(customerIds, row.customerId);

  return {
    customerIds,
    workOrderIds: workOrders.map((row) => row.id),
    appointmentIds: appointments.map((row) => row.id),
  };
}

async function wipeDemoShop(shopId: string, sessionCreatedAt: Date, seedCustomerId: string | null): Promise<boolean> {
  let linked: { customerIds: Set<string>; workOrderIds: string[]; appointmentIds: string[] };
  try {
    linked = await collectDemoCustomerIds(shopId, seedCustomerId);
  } catch (error) {
    logger.error('[demo] could not list demo customers', {
      shopId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
  const { customerIds, workOrderIds, appointmentIds } = linked;

  const techs = await prisma.tech.findMany({ where: { shopId }, select: { id: true } }).catch(() => []);
  const techIds = techs.map((row) => row.id);

  let requiredOk = true;
  try {
    const actorIds = [shopId, ...techIds];
    await prisma.portalChatMessage.deleteMany({
      where: {
        OR: [
          { shopId },
          { actorId: { in: actorIds } },
        ],
      },
    });
    const noteOr: Array<{ workOrderId?: { in: string[] }; appointmentId?: { in: string[] } }> = [];
    if (workOrderIds.length > 0) noteOr.push({ workOrderId: { in: workOrderIds } });
    if (appointmentIds.length > 0) noteOr.push({ appointmentId: { in: appointmentIds } });
    if (noteOr.length > 0) {
      await prisma.notification.deleteMany({ where: { OR: noteOr } });
    }
    if (workOrderIds.length > 0) {
      await prisma.customerDocument.deleteMany({ where: { workOrderId: { in: workOrderIds } } });
    }
    await prisma.favoriteShop.deleteMany({ where: { shopId } });
  } catch (error) {
    requiredOk = false;
    logger.error('[demo] required demo cleanup failed', {
      shopId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (workOrderIds.length > 0) {
    await bestEffort('refunds', () => prisma.refund.deleteMany({ where: { workOrderId: { in: workOrderIds } } }));
    await bestEffort('photos', () => prisma.photo.deleteMany({ where: { workOrderId: { in: workOrderIds } } }));
    await bestEffort('sync receipts', () => prisma.syncReceipt.deleteMany({ where: { workOrderId: { in: workOrderIds } } }));
    await bestEffort('location pings', () => prisma.techLocationPing.deleteMany({ where: { workOrderId: { in: workOrderIds } } }));
    await bestEffort('dtc lookups', () => prisma.dTCLookup.deleteMany({ where: { workOrderId: { in: workOrderIds } } }));
  }
  if (techIds.length > 0) {
    await bestEffort('tech location pings', () => prisma.techLocationPing.deleteMany({ where: { techId: { in: techIds } } }));
    await bestEffort('tech sync receipts', () => prisma.syncReceipt.deleteMany({ where: { techId: { in: techIds } } }));
  }

  await bestEffort('seen alerts', () => prisma.seenWorkOrderAlert.deleteMany({ where: { shopId } }));
  await bestEffort('activity logs', () => prisma.activityLog.deleteMany({ where: { shopId } }));
  await bestEffort('audit logs', () => prisma.auditLog.deleteMany({ where: { shopId } }));
  await bestEffort('direct messages', () => prisma.directMessage.deleteMany({ where: { shopId } }));
  await bestEffort('inventory requests', () => prisma.inventoryRequest.deleteMany({ where: { shopId } }));
  await bestEffort('api keys', () => prisma.apiKey.deleteMany({ where: { shopId } }));
  await bestEffort('webhooks', () => prisma.webhook.deleteMany({ where: { shopId } }));
  await bestEffort('permissions', () => prisma.permission.deleteMany({ where: { shopId } }));
  await bestEffort('dtc by shop', () => prisma.dTCLookup.deleteMany({ where: { shopId } }));

  await bestEffort('work orders', () => prisma.workOrder.deleteMany({ where: { shopId } }));
  await bestEffort('recurring work orders', () => prisma.recurringWorkOrder.deleteMany({ where: { shopId } }));
  await bestEffort('bays', () => prisma.bay.deleteMany({ where: { shopId } }));
  await bestEffort('loaners', () => prisma.loanerVehicle.deleteMany({ where: { shopId } }));
  await bestEffort('fleet accounts', () => prisma.fleetAccount.deleteMany({ where: { shopId } }));
  await bestEffort('core returns', () => prisma.coreReturn.deleteMany({ where: { shopId } }));
  await bestEffort('inspections', () => prisma.dVIInspection.deleteMany({ where: { shopId } }));
  await bestEffort('automation rules', () => prisma.automationRule.deleteMany({ where: { shopId } }));
  await bestEffort('referrals', () => prisma.referral.deleteMany({ where: { shopId } }));
  await bestEffort('state inspections', () => prisma.stateInspection.deleteMany({ where: { shopId } }));
  await bestEffort('environmental fees', () => prisma.environmentalFee.deleteMany({ where: { shopId } }));
  await bestEffort('tax rules', () => prisma.taxRule.deleteMany({ where: { shopId } }));
  await bestEffort('integrations', () => prisma.integrationConfig.deleteMany({ where: { shopId } }));
  await bestEffort('payment links', () => prisma.paymentLink.deleteMany({ where: { shopId } }));

  let shopRemoved = false;
  try {
    await prisma.shop.delete({ where: { id: shopId } });
    shopRemoved = true;
  } catch (error) {
    if (isNotFound(error)) {
      shopRemoved = true;
    } else {
      logger.error('[demo] shop delete failed after password reset', {
        shopId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const customersOk = await resetDemoCustomers([...customerIds], sessionCreatedAt, seedCustomerId);
  return shopRemoved && requiredOk && customersOk;
}

async function otherShopTies(customerId: string): Promise<number> {
  const [jobs, appointments, favorites, reviews, recurring, referrals, links] = await Promise.all([
    prisma.workOrder.count({ where: { customerId } }),
    prisma.appointment.count({ where: { customerId } }),
    prisma.favoriteShop.count({ where: { customerId } }),
    prisma.review.count({ where: { customerId } }),
    prisma.recurringWorkOrder.count({ where: { customerId } }),
    prisma.referral.count({
      where: { OR: [{ referrerCustomerId: customerId }, { referredCustomerId: customerId }] },
    }),
    prisma.paymentLink.count({ where: { customerId } }),
  ]);
  return jobs + appointments + favorites + reviews + recurring + referrals + links;
}

async function detachDemoVehicles(customerId: string, sessionCreatedAt: Date): Promise<void> {
  const vehicles = await prisma.vehicle.findMany({
    where: { customerId, createdAt: { gte: sessionCreatedAt } },
    select: { id: true },
  });
  for (const vehicle of vehicles) {
    const [jobs, appointments, recurring] = await Promise.all([
      prisma.workOrder.count({ where: { vehicleId: vehicle.id } }),
      prisma.appointment.count({ where: { vehicleId: vehicle.id } }),
      prisma.recurringWorkOrder.count({ where: { vehicleId: vehicle.id } }),
    ]);
    if (jobs === 0 && appointments === 0 && recurring === 0) {
      await prisma.vehicle.delete({ where: { id: vehicle.id } });
    }
  }
}

/**
 * Delete customers that exist only for this demo.
 * A customer created before the demo is detached (demo vehicles only) and kept.
 * A failed delete leaves the session unfinished so the sweep tries again.
 */
async function resetDemoCustomers(
  customerIds: string[],
  sessionCreatedAt: Date,
  seedCustomerId: string | null,
): Promise<boolean> {
  try {
    for (const id of customerIds) {
      const customer = await prisma.customer.findUnique({
        where: { id },
        select: { id: true, createdAt: true },
      });
      if (!customer) continue;
      const ties = await otherShopTies(id);
      const decision = decideCustomerReset({
        createdAt: customer.createdAt,
        sessionCreatedAt,
        isSeed: customer.id === seedCustomerId,
        otherShopTies: ties,
      });
      if (decision === 'detach') {
        await detachDemoVehicles(id, sessionCreatedAt);
        continue;
      }
      await prisma.rewardClaim.deleteMany({ where: { customerId: id } });
      await prisma.customer.delete({ where: { id } });
    }
    return true;
  } catch (error) {
    logger.error('[demo] customer reset failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export async function createDemoShopLogin(email: string): Promise<void> {
  await ensureDemoSessionTable();
  await sweepExpiredDemos().catch((error) => {
    logger.warn('[demo] sweep before create failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  const username = `${DEMO_USERNAME_PREFIX}${randomToken(8)}`;
  const password = randomToken(12);
  const shop = await prisma.shop.create({
    data: {
      username,
      password,
      shopName: DEMO_SHOP_NAME,
      ownerName: 'Demo',
      email: `${username}@fixtray.app`,
      phone: '0000000000',
      zipCode: '00000',
      address: 'Demo only. This is not a real shop.',
      city: 'Demo',
      state: 'NA',
      status: 'approved',
      profileComplete: true,
      emailVerified: true,
      approvedAt: new Date(),
    },
  });
  rememberDemoShop(shop.id);

  const session = await prisma.demoSession.create({
    data: { email, shopId: shop.id },
  });

  let seedCustomerId: string | null = null;
  try {
    const customer = await prisma.customer.create({
      data: {
        email: `demo-customer+${shop.id}@fixtray.app`,
        username: `demo-customer-${shop.id.slice(-10)}`,
        password: crypto.randomBytes(24).toString('hex'),
        firstName: 'Sample',
        lastName: 'Customer',
        phone: '0000000000',
      },
    });
    seedCustomerId = customer.id;
    const vehicle = await prisma.vehicle.create({
      data: {
        customerId: customer.id,
        vehicleType: 'Sedan',
        make: 'Sample',
        model: 'Sedan',
        year: 2018,
      },
    });
    await prisma.workOrder.create({
      data: {
        customerId: customer.id,
        shopId: shop.id,
        vehicleId: vehicle.id,
        vehicleType: 'Sedan',
        serviceLocation: 'in-shop',
        issueDescription: 'Sample oil change. This is demo data, not a real job.',
        status: 'pending',
        estimatedCost: 80,
      },
    });
    await prisma.demoSession.update({
      where: { id: session.id },
      data: { seedCustomerId },
    });
  } catch (error) {
    logger.warn('[demo] sample job was not created', {
      shopId: shop.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const message = buildDemoLoginEmail({
    username,
    password,
    loginUrl: `${appBaseUrl()}/auth/login`,
  });
  const sent = await sendEmail({
    to: email,
    from: DEMO_FROM_EMAIL,
    subject: message.subject,
    html: message.html,
    shopId: shop.id,
    purpose: 'demo-login',
  });
  if (!sent) {
    await endDemoShop(shop.id).catch(() => undefined);
    await prisma.demoSession.delete({ where: { id: session.id } }).catch(() => undefined);
    throw new Error('Demo login email was not sent');
  }
}
