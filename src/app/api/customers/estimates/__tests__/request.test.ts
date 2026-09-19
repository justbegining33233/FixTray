import { NextRequest } from 'next/server';
import { generateAccessToken } from '@/lib/auth';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev-only-local-secret-change-in-production';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    shop: { findUnique: jest.fn() },
    workOrder: { create: jest.fn(), findMany: jest.fn() },
    notification: { create: jest.fn() },
  },
  default: {
    shop: { findUnique: jest.fn() },
    workOrder: { create: jest.fn(), findMany: jest.fn() },
    notification: { create: jest.fn() },
  },
}));

jest.mock('@/lib/shopServiceValidation', () => ({
  findUnconfiguredShopServices: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { prisma } from '@/lib/prisma';
import { findUnconfiguredShopServices } from '@/lib/shopServiceValidation';
import { POST as requestEstimate } from '../route';

function makePost(token: string | null, body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/customers/estimates', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/customers/estimates', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 without a customer token', async () => {
    const res = await requestEstimate(makePost(null, { shopId: 'shop-1', serviceType: 'Oil Change', description: 'Need oil' }));
    expect(res.status).toBe(401);
  });

  it('creates a pending estimate request associated to the shop and customer', async () => {
    (prisma.shop.findUnique as jest.Mock).mockResolvedValue({ id: 'shop-1', shopName: 'Audit Shop', status: 'approved' });
    (findUnconfiguredShopServices as jest.Mock).mockResolvedValue({ hasConfiguredServices: true, invalidServices: [] });
    (prisma.workOrder.create as jest.Mock).mockResolvedValue({
      id: 'wo-est-1',
      shop: { id: 'shop-1', shopName: 'Audit Shop' },
    });
    (prisma.notification.create as jest.Mock).mockResolvedValue({});

    const token = generateAccessToken({ id: 'cust-1', role: 'customer' });
    const res = await requestEstimate(makePost(token, {
      shopId: 'shop-1',
      serviceType: 'Oil Change',
      description: 'Oil is leaking',
    }));

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.workOrderId).toBe('wo-est-1');
    expect(prisma.workOrder.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        customerId: 'cust-1',
        shopId: 'shop-1',
        status: 'pending',
        maintenance: ['Oil Change'],
      }),
    }));
  });

  it('requires shop, service, and description', async () => {
    const token = generateAccessToken({ id: 'cust-1', role: 'customer' });
    const res = await requestEstimate(makePost(token, { shopId: '', serviceType: '', description: '' }));
    expect(res.status).toBe(400);
  });
});
