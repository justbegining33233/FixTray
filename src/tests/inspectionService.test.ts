import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import * as inspectionService from '@/lib/inspectionService';
import prisma from '@/lib/prisma';

describe('State Inspection Service', () => {
  const testShopId = 'test-shop-1';
  let vehicleId: string;

  beforeAll(async () => {
    const vehicle = await prisma.vehicle.create({
      data: {
        shopId: testShopId,
        vin: 'TEST123456789',
        licensePlate: 'INSP001',
        make: 'Ford',
        model: 'F-150',
        year: 2023,
      },
    });
    vehicleId = vehicle.id;
  });

  afterAll(async () => {
    await prisma.vehicle.deleteMany({ where: { id: vehicleId } });
  });

  it('should get inspection statistics', async () => {
    const stats = await inspectionService.getInspectionStats(testShopId);
    expect(stats).toHaveProperty('passed');
    expect(stats).toHaveProperty('failed');
    expect(stats).toHaveProperty('conditional');
  });

  it('should calculate expiration date (1 year for pass)', async () => {
    const expiryDate = await inspectionService.calculateExpirationDate('pass');
    const daysUntil = Math.floor((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    expect(daysUntil).toBeCloseTo(365, -1); // Within ~1 day of 365
  });

  it('should not expire conditional inspections', async () => {
    const expiryDate = await inspectionService.calculateExpirationDate('conditional');
    expect(expiryDate).toBeNull();
  });

  it('should get expired inspections', async () => {
    const expired = await inspectionService.getExpiredInspections(testShopId);
    expect(Array.isArray(expired)).toBe(true);
  });

  it('should get inspections due within 30 days', async () => {
    const due = await inspectionService.getDueForInspection(testShopId, 30);
    expect(Array.isArray(due)).toBe(true);
  });

  it('should calculate days until expiration', async () => {
    const inspectionDate = new Date();
    const expiryDate = new Date(inspectionDate);
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    const days = await inspectionService.daysUntilExpiration(expiryDate);
    expect(days).toBeCloseTo(365, -1);
  });

  it('should generate compliance report', async () => {
    const report = await inspectionService.generateComplianceReport(testShopId);
    expect(report).toHaveProperty('totalInspections');
    expect(report).toHaveProperty('passRate');
  });
});
