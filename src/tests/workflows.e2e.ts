import { test, expect } from '@playwright/test';

test.describe('E2E: Fleet Management Workflow', () => {
  test('should create fleet account and vehicle', async ({ page }) => {
    await page.goto('http://localhost:3000/shop/fleet');

    // Create new fleet account
    await page.click('button:has-text("New Fleet Account")');
    await page.fill('input[name="companyName"]', 'Test Fleet Company');
    await page.fill('input[name="contactName"]', 'John Doe');
    await page.fill('input[name="contactEmail"]', 'john@fleet.com');
    await page.fill('input[name="creditLimit"]', '50000');

    await page.click('button:has-text("Create")');

    // Verify account created
    await expect(page.locator('text=Test Fleet Company')).toBeVisible();

    // Add vehicle
    await page.click('button:has-text("Add Vehicle")');
    await page.fill('input[name="make"]', 'Toyota');
    await page.fill('input[name="model"]', 'Camry');
    await page.fill('input[name="year"]', '2023');

    await page.click('button:has-text("Add")');
    await expect(page.locator('text=Toyota Camry')).toBeVisible();
  });

  test('should create and track invoice', async ({ page }) => {
    await page.goto('http://localhost:3000/shop/fleet');

    // Create invoice
    await page.click('button:has-text("New Invoice")');
    await page.fill('input[name="amount"]', '5000');
    await page.click('button:has-text("Generate")');

    // Verify invoice created
    await expect(page.locator('text=Invoice')).toBeVisible();

    // Record payment
    await page.click('button:has-text("Record Payment")');
    await page.fill('input[name="amount"]', '2500');
    await page.click('button:has-text("Confirm")');

    await expect(page.locator('text=Payment recorded')).toBeVisible();
  });
});

test.describe('E2E: Shift Scheduling Workflow', () => {
  test('should create shift and detect conflicts', async ({ page }) => {
    await page.goto('http://localhost:3000/manager/schedule');

    // Select employee
    await page.click('select[name="techId"]');
    await page.click('option:first-of-type');

    // Create shift
    await page.click('button:has-text("Add Shift")');
    await page.fill('input[name="startTime"]', '09:00');
    await page.fill('input[name="endTime"]', '17:00');
    await page.click('button:has-text("Create")');

    await expect(page.locator('text=Shift created')).toBeVisible();

    // Try to create overlapping shift
    await page.click('button:has-text("Add Shift")');
    await page.fill('input[name="startTime"]', '08:00');
    await page.fill('input[name="endTime"]', '11:00');
    await page.click('button:has-text("Create")');

    // Should show conflict error
    await expect(page.locator('text=Conflict detected')).toBeVisible();
  });

  test('should request and approve shift swap', async ({ page }) => {
    await page.goto('http://localhost:3000/tech/my-shifts');

    // Request shift swap
    await page.click('button:has-text("Request Swap")');
    await page.click('button:has-text("Select Target")');
    await page.click('option:first-of-type');
    await page.click('button:has-text("Request")');

    await expect(page.locator('text=Swap requested')).toBeVisible();

    // Manager approves swap
    await page.goto('http://localhost:3000/manager/schedule');
    await page.click('button:has-text("Pending Swaps")');
    await page.click('button:has-text("Approve")');

    await expect(page.locator('text=Swap approved')).toBeVisible();
  });
});

test.describe('E2E: Leave/PTO Workflow', () => {
  test('should request vacation leave', async ({ page }) => {
    await page.goto('http://localhost:3000/tech/leave-requests');

    // Request vacation
    await page.click('button:has-text("New Leave Request")');
    await page.click('button:has-text("Vacation")');
    
    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + 5);

    await page.fill('input[type="date"]', start.toISOString().split('T')[0]);
    await page.fill('input[type="date"]:last-of-type', end.toISOString().split('T')[0]);

    await page.click('button:has-text("Request")');

    await expect(page.locator('text=Leave request submitted')).toBeVisible();

    // Manager approves
    await page.goto('http://localhost:3000/manager/leave-requests');
    await page.click('button:has-text("Approve")');

    await expect(page.locator('text=Leave approved')).toBeVisible();
  });

  test('should enforce max 10 consecutive vacation days', async ({ page }) => {
    await page.goto('http://localhost:3000/tech/leave-requests');

    await page.click('button:has-text("New Leave Request")');
    await page.click('button:has-text("Vacation")');

    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + 15); // 15 days exceeds max

    await page.fill('input[type="date"]', start.toISOString().split('T')[0]);
    await page.fill('input[type="date"]:last-of-type', end.toISOString().split('T')[0]);

    await page.click('button:has-text("Request")');

    // Should show validation error
    await expect(page.locator('text=Maximum 10 consecutive days')).toBeVisible();
  });
});

