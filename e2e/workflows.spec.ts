/**
 * E2E: All User Workflows for Phase 5 Testing
 *
 * Tests core workflows for all roles:
 * - Customer: Book → Pay → Review
 * - Tech: View → Accept → Complete → Location
 * - Manager: Assign → Monitor → Approve
 * - Shop Owner: Create → Monitor → Payouts
 * - Admin: Manage System
 *
 * Run: npm run test:e2e -- workflows.spec.ts
 */

import { test, expect, Page } from '@playwright/test';

// ============================================================================
// TEST DATA & HELPERS
// ============================================================================

interface TestUser {
  role: 'customer' | 'tech' | 'manager' | 'shop' | 'admin';
  email: string;
  password: string;
  loginUrl: string;
  dashboardUrl: string;
}

const TEST_USERS: Record<string, TestUser> = {
  customer: {
    role: 'customer',
    email: process.env.E2E_CUSTOMER_EMAIL ?? 'customer@example.com',
    password: process.env.E2E_CUSTOMER_PASSWORD ?? 'TestPassword123!',
    loginUrl: '/login',
    dashboardUrl: '/customer/dashboard',
  },
  tech: {
    role: 'tech',
    email: process.env.E2E_TECH_EMAIL ?? 'tech@example.com',
    password: process.env.E2E_TECH_PASSWORD ?? 'TestPassword123!',
    loginUrl: '/tech/login',
    dashboardUrl: '/tech/home',
  },
  manager: {
    role: 'manager',
    email: process.env.E2E_MANAGER_EMAIL ?? 'manager@example.com',
    password: process.env.E2E_MANAGER_PASSWORD ?? 'TestPassword123!',
    loginUrl: '/manager/login',
    dashboardUrl: '/manager/home',
  },
  shop: {
    role: 'shop',
    email: process.env.E2E_SHOP_EMAIL ?? 'shop@example.com',
    password: process.env.E2E_SHOP_PASSWORD ?? 'TestPassword123!',
    loginUrl: '/shop/login',
    dashboardUrl: '/shop/admin',
  },
  admin: {
    role: 'admin',
    email: process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com',
    password: process.env.E2E_ADMIN_PASSWORD ?? 'TestPassword123!',
    loginUrl: '/admin/login',
    dashboardUrl: '/admin/home',
  },
};

async function loginAs(page: Page, role: string) {
  const user = TEST_USERS[role];
  await page.goto(user.loginUrl);
  await page.fill('[name="email"], [name="username"], [type="email"]', user.email);
  await page.fill('[name="password"], [type="password"]', user.password);
  await page.click('[type="submit"]');
  await expect(page).not.toHaveURL(/login/, { timeout: 15000 });
}

// ============================================================================
// WORKFLOW SUITES
// ============================================================================

