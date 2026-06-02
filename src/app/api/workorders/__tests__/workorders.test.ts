/**
 * Unit tests for work order CRUD endpoints:
 *   GET  /api/workorders/[id]
 *   PUT  /api/workorders/[id]
 *   GET  /api/workorders  (list)
 */

import { NextRequest } from 'next/server';
import { generateAccessToken } from '@/lib/auth';

// ── mock heavy runtime deps ──────────────────────────────────────────────────

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    workOrder: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    statusHistory: {
      create: jest.fn().mockResolvedValue({}),
    },
    notification: {
      create: jest.fn().mockResolvedValue({}),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  },
}));

jest.mock('@/lib/rateLimit', () => ({
  checkRateLimit: jest.fn().mockResolvedValue({ success: true, resetTime: Date.now() + 60000, message: '' }),
  getClientIP: jest.fn().mockReturnValue('127.0.0.1'),
  resetRateLimit: jest.fn(),
}));

// rate-limit (alternative import path used by workorders list route)
jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn().mockResolvedValue(null),
  rateLimitConfigs: { workOrders: {} },
}));

jest.mock('@/lib/emailService', () => ({
  sendEstimateReadyEmail: jest.fn().mockResolvedValue(undefined),
  sendJobCompletedEmail: jest.fn().mockResolvedValue(undefined),
  sendStatusUpdateEmail: jest.fn().mockResolvedValue(undefined),
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/serverPush', () => ({
  pushEstimateReady: jest.fn().mockResolvedValue(undefined),
  pushJobCompleted: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/smsService', () => ({
  sendSms: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/loyaltyService', () => ({
  awardLoyaltyPoints: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/webhookService', () => ({
  dispatchWebhook: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/apiVersioning', () => ({
  apiVersioning: {
    getVersionFromRequest: jest.fn().mockReturnValue('1.0.0'),
    isVersionSupported: jest.fn().mockReturnValue(true),
    getSupportedVersions: jest.fn().mockReturnValue(['1.0.0']),
  },
}));

jest.mock('@/lib/queryCache', () => ({
  queryCache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    invalidate: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/lib/compression', () => ({
  compression: { addCompressionHeaders: jest.fn() },
}));

jest.mock('@/lib/featureFlags', () => ({
  featureFlags: { isEnabled: jest.fn().mockResolvedValue(false) },
}));

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), performance: jest.fn() },
}));

jest.mock('@/lib/sanitize', () => ({
  sanitizeObject: jest.fn((x: unknown) => x),
}));

import prisma from '@/lib/prisma';
import {
  GET as getById,
  PUT as updateById,
} from '../[id]/route';
import { GET as listWorkOrders } from '../route';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeToken(payload: Record<string, unknown>) {
  // Use the real generateAccessToken so JWT is valid for requireAuth
  return generateAccessToken(payload);
}

