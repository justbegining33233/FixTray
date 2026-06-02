/**
 * E2E: Customer login + logout flow
 *
 * Requires a running app (started automatically by playwright.config.ts webServer).
 * Set env vars to seed a test account:
 *   E2E_CUSTOMER_EMAIL    (default: e2e_test@example.com)
 *   E2E_CUSTOMER_PASSWORD (default: TestPassword123!)
 */

import { test, expect } from '@playwright/test';

const EMAIL = process.env.E2E_CUSTOMER_EMAIL ?? 'e2e_test@example.com';
const PASSWORD = process.env.E2E_CUSTOMER_PASSWORD ?? 'TestPassword123!';

test.describe('Customer authentication', () => {
  test('shows validation errors on empty form submission', async ({ page }) => {
    await page.goto('/login');
    await page.click('[type="submit"]');
    // Some error indicator should appear
    const errorText = page.locator('[role="alert"], .error, [data-testid="form-error"]').first();
    await expect(errorText).toBeVisible({ timeout: 5000 });
  });

  test('shows an error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"], [type="email"]', 'nobody@example.com');
    await page.fill('[name="password"], [type="password"]', 'wrongpassword');
    await page.click('[type="submit"]');
    await expect(page.getByText(/invalid credentials|incorrect|not found/i)).toBeVisible({ timeout: 8000 });
  });

  test('redirects to dashboard after successful login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"], [type="email"]', EMAIL);
    await page.fill('[name="password"], [type="password"]', PASSWORD);
    await page.click('[type="submit"]');
    // Wait for redirect away from /login
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
    // Should land on a dashboard or home page
    await expect(page).toHaveURL(/\/(dashboard|home|portal|\?|$)/, { timeout: 10000 });
  });

  test('redirects to login after logout', async ({ page }) => {
    // Log in first
    await page.goto('/login');
    await page.fill('[name="email"], [type="email"]', EMAIL);
    await page.fill('[name="password"], [type="password"]', PASSWORD);
    await page.click('[type="submit"]');
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });

    // Find and click a logout button
    const logoutBtn = page.getByRole('button', { name: /log\s*out|sign\s*out/i })
      .or(page.getByRole('link', { name: /log\s*out|sign\s*out/i }));
    await logoutBtn.click();

    // Should return to login or home
    await expect(page).toHaveURL(/\/(login|$)/, { timeout: 8000 });
  });

  test('protects authenticated routes from unauthenticated access', async ({ page }) => {
    // Navigate directly to a protected page without logging in
    await page.goto('/dashboard');
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
  });
});