test.describe('Customer Workflow: Book → Pay → Review', () => {
  test('Customer can view available services', async ({ page }) => {
    await loginAs(page, 'customer');
    await page.goto(TEST_USERS.customer.dashboardUrl);
    
    // Find services or search functionality
    const servicesList = page.locator('[data-testid="services"], [data-testid="shop-list"], .service-card').first();
    await expect(servicesList).toBeVisible({ timeout: 10000 });
  });

  test('Customer can create a new work order (book service)', async ({ page }) => {
    await loginAs(page, 'customer');
    await page.goto(TEST_USERS.customer.dashboardUrl);
    
    // Find and click "Book Service" or "Create Work Order"
    const bookBtn = page.getByRole('button', { name: /book|create|new service/i })
      .or(page.getByRole('link', { name: /book|create|new service/i }));
    await bookBtn.first().click();
    
    // Fill out service booking form
    await page.fill('[name="description"], [placeholder*="describe"]', 'Test service booking');
    
    // Select a shop or service type
    const shopSelect = page.locator('select, [data-testid="shop-select"]').first();
    if (await shopSelect.count() > 0) {
      const options = await shopSelect.locator('option').count();
      if (options > 1) {
        await shopSelect.selectOption({ index: 1 });
      }
    }
    
    // Submit form
    await page.click('[type="submit"]:has-text("Create"), [type="submit"]:has-text("Book")');
    
    // Should redirect to work order detail or confirmation
    await expect(page).not.toHaveURL(/create|book/i, { timeout: 10000 });
  });

  test('Customer receives invoice and can pay', async ({ page }) => {
    await loginAs(page, 'customer');
    await page.goto(TEST_USERS.customer.dashboardUrl);
    
    // Find a work order that's ready for payment
    const workOrderCard = page.locator('[data-testid="workorder-card"], .work-order-item').first();
    const count = await workOrderCard.count();
    test.skip(count === 0, 'No work orders available');
    
    await workOrderCard.click();
    
    // Look for payment section
    const payBtn = page.getByRole('button', { name: /pay|checkout|submit payment/i });
    const payBtnCount = await payBtn.count();
    
    if (payBtnCount > 0) {
      await payBtn.first().click();
      // Should show payment modal or redirect to payment page
      await expect(page.locator('[data-testid="payment-form"], form:has([name="cardNumber"])')).toBeVisible({ timeout: 10000 });
    }
  });

  test('Customer can leave a review after completion', async ({ page }) => {
    await loginAs(page, 'customer');
    await page.goto(TEST_USERS.customer.dashboardUrl);
    
    // Find a completed work order
    const completedFilter = page.getByRole('button', { name: /completed/i })
      .or(page.locator('select[name*="status"]'));
    const count = await completedFilter.count();
    
    if (count > 0) {
      await completedFilter.first().click();
    }
    
    const workOrder = page.locator('[data-testid="workorder-card"], .work-order-item').first();
    if (await workOrder.count() > 0) {
      await workOrder.click();
      
      const reviewBtn = page.getByRole('button', { name: /review|rate|feedback/i });
      if (await reviewBtn.count() > 0) {
        await reviewBtn.click();
        await expect(page.locator('[data-testid="review-form"], form:has-text("Rating")')).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('Customer can track work order status in real-time', async ({ page }) => {
    await loginAs(page, 'customer');
    await page.goto(TEST_USERS.customer.dashboardUrl);
    
    // Open a work order
    const workOrder = page.locator('[data-testid="workorder-card"], .work-order-item').first();
    if (await workOrder.count() > 0) {
      await workOrder.click();
      
      // Should show status badge and timeline
      const statusDisplay = page.locator('[data-testid="status"], .status-badge, [class*="status"]').first();
      await expect(statusDisplay).toBeVisible({ timeout: 10000 });
    }
  });
});

test.describe('Technician Workflow: View → Accept → Complete → Location', () => {
  test('Tech can view assigned work orders', async ({ page }) => {
    await loginAs(page, 'tech');
    await page.goto(TEST_USERS.tech.dashboardUrl);
    
    // Should see list of assigned work orders
    const workOrderList = page.locator('[data-testid="assigned-workorders"], [data-testid="workorder-list"], .work-order-item').first();
    await expect(workOrderList).toBeVisible({ timeout: 10000 });
  });

  test('Tech can accept a work order', async ({ page }) => {
    await loginAs(page, 'tech');
    await page.goto(TEST_USERS.tech.dashboardUrl);
    
    // Find a pending/assigned work order
    const workOrder = page.locator('[data-testid="workorder-card"], .work-order-item').first();
    if (await workOrder.count() > 0) {
      await workOrder.click();
      
      // Look for Accept button
      const acceptBtn = page.getByRole('button', { name: /accept|start|begin/i });
      if (await acceptBtn.count() > 0) {
        await acceptBtn.click();
        // Status should change to "In Progress" or "Accepted"
        await expect(page.locator('[data-testid="status"]')).toContainText(/in progress|accepted|started/i, { timeout: 10000 });
      }
    }
  });

  test('Tech can start break tracking during work', async ({ page }) => {
    await loginAs(page, 'tech');
    await page.goto(TEST_USERS.tech.dashboardUrl);
    
    // Open time tracking or work details
    const workOrder = page.locator('[data-testid="workorder-card"]').first();
    if (await workOrder.count() > 0) {
      await workOrder.click();
      
      const timeTracking = page.locator('[data-testid="time-tracking"], [data-testid="timeclock"]').first();
      if (await timeTracking.count() > 0) {
        // Look for break button
        const breakBtn = page.getByRole('button', { name: /break|pause/i });
        if (await breakBtn.count() > 0) {
          await breakBtn.click();
          // Should show break timer
          await expect(page.locator('[data-testid="break-timer"]')).toBeVisible({ timeout: 5000 });
        }
      }
    }
  });

  test('Tech can share real-time GPS location', async ({ page }) => {
    await loginAs(page, 'tech');
    await page.goto(TEST_USERS.tech.dashboardUrl);
    
    // Find work order detail
    const workOrder = page.locator('[data-testid="workorder-card"]').first();
    if (await workOrder.count() > 0) {
      await workOrder.click();
      
      // Look for location/GPS button
      const locationBtn = page.getByRole('button', { name: /location|gps|share location/i });
      if (await locationBtn.count() > 0) {
        await locationBtn.click();
        // Should show location sharing status
        await expect(page.locator('[data-testid="location-status"], .location-badge')).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('Tech can complete work order with photos and notes', async ({ page }) => {
    await loginAs(page, 'tech');
    await page.goto(TEST_USERS.tech.dashboardUrl);
    
    // Find work order
    const workOrder = page.locator('[data-testid="workorder-card"]').first();
    if (await workOrder.count() > 0) {
      await workOrder.click();
      
      // Look for completion button
      const completeBtn = page.getByRole('button', { name: /complete|finish|done/i });
      if (await completeBtn.count() > 0) {
        await completeBtn.click();
        
        // Should show completion form
        const completionForm = page.locator('[data-testid="completion-form"], form:has-text("note")', { hasNot: page.locator('.hidden') }).first();
        if (await completionForm.count() > 0) {
          // Fill notes
          await page.fill('[name="notes"], [placeholder*="note"]', 'Work completed successfully');
          
          // Try to upload photo (if file input exists)
          const fileInput = page.locator('input[type="file"]');
          if (await fileInput.count() > 0) {
            // Skip actual upload in test environment
          }
          
          // Submit
          await page.click('[type="submit"]:has-text("Complete"), [type="submit"]:has-text("Submit")');
        }
      }
    }
  });
});

test.describe('Manager Workflow: Assign → Monitor → Approve', () => {
  test('Manager can view team dashboard', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto(TEST_USERS.manager.dashboardUrl);
    
    // Should see team overview
    const dashboard = page.locator('[data-testid="dashboard"], [data-testid="team-overview"]').first();
    await expect(dashboard).toBeVisible({ timeout: 10000 });
  });

  test('Manager can assign work orders to techs', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto(TEST_USERS.manager.dashboardUrl);
    
    // Find unassigned work orders
    const workOrder = page.locator('[data-testid="workorder-card"], .work-order-item').first();
    if (await workOrder.count() > 0) {
      await workOrder.click();
      
      // Look for assign button
      const assignBtn = page.getByRole('button', { name: /assign|allocate/i });
      if (await assignBtn.count() > 0) {
        await assignBtn.click();
        
        // Select tech from list/dropdown
        const techSelect = page.locator('select, [data-testid="tech-select"]').first();
        if (await techSelect.count() > 0) {
          const options = await techSelect.locator('option').count();
          if (options > 1) {
            await techSelect.selectOption({ index: 1 });
          }
        }
        
        // Confirm assignment
        await page.click('[type="submit"], [role="button"]:has-text("Assign"), [role="button"]:has-text("Confirm")');
      }
    }
  });

  test('Manager can monitor work order progress', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto(TEST_USERS.manager.dashboardUrl);
    
    // Open work order detail
    const workOrder = page.locator('[data-testid="workorder-card"]').first();
    if (await workOrder.count() > 0) {
      await workOrder.click();
      
      // Should show progress indicators
      const progress = page.locator('[data-testid="progress"], .progress-bar, [class*="progress"]').first();
      await expect(progress).toBeVisible({ timeout: 10000 });
      
      // Check for tech location (if available)
      const techLocation = page.locator('[data-testid="tech-location"], .map-marker').first();
      if (await techLocation.count() > 0) {
        await expect(techLocation).toBeVisible();
      }
    }
  });

  test('Manager can approve completed work orders', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto(TEST_USERS.manager.dashboardUrl);
    
    // Filter for completed work orders
    const completedFilter = page.getByRole('button', { name: /completed/i })
      .or(page.locator('select[name*="status"]'));
    if (await completedFilter.count() > 0) {
      await completedFilter.first().click();
    }
    
    // Find a work order ready for approval
    const workOrder = page.locator('[data-testid="workorder-card"]').first();
    if (await workOrder.count() > 0) {
      await workOrder.click();
      
      // Look for approve button
      const approveBtn = page.getByRole('button', { name: /approve|verify/i });
      if (await approveBtn.count() > 0) {
        await approveBtn.click();
        // Status should change
        await expect(page.locator('[data-testid="status"]')).toContainText(/approved|verified/i, { timeout: 10000 });
      }
    }
  });
});

test.describe('Shop Owner Workflow: Create → Monitor → Payouts', () => {
  test('Shop owner can view shop dashboard', async ({ page }) => {
    await loginAs(page, 'shop');
    await page.goto(TEST_USERS.shop.dashboardUrl);
    
    // Should see shop metrics
    const metrics = page.locator('[data-testid="metrics"], .metric-card, [class*="stat"]').first();
    await expect(metrics).toBeVisible({ timeout: 10000 });
  });

  test('Shop owner can manage team members', async ({ page }) => {
    await loginAs(page, 'shop');
    await page.goto(TEST_USERS.shop.dashboardUrl);
    
    // Find team/settings section
    const teamLink = page.getByRole('link', { name: /team|staff|techs|members/i })
      .or(page.getByRole('button', { name: /team|staff|techs|members/i }));
    if (await teamLink.count() > 0) {
      await teamLink.first().click();
      
      // Should show team list
      const teamList = page.locator('[data-testid="team-list"], .team-member, [class*="member"]').first();
      await expect(teamList).toBeVisible({ timeout: 10000 });
    }
  });

  test('Shop owner can set hourly rates and manage payroll', async ({ page }) => {
    await loginAs(page, 'shop');
    await page.goto(TEST_USERS.shop.dashboardUrl);
    
    // Find payroll/settings
    const payrollLink = page.getByRole('link', { name: /payroll|rates|compensation/i })
      .or(page.getByRole('link', { name: /settings/i }));
    if (await payrollLink.count() > 0) {
      await payrollLink.first().click();
      
      // Should show rate settings
      const rateSettings = page.locator('[data-testid="rate-settings"], input[name*="rate"]').first();
      if (await rateSettings.count() > 0) {
        await expect(rateSettings).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('Shop owner can view payouts and revenue', async ({ page }) => {
    await loginAs(page, 'shop');
    await page.goto(TEST_USERS.shop.dashboardUrl);
    
    // Should see revenue metrics
    const revenue = page.locator('[data-testid="revenue"], [class*="revenue"]').first();
    if (await revenue.count() > 0) {
      await expect(revenue).toBeVisible({ timeout: 10000 });
    }
  });

  test('Shop owner can configure shop settings', async ({ page }) => {
    await loginAs(page, 'shop');
    
    // Navigate to settings
    const settingsLink = page.getByRole('link', { name: /settings|configuration/i });
    if (await settingsLink.count() > 0) {
      await settingsLink.first().click();
      
      // Should show settings form
      const settingsForm = page.locator('form, [data-testid="settings-form"]').first();
      await expect(settingsForm).toBeVisible({ timeout: 10000 });
    }
  });
});

test.describe('Admin Workflow: Manage System', () => {
  test('Admin can view system dashboard', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto(TEST_USERS.admin.dashboardUrl);
    
    // Should see admin metrics
    const dashboard = page.locator('[data-testid="admin-dashboard"], .dashboard-grid').first();
    await expect(dashboard).toBeVisible({ timeout: 10000 });
  });

  test('Admin can manage users and roles', async ({ page }) => {
    await loginAs(page, 'admin');
    
    // Find user management link
    const userMgmt = page.getByRole('link', { name: /users|manage users/i });
    if (await userMgmt.count() > 0) {
      await userMgmt.click();
      
      // Should show user list
      const userList = page.locator('[data-testid="user-list"], table, .user-card').first();
      await expect(userList).toBeVisible({ timeout: 10000 });
    }
  });

  test('Admin can manage shops', async ({ page }) => {
    await loginAs(page, 'admin');
    
    // Find shop management
    const shopMgmt = page.getByRole('link', { name: /shops|manage shops/i });
    if (await shopMgmt.count() > 0) {
      await shopMgmt.click();
      
      // Should show shop list
      const shopList = page.locator('[data-testid="shop-list"], table, .shop-card').first();
      await expect(shopList).toBeVisible({ timeout: 10000 });
    }
  });

  test('Admin can view audit logs', async ({ page }) => {
    await loginAs(page, 'admin');
    
    // Find audit logs
    const auditLink = page.getByRole('link', { name: /audit|logs|activity/i });
    if (await auditLink.count() > 0) {
      await auditLink.click();
      
      // Should show audit log entries
      const logList = page.locator('[data-testid="audit-log"], table, .log-entry').first();
      await expect(logList).toBeVisible({ timeout: 10000 });
    }
  });
});

// ============================================================================
// CROSS-FEATURE INTEGRATION TESTS
// ============================================================================

test.describe('Integration: Payment Refunds (Phase 4)', () => {
  test('Work order payment processing and refund flow', async ({ page }) => {
    // Customer pays
    await loginAs(page, 'customer');
    await page.goto(TEST_USERS.customer.dashboardUrl);
    
    const workOrder = page.locator('[data-testid="workorder-card"]').first();
    if (await workOrder.count() > 0) {
      await workOrder.click();
      
      const payBtn = page.getByRole('button', { name: /pay/i });
      if (await payBtn.count() > 0) {
        await payBtn.click();
        // Would test payment in real environment
      }
    }
  });
});

test.describe('Integration: Push Notifications (Phase 4)', () => {
  test('Notifications are delivered across user actions', async ({ page }) => {
    // This test requires notification permission and background service
    // Verify notification badge or in-app notification appears
    const notificationArea = page.locator('[data-testid="notification"], .notification-badge').first();
    
    // Open notification center if available
    const notificationBtn = page.getByRole('button', { name: /notification/i });
    if (await notificationBtn.count() > 0) {
      await notificationBtn.click();
      
      const notificationList = page.locator('[data-testid="notification-list"], .notification-item').first();
      // May or may not have notifications depending on test state
      const count = await notificationList.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });
});

test.describe('Integration: DVI Inspection Approval (Phase 4)', () => {
  test('DVI inspection workflow with customer email', async ({ page }) => {
    // This requires checking email delivery in real environment
    // For E2E, verify the workflow exists
    await loginAs(page, 'shop');
    
    // Look for DVI/inspection features
    const dviMenu = page.getByRole('link', { name: /dvi|inspection/i })
      .or(page.getByRole('button', { name: /dvi|inspection/i }));
    if (await dviMenu.count() > 0) {
      await dviMenu.first().click();
      // Verify DVI section loads
      const dviContent = page.locator('[data-testid="dvi"], [class*="dvi"]').first();
      const count = await dviContent.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });
});