function makeGetRequest(url: string, token: string) {
  return new NextRequest(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

function makePutRequest(url: string, token: string, body: Record<string, unknown>) {
  return new NextRequest(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

const mockWorkOrder = {
  id: 'wo-001',
  customerId: 'cust-001',
  shopId: 'shop-001',
  status: 'pending',
  issueDescription: 'Engine knocking loudly',
  vehicleType: 'Truck',
  serviceLocation: 'in-shop',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  assignedTechId: null,
  estimatedCost: null,
  amountPaid: null,
  paymentStatus: null,
  completedAt: null,
  repairs: null,
  maintenance: null,
  partsMaterials: null,
  pictures: null,
  location: null,
  estimate: null,
  techLabor: null,
  partsUsed: null,
  workPhotos: null,
  completion: null,
  customer: { id: 'cust-001', firstName: 'Bob', lastName: 'Jones', email: 'bob@test.com', phone: '555-0001' },
  shop: { id: 'shop-001', shopName: 'Best Auto', phone: '555-0002', email: 'shop@test.com' },
  assignedTo: null,
  messages: [],
};

beforeEach(() => jest.clearAllMocks());

// ── GET /api/workorders/[id] ─────────────────────────────────────────────────

describe('GET /api/workorders/[id]', () => {
  it('returns 401 when no auth token is provided', async () => {
    const req = new NextRequest('http://localhost/api/workorders/wo-001', { method: 'GET' });
    const res = await getById(req, { params: Promise.resolve({ id: 'wo-001' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when work order does not exist', async () => {
    (prisma.workOrder.findUnique as jest.Mock).mockResolvedValue(null);
    const token = makeToken({ id: 'shop-001', role: 'shop' });
    const res = await getById(
      makeGetRequest('http://localhost/api/workorders/wo-999', token),
      { params: Promise.resolve({ id: 'wo-999' }) }
    );
    expect(res.status).toBe(404);
  });

  it('returns 403 when a customer tries to access another customer\'s work order', async () => {
    (prisma.workOrder.findUnique as jest.Mock).mockResolvedValue(mockWorkOrder);
    const token = makeToken({ id: 'cust-other', role: 'customer' });
    const res = await getById(
      makeGetRequest('http://localhost/api/workorders/wo-001', token),
      { params: Promise.resolve({ id: 'wo-001' }) }
    );
    expect(res.status).toBe(403);
  });

  it('returns 200 when the owning customer fetches their work order', async () => {
    (prisma.workOrder.findUnique as jest.Mock).mockResolvedValue(mockWorkOrder);
    const token = makeToken({ id: 'cust-001', role: 'customer' });
    const res = await getById(
      makeGetRequest('http://localhost/api/workorders/wo-001', token),
      { params: Promise.resolve({ id: 'wo-001' }) }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe('wo-001');
  });

  it('returns 200 when the owning shop fetches the work order', async () => {
    (prisma.workOrder.findUnique as jest.Mock).mockResolvedValue(mockWorkOrder);
    const token = makeToken({ id: 'shop-001', role: 'shop' });
    const res = await getById(
      makeGetRequest('http://localhost/api/workorders/wo-001', token),
      { params: Promise.resolve({ id: 'wo-001' }) }
    );
    expect(res.status).toBe(200);
  });

  it('returns 200 for admin regardless of ownership', async () => {
    (prisma.workOrder.findUnique as jest.Mock).mockResolvedValue(mockWorkOrder);
    const token = makeToken({ id: 'admin-001', role: 'admin' });
    const res = await getById(
      makeGetRequest('http://localhost/api/workorders/wo-001', token),
      { params: Promise.resolve({ id: 'wo-001' }) }
    );
    expect(res.status).toBe(200);
  });
});

// ── PUT /api/workorders/[id] ─────────────────────────────────────────────────

describe('PUT /api/workorders/[id]', () => {
  it('returns 401 when no auth token is provided', async () => {
    const req = new NextRequest('http://localhost/api/workorders/wo-001', { method: 'PUT', body: '{}' });
    const res = await updateById(req, { params: Promise.resolve({ id: 'wo-001' }) });
    expect(res.status).toBe(401);
  });

  it('returns 400 when body contains unknown fields (strict schema)', async () => {
    const token = makeToken({ id: 'shop-001', role: 'shop' });
    const res = await updateById(
      makePutRequest('http://localhost/api/workorders/wo-001', token, { unknownField: 'bad' }),
      { params: Promise.resolve({ id: 'wo-001' }) }
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when work order does not exist', async () => {
    (prisma.workOrder.findUnique as jest.Mock).mockResolvedValue(null);
    const token = makeToken({ id: 'shop-001', role: 'shop' });
    const res = await updateById(
      makePutRequest('http://localhost/api/workorders/wo-001', token, { status: 'in-progress' }),
      { params: Promise.resolve({ id: 'wo-001' }) }
    );
    expect(res.status).toBe(404);
  });

  it('returns 200 when a shop updates the status of their own work order', async () => {
    (prisma.workOrder.findUnique as jest.Mock).mockResolvedValue(mockWorkOrder);
    const updated = { ...mockWorkOrder, status: 'in-progress' };
    (prisma.workOrder.update as jest.Mock).mockResolvedValue(updated);

    const token = makeToken({ id: 'shop-001', role: 'shop' });
    const res = await updateById(
      makePutRequest('http://localhost/api/workorders/wo-001', token, { status: 'in-progress' }),
      { params: Promise.resolve({ id: 'wo-001' }) }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('in-progress');
  });

  it('returns 403 when a customer tries to update a work order they do not own', async () => {
    (prisma.workOrder.findUnique as jest.Mock).mockResolvedValue(mockWorkOrder);
    const token = makeToken({ id: 'cust-other', role: 'customer' });
    const res = await updateById(
      makePutRequest('http://localhost/api/workorders/wo-001', token, { status: 'in-progress' }),
      { params: Promise.resolve({ id: 'wo-001' }) }
    );
    expect(res.status).toBe(403);
  });
});

// ── GET /api/workorders (list) ───────────────────────────────────────────────

describe('GET /api/workorders', () => {
  it('returns 401 when no auth token is provided', async () => {
    const req = new NextRequest('http://localhost/api/workorders');
    const res = await listWorkOrders(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 for an invalid page parameter', async () => {
    const token = makeToken({ id: 'shop-001', role: 'shop' });
    const req = makeGetRequest('http://localhost/api/workorders?page=-1', token);
    const res = await listWorkOrders(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for limit exceeding maximum', async () => {
    const token = makeToken({ id: 'shop-001', role: 'shop' });
    const req = makeGetRequest('http://localhost/api/workorders?limit=999', token);
    const res = await listWorkOrders(req);
    expect(res.status).toBe(400);
  });

  it('returns paginated work orders for a shop', async () => {
    (prisma.workOrder.count as jest.Mock).mockResolvedValue(1);
    (prisma.workOrder.findMany as jest.Mock).mockResolvedValue([mockWorkOrder]);

    const token = makeToken({ id: 'shop-001', role: 'shop' });
    const req = makeGetRequest('http://localhost/api/workorders', token);
    const res = await listWorkOrders(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.workOrders).toHaveLength(1);
    expect(json.pagination.total).toBe(1);
  });

  it('scopes results to the customer\'s own work orders', async () => {
    (prisma.workOrder.count as jest.Mock).mockResolvedValue(0);
    (prisma.workOrder.findMany as jest.Mock).mockResolvedValue([]);

    const token = makeToken({ id: 'cust-001', role: 'customer' });
    await listWorkOrders(makeGetRequest('http://localhost/api/workorders', token));

    const whereArg = (prisma.workOrder.findMany as jest.Mock).mock.calls[0][0].where;
    expect(whereArg.customerId).toBe('cust-001');
  });
});
