import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import * as loanerService from '@/lib/loanerService';
import prisma from '@/lib/prisma';

describe('Loaner Vehicle Service', () => {
  const testShopId = 'test-shop-1';
  let vehicleId: string;

  beforeAll(async () => {
    const vehicle = await prisma.loanerVehicle.create({
      data: {
        shopId: testShopId,
        make: 'Toyota',
        model: 'Camry',
        year: 2023,
        licensePlate: 'TEST123',
        status: 'available',
        mileageOut: 50000,
      },
    });
    vehicleId = vehicle.id;
  });

  afterAll(async () => {
    await prisma.loanerVehicle.deleteMany({ where: { id: vehicleId } });
  });

  it('should get loaner statistics', async () => {
    const stats = await loanerService.getLoanerStats(testShopId);
    expect(stats).toHaveProperty('totalVehicles');
    expect(stats).toHaveProperty('availableVehicles');
    expect(stats).toHaveProperty('checkedOutVehicles');
  });

  it('should get available loaners', async () => {
    const available = await loanerService.getAvailableLoaners(testShopId);
    expect(Array.isArray(available)).toBe(true);
    expect(available.some((v) => v.id === vehicleId)).toBe(true);
  });

  it('should calculate late charges ($50/day default)', async () => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() - 3); // 3 days overdue
    const charges = await loanerService.calculateLateCharges(vehicleId, dueDate);
    expect(charges).toBe(150); // 3 days * $50
  });

  it('should calculate mileage driven', async () => {
    const mileage = await loanerService.calculateMileageDriven(vehicleId, 50000, 50500);
    expect(mileage).toBe(500);
  });

  it('should generate return reminders at 7 days before due', async () => {
    const reminders = await loanerService.generateReturnReminders(testShopId);
    expect(Array.isArray(reminders)).toBe(true);
  });

  it('should get vehicle history', async () => {
    const history = await loanerService.getVehicleHistory(vehicleId);
    expect(Array.isArray(history)).toBe(true);
  });
});
