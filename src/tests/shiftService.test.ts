import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import * as shiftService from '@/lib/shiftService';
import prisma from '@/lib/prisma';

describe('Shift Scheduling Service', () => {
  const testShopId = 'test-shop-1';
  const testTechId = 'test-tech-1';
  let shiftId: string;

  beforeAll(async () => {
    // Setup test data
    const shift = await prisma.shift.create({
      data: {
        shopId: testShopId,
        techId: testTechId,
        startDate: new Date(),
        endDate: new Date(Date.now() + 8 * 60 * 60 * 1000),
        startTime: '09:00',
        endTime: '17:00',
        status: 'scheduled',
      },
    });
    shiftId = shift.id;
  });

  afterAll(async () => {
    await prisma.shift.deleteMany({ where: { id: shiftId } });
  });

  it('should get shift statistics', async () => {
    const stats = await shiftService.getShiftStats(testShopId);
    expect(stats).toHaveProperty('totalShifts');
    expect(stats).toHaveProperty('completedShifts');
    expect(stats).toHaveProperty('cancelledShifts');
  });

  it('should detect shift conflicts', async () => {
    const hasConflict = await shiftService.hasShiftConflict(
      testShopId,
      testTechId,
      new Date(),
      new Date(Date.now() + 8 * 60 * 60 * 1000)
    );
    expect(typeof hasConflict).toBe('boolean');
  });

  it('should calculate hours worked', async () => {
    const hoursWorked = await shiftService.calculateHoursWorked(shiftId);
    expect(typeof hoursWorked).toBe('number');
    expect(hoursWorked).toBeGreaterThan(0);
  });

  it('should get tech shift schedule', async () => {
    const schedule = await shiftService.getShiftSchedule(testShopId);
    expect(Array.isArray(schedule)).toBe(true);
  });

  it('should get pending swap requests', async () => {
    const swaps = await shiftService.getPendingSwapRequests(testShopId);
    expect(Array.isArray(swaps)).toBe(true);
  });
});
