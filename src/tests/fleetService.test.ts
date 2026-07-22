import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import * as fleetService from '@/lib/fleetService';
import prisma from '@/lib/prisma';

describe('Fleet Management Service', () => {
  const testShopId = 'test-shop-1';
  let fleetAccountId: string;

  beforeAll(async () => {
    // Setup: Create test fleet account
    const account = await prisma.fleetAccount.create({
      data: {
        shopId: testShopId,
        companyName: 'Test Fleet',
        contactName: 'John Doe',
        contactEmail: 'john@test.com',
      },
    });
    fleetAccountId = account.id;
  });

  afterAll(async () => {
    // Cleanup: Delete test fleet account
    await prisma.fleetAccount.deleteMany({ where: { id: fleetAccountId } });
  });

  it('should get fleet statistics', async () => {
    const stats = await fleetService.getFleetStats(fleetAccountId);
    expect(stats).toHaveProperty('totalAccounts');
    expect(stats).toHaveProperty('totalVehicles');
    expect(stats).toHaveProperty('totalRevenue');
  });

  it('should generate fleet invoice with auto-numbering', async () => {
    const invoice = await fleetService.generateFleetInvoice(fleetAccountId, 5000, []);
    expect(invoice).toHaveProperty('invoiceNumber');
    expect(invoice.invoiceNumber).toMatch(/FLEET-/);
  });

  it('should record fleet payment', async () => {
    const invoice = await prisma.fleetInvoice.create({
      data: { fleetAccountId, totalAmount: 1000, amountPaid: 0, status: 'unpaid' },
    });

    const payment = await fleetService.recordFleetPayment(invoice.id, 500);
    expect(payment.amountPaid).toBe(500);
  });

  it('should calculate fleet invoice aging', async () => {
    const aging = await fleetService.getFleetInvoicesWithAging(fleetAccountId);
    expect(Array.isArray(aging)).toBe(true);
  });

  it('should validate credit limit', async () => {
    const hasCredit = await fleetService.hasAvailableCredit(fleetAccountId, 5000);
    expect(typeof hasCredit).toBe('boolean');
  });

  it('should get fleet vehicles', async () => {
    const vehicles = await fleetService.getFleetVehicles(fleetAccountId);
    expect(Array.isArray(vehicles)).toBe(true);
  });
});
