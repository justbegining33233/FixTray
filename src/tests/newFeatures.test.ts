import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import * as campaignService from '@/lib/campaignService';
// import * as reminderService from '@/lib/recurringReminderService'; // Service deleted - model not in schema
// import * as dviService from '@/lib/dviApprovalService'; // Service deleted - model not in schema
import prisma from '@/lib/prisma';

describe('Campaigns Service', () => {
  const testShopId = 'test-shop-1';
  let campaignId: string;

  beforeAll(async () => {
    const campaign = await prisma.campaign.create({
      data: {
        shopId: testShopId,
        name: '10% Summer Sale',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        discountType: 'percentage',
        discountValue: 10,
        active: true,
      },
    });
    campaignId = campaign.id;
  });

  afterAll(async () => {
    await prisma.campaign.deleteMany({ where: { id: campaignId } });
  });

  it('should get active campaigns', async () => {
    const active = await campaignService.getActiveCampaigns(testShopId);
    expect(Array.isArray(active)).toBe(true);
    expect(active.some((c) => c.id === campaignId)).toBe(true);
  });

  it('should calculate percentage discount', async () => {
    const result = await campaignService.calculateCampaignDiscount(testShopId, 1000, campaignId);
    expect(result.discount).toBe(100); // 10% of $1000
  });

  it('should generate coupon code', async () => {
    const code = campaignService.generateCouponCode(campaignId);
    expect(code).toHaveLength(10);
    expect(code).toMatch(/^[A-Z0-9]+$/);
  });

  it('should get campaign analytics', async () => {
    const analytics = await campaignService.getCampaignAnalytics(testShopId, campaignId);
    expect(analytics).toHaveProperty('campaign');
    expect(analytics).toHaveProperty('workOrdersAffected');
    expect(analytics).toHaveProperty('estimatedSavings');
  });
});

// Test suite disabled - recurringReminderService deleted (model not in schema)
/* describe('Recurring Reminders Service', () => {
  const testShopId = 'test-shop-1';
  let reminderId: string;
  let vehicleId: string;

  beforeAll(async () => {
    const vehicle = await prisma.vehicle.create({
      data: {
        shopId: testShopId,
        vin: 'REM123456789',
        licensePlate: 'REM001',
        make: 'Honda',
        model: 'Civic',
        year: 2022,
      },
    });
    vehicleId = vehicle.id;

    const reminder = await prisma.recurringReminder.create({
      data: {
        shopId: testShopId,
        vehicleId,
        reminderType: 'vehicle-service',
        frequency: 'monthly',
        message: 'Monthly oil change',
        notificationMethod: ['email', 'sms'],
        status: 'active',
        nextReminderDate: new Date(),
      },
    });
    reminderId = reminder.id;
  });

  afterAll(async () => {
    await prisma.recurringReminder.deleteMany({ where: { id: reminderId } });
    await prisma.vehicle.deleteMany({ where: { id: vehicleId } });
  });

  it('should get due reminders', async () => {
    const due = await reminderService.getDueReminders(testShopId);
    expect(Array.isArray(due)).toBe(true);
  });

  it('should calculate next reminder date (monthly)', async () => {
    const next = reminderService.calculateNextReminderDate(new Date(), 'monthly');
    const daysUntil = Math.floor((next.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    expect(daysUntil).toBeGreaterThan(20);
    expect(daysUntil).toBeLessThanOrEqual(35);
  });

  it('should get vehicle reminders', async () => {
    const reminders = await reminderService.getVehicleReminders(vehicleId);
    expect(Array.isArray(reminders)).toBe(true);
    expect(reminders.some((r) => r.id === reminderId)).toBe(true);
  });

  it('should pause vehicle reminders', async () => {
    await reminderService.pauseVehicleReminders(vehicleId);
    const reminders = await reminderService.getVehicleReminders(vehicleId);
    expect(reminders.every((r) => r.status === 'paused')).toBe(true);
  });
});
*/

// Test suite disabled - dviApprovalService deleted (model not in schema)
/* describe('DVI Approval Service', () => {
  const testShopId = 'test-shop-1';
  let vehicleId: string;

  beforeAll(async () => {
    const vehicle = await prisma.vehicle.create({
      data: {
        shopId: testShopId,
        vin: 'DVI123456789',
        licensePlate: 'DVI001',
        make: 'Chevrolet',
        model: 'Silverado',
        year: 2023,
      },
    });
    vehicleId = vehicle.id;
  });

  afterAll(async () => {
    await prisma.vehicle.deleteMany({ where: { id: vehicleId } });
  });

  it('should get pending approvals', async () => {
    const pending = await dviService.getPendingApprovals(testShopId);
    expect(Array.isArray(pending)).toBe(true);
  });

  it('should check vehicle approval status (no approval = not ready)', async () => {
    const approved = await dviService.isVehicleApprovedForUse(vehicleId);
    expect(approved).toBe(false);
  });

  it('should get vehicles needing DVI renewal', async () => {
    const needsRenewal = await dviService.getVehiclesNeedingDVIRenewal(testShopId, 30);
    expect(Array.isArray(needsRenewal)).toBe(true);
  });

  it('should get DVI statistics', async () => {
    const stats = await dviService.getDVIStats(testShopId);
    expect(stats).toHaveProperty('totalApprovals');
    expect(stats).toHaveProperty('pendingApprovals');
    expect(stats).toHaveProperty('approvalRate');
  });
});
*/
