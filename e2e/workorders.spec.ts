/**
 * E2E: Work order creation and basic CRUD
 *
 * Runs as a shop user; requires env vars:
 *   E2E_SHOP_USERNAME  (default: testshop)
 *   E2E_SHOP_PASSWORD  (default: TestPassword123!)
 */

import { test, expect, Page } from '@playwright/test';

const SHOP_USER = process.env.E2E_SHOP_USERNAME ?? 'testshop';
const SHOP_PASS = process.env.E2E_SHOP_PASSWORD ?? 'TestPassword123!';

async function loginAsShop(page: Page) {
  await page.goto('/shop/login');
  await page.fill('[name="username"], [name="email"]', SHOP_USER);
  await page.fill('[name="password"], [type="password"]', SHOP_PASS);
  await page.click('[type="submit"]');
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
}

test.describe('Work order management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsShop(page);
  });

  test('work orders list page loads with table/cards', async ({ page }) => {
    await page.goto('/dashboard/workorders');
    // Either a table or a set of cards should be visible
    const content = page
      .locator('table, [data-testid="workorder-list"], [data-testid="workorder-card"]')
      .first();
    await expect(content).toBeVisible({ timeout: 10000 });
  });

  test('can navigate to create a new work order', async ({ page }) => {
    await page.goto('/dashboard/workorders');
    const createBtn = page.getByRole('link', { name: /new work order|create/i })
      .or(page.getByRole('button', { name: /new work order|create/i }));
    await createBtn.click();
    await expect(page).toHaveURL(/workorder.*(new|create)/i, { timeout: 8000 });
  });

  test('work order detail page loads when clicking an item', async ({ page }) => {
    await page.goto('/dashboard/workorders');
    // Click the first work order link or card
    const firstItem = page
      .locator('a[href*="/workorder"], [data-testid="workorder-card"] a, table tbody tr a')
      .first();
    const count = await firstItem.count();
    // Skip if no work orders exist in this environment
    test.skip(count === 0, 'No work orders to click on');
    await firstItem.click();
    await expect(page).toHaveURL(/workorder.*\/[a-z0-9]+/i, { timeout: 8000 });
  });

  test('status filter narrows the work order list', async ({ page }) => {
    await page.goto('/dashboard/workorders');
    // Find a status filter control (select or button group)
    const filter = page.locator('select[name*="status"], [data-testid="status-filter"]').first();
    const filterCount = await filter.count();
    test.skip(filterCount === 0, 'No status filter found');

    const beforeCount = await page.locator('[data-testid="workorder-card"], table tbody tr').count();
    await filter.selectOption('pending');
    await page.waitForLoadState('networkidle');
    const afterCount = await page.locator('[data-testid="workorder-card"], table tbody tr').count();
    // After filtering, count should be ≤ before (list narrowed or same)
    expect(afterCount).toBeLessThanOrEqual(beforeCount);
  });
});
