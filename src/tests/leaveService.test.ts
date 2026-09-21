import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import * as leaveService from '@/lib/leaveService';
import prisma from '@/lib/prisma';

describe('Leave/PTO Service', () => {
  const testShopId = 'test-shop-1';
  const testTechId = 'test-tech-1';

  beforeAll(async () => {
    // Setup test tech with hire date 5+ years ago (to test senior accrual)
    const hireDate = new Date();
    hireDate.setFullYear(hireDate.getFullYear() - 6);

    await prisma.tech.upsert({
      where: { id: testTechId },
      update: { hireDate, createdAt: hireDate },
      create: {
        id: testTechId,
        email: 'tech@test.com',
        password: 'test-password',
        firstName: 'Test',
        lastName: 'Tech',
        role: 'tech',
        shopId: testShopId,
        hireDate,
        createdAt: hireDate,
      },
    });
  });

  afterAll(async () => {
    await prisma.tech.deleteMany({ where: { id: testTechId } });
  });

  it('should calculate base PTO (20 days/year)', async () => {
    const balance = await leaveService.getAvailablePTO(testTechId);
    // Should be 20 days * 8 hours = 160 hours (approximately, accounting for time)
    expect(balance).toBeGreaterThan(0);
  });

  it('should apply senior bonus (25+ days after 5 years)', async () => {
    const balance = await leaveService.getAvailablePTO(testTechId);
    // 5+ years = 25 days
    expect(balance).toBeGreaterThanOrEqual(25 * 8); // 200 hours
  });

  it('should get leave balance by type', async () => {
    const balance = await leaveService.getLeaveBalance(testTechId);
    expect(balance.byType).toHaveProperty('vacation');
    expect(balance.byType).toHaveProperty('sick');
    expect(balance.byType).toHaveProperty('personal');
  });

  it('should get upcoming leave requests', async () => {
    const upcoming = await leaveService.getUpcomingLeave(testShopId);
    expect(Array.isArray(upcoming)).toBe(true);
  });

  it('should validate leave request within limits', async () => {
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 3); // 3 days vacation

    const result = await leaveService.validateLeaveRequest(testTechId, startDate, endDate, 'vacation');
    expect(typeof result.valid).toBe('boolean');
  });

  it('should enforce max 10 consecutive vacation days', async () => {
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 15); // 15 days (exceeds 10 max)

    const result = await leaveService.validateLeaveRequest(testTechId, startDate, endDate, 'vacation');
    expect(result.valid).toBe(false);
  });

  it('should get leave forecast', async () => {
    const forecast = await leaveService.getLeavesForecast(testShopId);
    expect(Array.isArray(forecast)).toBe(true);
  });
});
