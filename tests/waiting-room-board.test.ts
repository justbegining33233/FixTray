import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { generateAccessToken } from '../src/lib/auth';
import {
  isWaitingRoomCandidate,
  orderWaitingForService,
  orderWaitingRoomBoard,
  orderWaitingRoomOrders,
  toWaitingBoardStatus,
  toWaitingRoomCard,
  waitingRoomWorkOrderWhere,
} from '../src/lib/waitingRoomBoard';

describe('waiting room board selection', () => {
  it('includes pending in-shop appointments and excludes pending roadside jobs', () => {
    expect(isWaitingRoomCandidate({
      status: 'pending',
      serviceLocation: 'in-shop',
    })).toBe(true);

    expect(isWaitingRoomCandidate({
      status: 'pending',
      serviceLocation: 'road-call',
    })).toBe(false);

    expect(isWaitingRoomCandidate({
      status: 'pending',
      serviceLocation: 'roadside',
    })).toBe(false);
  });

  it('keeps active shop jobs and maps their statuses onto the board buckets', () => {
    expect(isWaitingRoomCandidate({ status: 'in-progress', serviceLocation: 'in-shop' })).toBe(true);
    expect(isWaitingRoomCandidate({ status: 'assigned', serviceLocation: 'road-call' })).toBe(true);
    expect(toWaitingBoardStatus('in-progress')).toBe('in_progress');
    expect(toWaitingBoardStatus('assigned')).toBe('in_progress');
    expect(toWaitingBoardStatus('pending')).toBe('pending');
    expect(toWaitingBoardStatus('waiting-estimate')).toBe('pending');
    expect(toWaitingBoardStatus('completed')).toBe('completed');
  });

  it('labels a pending oil-change appointment with the service the shop already sees', () => {
    const card = toWaitingRoomCard({
      id: 'cmu39te40000310ga9fdrupxm',
      status: 'pending',
      serviceLocation: 'in-shop',
      vehicleType: 'gas',
      issueDescription: 'Appointment: Oil Change\n\nCustomer Notes: AUDIT TEST',
      customer: { firstName: 'Ada' },
      location: {
        type: 'in-shop',
        source: 'appointment',
        vehicleInfo: { year: 2018, make: 'Honda', model: 'Civic' },
      },
    });

    expect(card.status).toBe('pending');
    expect(card.vehicle).toContain('Oil Change');
    expect(card.vehicle).toContain('Honda');
    expect(card.customerInitial).toBe('A.');
    expect(card.ticketNumber).toBe('DRUPXM');
  });

  it('keeps in-progress jobs at 9:00 AM before 12:00 PM even when noon was created first', () => {
    const ordered = orderWaitingRoomOrders([
      { id: 'noon', dueDate: '12:00 PM', createdAt: '2026-10-02T08:00:00.000Z' },
      { id: 'nine', dueDate: '9:00 AM', createdAt: '2026-10-02T11:00:00.000Z' },
    ]);
    expect(ordered.map((row) => row.id)).toEqual(['nine', 'noon']);
    expect('12:00 PM' < '9:00 AM').toBe(true);
  });

  it('keeps a later appointment that arrived first above an earlier appointment that arrived later', () => {
    const ordered = orderWaitingForService([
      {
        id: 'nine',
        status: 'pending',
        dueDate: new Date('2026-10-02T13:00:00.000Z'),
        createdAt: '2026-10-02T18:00:00.000Z',
      },
      {
        id: 'noon',
        status: 'pending',
        dueDate: '12:00 PM',
        createdAt: '2026-10-02T14:00:00.000Z',
      },
    ]);
    expect(ordered.map((row) => row.id)).toEqual(['noon', 'nine']);
  });

  it('uses waiting-list entry time when the job was not created already waiting', () => {
    const ordered = orderWaitingForService([
      {
        id: 'early-appointment',
        status: 'pending',
        dueDate: new Date('2026-10-02T13:00:00.000Z'),
        createdAt: '2026-10-01T08:00:00.000Z',
        statusHistory: [
          { fromStatus: 'assigned', toStatus: 'pending', createdAt: '2026-10-02T20:00:00.000Z' },
        ],
      },
      {
        id: 'later-appointment',
        status: 'pending',
        dueDate: new Date('2026-10-02T16:00:00.000Z'),
        createdAt: '2026-10-02T15:00:00.000Z',
      },
    ]);
    expect(ordered.map((row) => row.id)).toEqual(['later-appointment', 'early-appointment']);
  });

  it('orders Waiting for Service by arrival and leaves In Progress on appointment time', () => {
    const ordered = orderWaitingRoomBoard([
      { id: 'noon-progress', status: 'in-progress', dueDate: new Date('2026-10-02T16:00:00.000Z'), createdAt: '2026-10-01T08:00:00.000Z' },
      { id: 'nine-progress', status: 'assigned', dueDate: new Date('2026-10-02T13:00:00.000Z'), createdAt: '2026-10-02T12:00:00.000Z' },
      { id: 'noon-wait', status: 'pending', dueDate: new Date('2026-10-02T16:00:00.000Z'), createdAt: '2026-10-02T10:00:00.000Z' },
      { id: 'nine-wait', status: 'pending', dueDate: new Date('2026-10-02T13:00:00.000Z'), createdAt: '2026-10-02T11:00:00.000Z' },
    ]);
    const progress = ordered.filter((row) => toWaitingBoardStatus(row.status) === 'in_progress');
    const waiting = ordered.filter((row) => toWaitingBoardStatus(row.status) === 'pending');
    expect(progress.map((row) => row.id)).toEqual(['nine-progress', 'noon-progress']);
    expect(waiting.map((row) => row.id)).toEqual(['noon-wait', 'nine-wait']);
  });

  it('orders stored appointment instants soonest first and leaves untimed jobs oldest first', () => {
    const ordered = orderWaitingRoomOrders([
      { id: 'noon', dueDate: new Date('2026-10-02T16:00:00.000Z'), createdAt: '2026-10-01T08:00:00.000Z' },
      { id: 'nine', dueDate: new Date('2026-10-02T13:00:00.000Z'), createdAt: '2026-10-02T12:00:00.000Z' },
      { id: 'older-walkin', createdAt: '2026-10-01T07:00:00.000Z' },
      { id: 'newer-walkin', createdAt: '2026-10-01T09:00:00.000Z' },
    ]);
    expect(ordered.map((row) => row.id)).toEqual(['older-walkin', 'newer-walkin', 'nine', 'noon']);
  });

  it('queries pending in-shop work together with active statuses', () => {
    expect(waitingRoomWorkOrderWhere('shop-1')).toEqual({
      shopId: 'shop-1',
      OR: [
        { status: { in: ['assigned', 'in-progress', 'waiting-estimate', 'waiting-for-payment'] } },
        {
          status: 'pending',
          serviceLocation: { in: ['in-shop', 'inshop', 'shop', 'in_shop'], mode: 'insensitive' },
        },
      ],
    });
  });
});

