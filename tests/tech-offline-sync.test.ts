import { NextRequest } from 'next/server';
import { mergeByClientId, reviewStatusChoice, statusDecision } from '../src/lib/techOfflineSync';
import { applyTechOfflineOp, type OfflineDb } from '../src/lib/techOfflineApply';

type Order = {
  id: string;
  shopId: string;
  assignedTechId: string | null;
  status: string;
  techLabor: unknown;
  partsUsed: unknown;
  workPhotos: unknown;
  completion: unknown;
};

function memoryDb(seed?: Order): OfflineDb & {
  orders: Map<string, Order>;
  photos: Map<string, unknown>;
  entries: Record<string, unknown>[];
} {
  const orders = new Map<string, Order>();
  if (seed) orders.set(seed.id, seed);
  const receipts = new Map<string, { techId: string; result: { status: string } }>();
  const photos = new Map<string, unknown>();
  const entries: Record<string, unknown>[] = [];
  const db = {
    orders,
    photos,
    entries,
    tech: { findUnique: async () => ({ id: 'tech-1', shopId: 'shop-1' }) },
    syncReceipt: {
      findUnique: async ({ where }: { where: { idempotencyKey: string } }) => receipts.get(where.idempotencyKey) || null,
      create: async ({ data }: { data: { idempotencyKey: string; techId: string; result: { status: string } } }) => {
        receipts.set(data.idempotencyKey, data);
        return data;
      },
    },
    workOrder: {
      findUnique: async ({ where }: { where: { id: string } }) => orders.get(where.id) || null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const next = { ...orders.get(where.id)!, ...data };
        orders.set(where.id, next);
        return next;
      },
    },
    statusHistory: { create: async ({ data }: { data: Record<string, unknown> }) => data },
    timeEntry: {
      findFirst: async ({ where }: { where: { techId?: string; clockOut?: null } }) =>
        entries.find((row) => row.techId === where.techId && row.clockOut == null) || null,
      findUnique: async ({ where }: { where: { clientMutationId: string } }) =>
        entries.find((row) => row.clientMutationId === where.clientMutationId) || null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `te-${entries.length + 1}`, ...data };
        entries.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = entries.find((entry) => entry.id === where.id);
        Object.assign(row || {}, data);
        return row;
      },
    },
    photo: {
      findUnique: async ({ where }: { where: { clientMutationId: string } }) => photos.get(where.clientMutationId) || null,
      create: async ({ data }: { data: { clientMutationId: string } }) => {
        photos.set(data.clientMutationId, data);
        return data;
      },
    },
    $transaction: async <T,>(fn: (tx: OfflineDb) => Promise<T>) => fn(db as unknown as OfflineDb),
  };
  return db as unknown as OfflineDb & { orders: Map<string, Order>; photos: Map<string, unknown>; entries: Record<string, unknown>[] };
}

const auth = { id: 'tech-1', role: 'tech', shopId: 'shop-1' };

function job(status = 'in-progress'): Order {
  return {
    id: 'wo-1',
    shopId: 'shop-1',
    assignedTechId: 'tech-1',
    status,
    techLabor: [],
    partsUsed: [],
    workPhotos: [],
    completion: {},
  };
}

describe('tech offline rules', () => {
  it('merges append-only rows by client id and keeps the first copy', () => {
    const first = mergeByClientId([], { clientId: 'line-1', description: 'Brakes' });
    const second = mergeByClientId(first.items, { clientId: 'line-1', description: 'Brakes again' });
    expect(first.added).toBe(true);
    expect(second.added).toBe(false);
    expect(second.items).toHaveLength(1);
    expect(second.items[0].description).toBe('Brakes');
  });

  it('does not clobber a status the shop already changed or closed', () => {
    expect(statusDecision('in-progress', 'assigned', 'completed')).toBe('conflict');
    expect(statusDecision('closed', 'in-progress', 'completed')).toBe('conflict');
    expect(statusDecision('in-progress', 'in-progress', 'completed')).toBe('apply');
    expect(statusDecision('completed', 'in-progress', 'completed')).toBe('noop');
    expect(reviewStatusChoice('waiting-for-payment').ok).toBe(false);
  });
});

