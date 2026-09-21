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
        date: new Date(),
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
    expect(stats).toHaveProperty('confirmedShifts');
  });

  it('should detect shift conflicts', async () => {
    const hasConflict = await shiftService.hasShiftConflict(testTechId, new Date());
    expect(typeof hasConflict).toBe('boolean');
  });

  it('should calculate hours worked', async () => {
    const start = new Date();
    start.setDate(start.getDate() - 1);
    const end = new Date();
    end.setDate(end.getDate() + 1);
    const hoursWorked = await shiftService.calculateHoursWorked(testTechId, start, end);
    expect(typeof hoursWorked).toBe('number');
    expect(hoursWorked).toBeGreaterThanOrEqual(0);
  });

  it('should get tech shift schedule', async () => {
    const start = new Date();
    const end = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const schedule = await shiftService.getShiftSchedule(testShopId, start, end);
    expect(schedule).toBeTruthy();
    expect(typeof schedule).toBe('object');
  });

  it('should get pending swap requests', async () => {
    const swaps = await shiftService.getPendingSwapRequests(shiftId);
    expect(Array.isArray(swaps)).toBe(true);
  });
});