jest.mock('@/lib/prisma', () => ({
  prisma: {
    shop: { findUnique: jest.fn() },
    workOrder: { findMany: jest.fn() },
    bay: { findMany: jest.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { GET } from '../src/app/api/waiting-room/route';

const mockedPrisma = prisma as unknown as {
  shop: { findUnique: jest.Mock };
  workOrder: { findMany: jest.Mock };
  bay: { findMany: jest.Mock };
};

describe('GET /api/waiting-room', () => {
  beforeEach(() => {
    mockedPrisma.shop.findUnique.mockReset();
    mockedPrisma.workOrder.findMany.mockReset();
    mockedPrisma.bay.findMany.mockReset();
    mockedPrisma.shop.findUnique.mockResolvedValue({ id: 'shop-1', shopName: 'Audit Test Shop Jose' });
    mockedPrisma.bay.findMany.mockResolvedValue([]);
  });

  it('returns 400 when shopId is missing and the caller is anonymous', async () => {
    const res = await GET(new NextRequest('http://localhost/api/waiting-room'));
    expect(res.status).toBe(400);
    expect(mockedPrisma.workOrder.findMany).not.toHaveBeenCalled();
  });

  it('uses the signed-in shop when the lobby URL has no shopId', async () => {
    mockedPrisma.workOrder.findMany.mockResolvedValue([]);
    const token = generateAccessToken({ id: 'shop-1', shopId: 'shop-1', role: 'shop', username: 'jose' });
    const res = await GET(new NextRequest('http://localhost/api/waiting-room', {
      headers: { cookie: `sos_auth=${token}` },
    }));

    expect(res.status).toBe(200);
    expect(mockedPrisma.workOrder.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: waitingRoomWorkOrderWhere('shop-1'),
    }));
    const body = await res.json();
    expect(body.shopName).toBe('Audit Test Shop Jose');
    expect(body.orders).toEqual([]);
  });

  it('returns pending in-shop appointments and drops pending roadside jobs', async () => {
    mockedPrisma.workOrder.findMany.mockResolvedValue([
      {
        id: 'wo-inshop',
        status: 'pending',
        serviceLocation: 'in-shop',
        vehicleType: 'gas',
        issueDescription: 'Appointment: Oil Change',
        bay: null,
        dueDate: null,
        createdAt: new Date('2026-09-21T12:00:00Z'),
        location: { source: 'appointment', type: 'in-shop' },
        customer: { firstName: 'Ada' },
        assignedTo: null,
        vehicle: null,
      },
      {
        id: 'wo-road',
        status: 'pending',
        serviceLocation: 'road-call',
        vehicleType: 'gas',
        issueDescription: 'Appointment: Oil Change (Road Call)',
        bay: null,
        createdAt: new Date('2026-09-21T12:05:00Z'),
        customer: { firstName: 'Bea' },
        assignedTo: null,
        vehicle: null,
      },
      {
        id: 'wo-bay',
        status: 'in-progress',
        serviceLocation: 'in-shop',
        vehicleType: 'diesel',
        issueDescription: 'Brake Service',
        bay: 1,
        createdAt: new Date('2026-09-21T13:00:00Z'),
        customer: { firstName: 'Cam' },
        assignedTo: { firstName: 'Rio', lastName: 'Tech' },
        vehicle: { year: 2020, make: 'Ford', model: 'F-150' },
      },
    ]);

    const res = await GET(new NextRequest('http://localhost/api/waiting-room?shopId=shop-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orders.map((order: { id: string }) => order.id)).toEqual(['wo-bay', 'wo-inshop']);
    const waiting = body.orders.find((order: { id: string }) => order.id === 'wo-inshop');
    const working = body.orders.find((order: { id: string }) => order.id === 'wo-bay');
    expect(waiting.status).toBe('pending');
    expect(waiting.vehicle).toContain('Oil Change');
    expect(working.status).toBe('in_progress');
    expect(working.tech).toBe('Rio Tech');
    expect(working.vehicle).toContain('Brake Service');
  });

  it('returns the later appointment first when it entered the waiting list first', async () => {
    mockedPrisma.workOrder.findMany.mockResolvedValue([
      {
        id: 'wo-noon',
        status: 'pending',
        serviceLocation: 'in-shop',
        issueDescription: 'Appointment: Brake Service',
        dueDate: new Date('2026-10-02T16:00:00.000Z'),
        createdAt: new Date('2026-10-01T08:00:00.000Z'),
        customer: { firstName: 'Noon' },
        assignedTo: null,
        vehicle: null,
      },
      {
        id: 'wo-nine',
        status: 'pending',
        serviceLocation: 'in-shop',
        issueDescription: 'Appointment: Oil Change',
        dueDate: new Date('2026-10-02T13:00:00.000Z'),
        createdAt: new Date('2026-10-02T12:00:00.000Z'),
        customer: { firstName: 'Nine' },
        assignedTo: null,
        vehicle: null,
      },
    ]);

    const res = await GET(new NextRequest('http://localhost/api/waiting-room?shopId=shop-1'));
    const body = await res.json();
    expect(body.orders.map((order: { id: string }) => order.id)).toEqual(['wo-noon', 'wo-nine']);
  });
});