describe('tech offline apply', () => {
  it('stores two labor lines and two photos once when the batch is replayed', async () => {
    const db = memoryDb(job());
    const ops = [
      { idempotencyKey: 'offline-labor-1111', kind: 'labor', workOrderId: 'wo-1', clientId: 'offline-labor-1111', description: 'Road call', hours: 1, rate: 120 },
      { idempotencyKey: 'offline-labor-2222', kind: 'labor', workOrderId: 'wo-1', clientId: 'offline-labor-2222', description: 'Brake job', hours: 2, rate: 120 },
      { idempotencyKey: 'offline-photo-1111', kind: 'photo', workOrderId: 'wo-1', clientId: 'offline-photo-1111', url: 'https://res.cloudinary.com/demo/image/upload/a.jpg' },
      { idempotencyKey: 'offline-photo-2222', kind: 'photo', workOrderId: 'wo-1', clientId: 'offline-photo-2222', url: 'https://res.cloudinary.com/demo/image/upload/b.jpg' },
    ];
    for (const op of ops) await applyTechOfflineOp(db, auth, op);
    for (const op of ops) {
      const replay = await applyTechOfflineOp(db, auth, op);
      expect(replay.status).toBe('duplicate');
    }
    const saved = db.orders.get('wo-1')!;
    expect(saved.techLabor).toHaveLength(2);
    expect(saved.workPhotos).toHaveLength(2);
    expect(db.photos.size).toBe(2);
  });

  it('keeps a labor line when the status change conflicts with a closed job', async () => {
    const db = memoryDb(job('closed'));
    const status = await applyTechOfflineOp(db, auth, {
      idempotencyKey: 'offline-status-111',
      kind: 'status',
      workOrderId: 'wo-1',
      baseStatus: 'in-progress',
      status: 'completed',
    });
    const labor = await applyTechOfflineOp(db, auth, {
      idempotencyKey: 'offline-labor-3333',
      kind: 'labor',
      workOrderId: 'wo-1',
      clientId: 'offline-labor-3333',
      description: 'Still did the work',
      hours: 1,
      rate: 90,
    });
    expect(status.status).toBe('conflict');
    expect(labor.status).toBe('applied');
    expect(db.orders.get('wo-1')!.status).toBe('closed');
    expect(db.orders.get('wo-1')!.techLabor).toHaveLength(1);
  });

  it('does not create a second clock entry when the same clock-in is replayed', async () => {
    const db = memoryDb(job());
    const op = { idempotencyKey: 'offline-clock-1111', kind: 'clock-in', clientId: 'offline-clock-1111', at: '2026-09-25T12:00:00.000Z' };
    expect((await applyTechOfflineOp(db, auth, op)).status).toBe('applied');
    expect((await applyTechOfflineOp(db, auth, op)).status).toBe('duplicate');
    expect(db.entries).toHaveLength(1);
  });

  it('rejects a tech who is not assigned to the job', async () => {
    const db = memoryDb({ ...job(), assignedTechId: 'someone-else' });
    const result = await applyTechOfflineOp(db, auth, {
      idempotencyKey: 'offline-labor-9999',
      kind: 'labor',
      workOrderId: 'wo-1',
      clientId: 'offline-labor-9999',
      description: 'Nope',
      hours: 1,
      rate: 1,
    });
    expect(result.status).toBe('rejected');
    expect(db.orders.get('wo-1')!.techLabor).toHaveLength(0);
  });
});

jest.mock('@/lib/prisma', () => {
  const orders = new Map<string, Order>();
  orders.set('wo-1', {
    id: 'wo-1', shopId: 'shop-1', assignedTechId: 'tech-1', status: 'assigned',
    techLabor: [], partsUsed: [], workPhotos: [], completion: {},
  });
  const receipts = new Map<string, { idempotencyKey: string; techId: string; result: { status: string } }>();
  const photos = new Map<string, unknown>();
  const db = {
    __orders: orders,
    __photos: photos,
    tech: { findUnique: async () => ({ id: 'tech-1', shopId: 'shop-1' }) },
    syncReceipt: {
      findUnique: async ({ where }: { where: { idempotencyKey: string } }) => receipts.get(where.idempotencyKey) || null,
      create: async ({ data }: { data: { idempotencyKey: string; techId: string; result: { status: string } } }) => {
        receipts.set(data.idempotencyKey, data);
        return data;
      },
    },
    workOrder: {
      findUnique: async ({ where }: { where: { id: string } }) => orders.get(where.id) || null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const next = { ...orders.get(where.id)!, ...data };
        orders.set(where.id, next);
        return next;
      },
    },
    statusHistory: { create: async ({ data }: { data: unknown }) => data },
    timeEntry: {
      findFirst: async () => null,
      findUnique: async () => null,
      create: async ({ data }: { data: unknown }) => data,
      update: async ({ data }: { data: unknown }) => data,
    },
    photo: {
      findUnique: async ({ where }: { where: { clientMutationId: string } }) => photos.get(where.clientMutationId) || null,
      create: async ({ data }: { data: { clientMutationId: string } }) => {
        photos.set(data.clientMutationId, data);
        return data;
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  };
  return { __esModule: true, default: db };
});

jest.mock('@/lib/middleware', () => ({
  requireAuth: jest.fn(() => ({ id: 'tech-1', role: 'tech', shopId: 'shop-1' })),
}));

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn() },
}));

import prisma from '@/lib/prisma';
import { POST } from '../src/app/api/tech/offline-sync/route';

describe('POST /api/tech/offline-sync', () => {
  it('does not duplicate lines or photos when the request is replayed', async () => {
    const ops = [
      { idempotencyKey: 'offline-api-labor1', kind: 'labor', workOrderId: 'wo-1', clientId: 'offline-api-labor1', description: 'Diag', hours: 1, rate: 100 },
      { idempotencyKey: 'offline-api-labor2', kind: 'labor', workOrderId: 'wo-1', clientId: 'offline-api-labor2', description: 'Repair', hours: 1.5, rate: 100 },
      { idempotencyKey: 'offline-api-photo1', kind: 'photo', workOrderId: 'wo-1', clientId: 'offline-api-photo1', url: 'https://res.cloudinary.com/demo/image/upload/one.jpg' },
      { idempotencyKey: 'offline-api-photo2', kind: 'photo', workOrderId: 'wo-1', clientId: 'offline-api-photo2', url: 'https://res.cloudinary.com/demo/image/upload/two.jpg' },
    ];
    const call = () => POST(new NextRequest('http://localhost/api/tech/offline-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test' },
      body: JSON.stringify({ ops }),
    }));
    const first = await (await call()).json();
    const second = await (await call()).json();
    expect(first.results.map((row: { status: string }) => row.status)).toEqual(['applied', 'applied', 'applied', 'applied']);
    expect(second.results.map((row: { status: string }) => row.status)).toEqual(['duplicate', 'duplicate', 'duplicate', 'duplicate']);
    const saved = (prisma as unknown as { __orders: Map<string, Order>; __photos: Map<string, unknown> });
    expect(saved.__orders.get('wo-1')!.techLabor).toHaveLength(2);
    expect(saved.__orders.get('wo-1')!.workPhotos).toHaveLength(2);
    expect(saved.__photos.size).toBe(2);
  });
});