test.describe('E2E: Loaner Vehicle Workflow', () => {
  test('should checkout and checkin loaner vehicle', async ({ page }) => {
    await page.goto('http://localhost:3000/shop/loaners');

    // Checkout vehicle
    await page.click('button:has-text("Checkout")');
    await page.fill('input[name="customerName"]', 'Jane Smith');
    await page.fill('input[name="workOrderId"]', 'WO-12345');
    await page.fill('input[name="mileageOut"]', '50000');
    await page.click('select[name="fuelLevel"]');
    await page.click('option:has-text("Full")');

    await page.click('button:has-text("Checkout")');
    await expect(page.locator('text=Vehicle checked out')).toBeVisible();

    // Checkin vehicle
    await page.click('button:has-text("Checkin")');
    await page.fill('input[name="mileageIn"]', '50500');
    await page.fill('input[name="damageNotes"]', 'Minor scratch on right side');

    await page.click('button:has-text("Checkin")');
    await expect(page.locator('text=Vehicle checked in')).toBeVisible();
    await expect(page.locator('text=Mileage: 500 miles')).toBeVisible();
  });
});

test.describe('E2E: State Inspections Workflow', () => {
  test('should check compliance dashboard', async ({ page }) => {
    await page.goto('http://localhost:3000/admin/compliance-dashboard');

    // Check statistics
    await expect(page.locator('text=Pass Rate')).toBeVisible();
    await expect(page.locator('text=Expired')).toBeVisible();
    await expect(page.locator('text=Due Soon')).toBeVisible();

    // Filter by status
    await page.click('button:has-text("Expired")');
    await expect(page.locator('text=Vehicles with expired inspections')).toBeVisible();
  });
});

test.describe('E2E: Campaigns Workflow', () => {
  test('should create and apply campaign discount', async ({ page }) => {
    await page.goto('http://localhost:3000/admin/campaigns');

    // Create campaign
    await page.click('button:has-text("New Campaign")');
    await page.fill('input[name="name"]', 'Summer Sale');
    await page.click('input[name="discountType"]');
    await page.click('input[value="percentage"]');
    await page.fill('input[name="discountValue"]', '15');

    await page.click('button:has-text("Create")');
    await expect(page.locator('text=Summer Sale')).toBeVisible();

    // Verify coupon code generated
    await expect(page.locator('text=Coupon:')).toBeVisible();
  });
});

test.describe('E2E: DVI Approval Workflow', () => {
  test('should approve vehicle DVI for use', async ({ page }) => {
    await page.goto('http://localhost:3000/admin/dvi-approvals');

    // Approve pending inspection
    await page.click('button:has-text("Pending")');
    await page.click('button:has-text("Approve")');
    await page.fill('input', '365'); // 365 days until next inspection

    await page.click('button:confirm');
    await expect(page.locator('text=DVI approved')).toBeVisible();

    // Verify vehicle now shows as ready
    await expect(page.locator('text=Ready for use')).toBeVisible();
  });
});

test.describe('E2E: Recurring Reminders Workflow', () => {
  test('should create and manage recurring reminders', async ({ page }) => {
    await page.goto('http://localhost:3000/admin/recurring-reminders');

    // Check active reminders
    await expect(page.locator('button:has-text("Active")')).toBeVisible();
    await page.click('button:has-text("Active")');

    // Pause reminder
    if (await page.locator('button:has-text("Pause")').isVisible()) {
      await page.click('button:has-text("Pause"):first');
      await expect(page.locator('text=paused')).toBeVisible();
    }
  });
});
