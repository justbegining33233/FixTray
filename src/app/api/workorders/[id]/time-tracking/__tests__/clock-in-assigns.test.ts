import { NextRequest } from 'next/server';
import { generateAccessToken } from '@/lib/auth';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev-only-local-secret-change-in-production';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    workOrder: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    workOrderTimeEntry: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    tech: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import prisma from '@/lib/prisma';
import { POST as clockAction } from '../route';

function makePost(id: string, token: string, body: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/workorders/${id}/time-tracking`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

describe('POST /api/workorders/[id]/time-tracking clock-in', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sets assignedTechId when a tech clocks into an unassigned job', async () => {
    (prisma.workOrder.findUnique as jest.Mock).mockResolvedValue({
      id: 'wo-001',
      shopId: 'shop-001',
      assignedTechId: null,
      status: 'pending',
    });
    (prisma.workOrderTimeEntry.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.workOrderTimeEntry.create as jest.Mock).mockResolvedValue({
      id: 'entry-1',
      workOrderId: 'wo-001',
      techId: 'tech-001',
      clockIn: new Date().toISOString(),
    });
    (prisma.tech.findFirst as jest.Mock).mockResolvedValue({ id: 'tech-001' });
    (prisma.workOrder.update as jest.Mock).mockResolvedValue({
      id: 'wo-001',
      assignedTechId: 'tech-001',
      status: 'in-progress',
      assignedTo: { id: 'tech-001', firstName: 'Pat', lastName: 'Tech' },
    });

    const token = generateAccessToken({ id: 'tech-001', role: 'tech', shopId: 'shop-001' });
    const res = await clockAction(
      makePost('wo-001', token, { action: 'clock-in', techId: 'tech-001' }),
      { params: Promise.resolve({ id: 'wo-001' }) }
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(prisma.workOrder.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'wo-001' },
      data: expect.objectContaining({
        assignedTechId: 'tech-001',
        status: 'in-progress',
      }),
    }));
    expect(json.workOrder.assignedTechId).toBe('tech-001');
  });

  it('does not overwrite an existing assignee on a later clock-in', async () => {
    (prisma.workOrder.findUnique as jest.Mock).mockResolvedValue({
      id: 'wo-001',
      shopId: 'shop-001',
      assignedTechId: 'tech-001',
      status: 'in-progress',
    });
    (prisma.workOrderTimeEntry.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.workOrderTimeEntry.create as jest.Mock).mockResolvedValue({
      id: 'entry-2',
      workOrderId: 'wo-001',
      techId: 'tech-001',
    });

    const token = generateAccessToken({ id: 'tech-001', role: 'tech', shopId: 'shop-001' });
    const res = await clockAction(
      makePost('wo-001', token, { action: 'clock-in', techId: 'tech-001' }),
      { params: Promise.resolve({ id: 'wo-001' }) }
    );

    expect(res.status).toBe(200);
    expect(prisma.workOrder.update).not.toHaveBeenCalled();
  });
});
