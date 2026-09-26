import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'playwright-shell-secret';

const ROLES = [
  { role: 'superadmin', home: '/admin/home', bar: 'superadmin' },
  { role: 'shop', home: '/shop/home', bar: 'shop' },
  { role: 'manager', home: '/manager/home', bar: 'manager' },
  { role: 'tech', home: '/tech/home', bar: 'tech' },
  { role: 'customer', home: '/customer/dashboard', bar: 'customer' },
] as const;

const APP_MODES = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 800, height: 1280 },
] as const;

function sign(role: string) {
  return jwt.sign({
    id: `${role}-pw`,
    username: role === 'superadmin' ? 'supadm1006' : role,
    role,
    isOwner: role === 'superadmin',
    isSuperAdmin: role === 'superadmin',
  }, SECRET, { expiresIn: '2h' });
}

async function session(context: BrowserContext, role: string, native: boolean) {
  const token = sign(role);
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  const cookies: { name: string; value: string; url: string; httpOnly: boolean; sameSite: 'Lax' }[] = [
    { name: 'sos_auth', value: token, url: base, httpOnly: true, sameSite: 'Lax' },
  ];
  if (native) cookies.push({ name: 'x-fixtray-native', value: 'android', url: base, httpOnly: false, sameSite: 'Lax' });
  await context.addCookies(cookies);
  await context.addInitScript((payload) => {
    localStorage.setItem('token', payload.token);
    localStorage.setItem('userRole', payload.role);
    localStorage.setItem('userName', payload.name);
    localStorage.setItem('userId', payload.id);
    localStorage.setItem('onboardingCompleted', 'true');
    localStorage.setItem('fixtrayAgreementAccepted', 'true');
    if (payload.desktop) localStorage.setItem('viewMode', 'desktop');
    if (payload.owner) {
      localStorage.setItem('isOwner', 'true');
      localStorage.setItem('isSuperAdmin', 'true');
    }
  }, {
    token,
    role,
    name: role === 'superadmin' ? 'Platform Owner' : role,
    id: `${role}-pw`,
    owner: role === 'superadmin',
    desktop: false,
  });
}

async function openApp(browser: import('@playwright/test').Browser, role: string, width: number, height: number, desktop = false) {
  const context = await browser.newContext({
    viewport: { width, height },
    userAgent: 'FixTray-Android-App-Pro',
    hasTouch: true,
  });
  await session(context, role, true);
  if (desktop) {
    await context.addInitScript(() => {
      localStorage.setItem('viewMode', 'desktop');
    });
  }
  const page = await context.newPage();
  return { context, page };
}

async function settle(page: Page) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(300);
}

async function stablePath(page: Page) {
  let last = new URL(page.url()).pathname;
  for (let i = 0; i < 10; i += 1) {
    await page.waitForTimeout(200);
    const next = new URL(page.url()).pathname;
    if (next === last) return next;
    last = next;
  }
  throw new Error(`navigation did not settle: ${page.url()}`);
}

async function assertLoaded(page: Page, label: string) {
  const path = await stablePath(page);
  expect(path, label).not.toMatch(/\/auth\/login/);
  const body = await page.locator('body').innerText({ timeout: 15000 }).catch(() => '');
  expect(body, label).not.toMatch(/Application error|Internal Server Error|Unhandled Runtime Error/i);
  expect(body, label).not.toMatch(/Page Not Found|404\s+-\s+Not Found/);
  const bar = page.locator('[data-role-tab-bar]');
  if (path.startsWith('/tech-offline')) {
    await expect(page.locator('#tabbar'), label).toBeVisible({ timeout: 15000 });
  } else {
    await expect(bar, label).toBeVisible({ timeout: 15000 });
  }
  return path;
}

test.describe('app mode navigation has a way back', () => {
  for (const mode of APP_MODES) {
    for (const target of ROLES) {
      test(`${target.role} ${mode.name} tabs, More, and back`, async ({ browser }) => {
        test.setTimeout(420_000);
        const { context, page } = await openApp(browser, target.role, mode.width, mode.height);
        try {
          await page.goto(target.home, { waitUntil: 'domcontentloaded' });
          await page.waitForFunction(() => navigator.serviceWorker?.controller, undefined, { timeout: 8000 }).catch(() => {});
          await settle(page);
          const bar = page.locator(`[data-role-tab-bar="${target.bar}"]`);
          await expect(bar).toBeVisible({ timeout: 20000 });
          await bar.getByRole('button', { name: 'More' }).click();
          const more = page.locator('[data-role-more="open"]');
          await expect(more).toBeVisible();
          await expect(more.getByRole('button', { name: /web view/i })).toHaveCount(0);
          const tabLabels = (await bar.getByRole('button').allInnerTexts())
            .map((label) => label.replace(/\s+/g, ' ').trim())
            .filter((label) => label && !/^more$/i.test(label));
          const moreItems = await more.locator('[data-more-href]').evaluateAll((nodes) =>
            nodes.map((node) => ({
              href: node.getAttribute('data-more-href') || '',
              label: node.getAttribute('data-more-label') || '',
            })),
          );
          await bar.getByRole('button', { name: 'More' }).click();
          await expect(page.locator('[data-role-more="open"]')).toHaveCount(0);

          for (const label of tabLabels) {
            await page.goto(target.home, { waitUntil: 'domcontentloaded' });
            await settle(page);
            const before = new URL(page.url()).pathname;
            await page.locator(`[data-role-tab-bar="${target.bar}"]`).getByRole('button', { name: label, exact: true }).click();
            const landed = await assertLoaded(page, `${target.role} tab ${label}`);
            if (landed !== before) {
              await page.goBack().catch(() => {});
              await assertLoaded(page, `${target.role} back from tab ${label}`);
            }
          }

          for (const item of moreItems) {
            await page.goto(target.home, { waitUntil: 'domcontentloaded' });
            await settle(page);
            const before = new URL(page.url()).pathname;
            await page.locator(`[data-role-tab-bar="${target.bar}"]`).getByRole('button', { name: 'More' }).click();
            const sheet = page.locator('[data-role-more="open"]');
            await expect(sheet).toBeVisible();
            await sheet.locator(`[data-more-href="${item.href}"][data-more-label="${item.label}"]`).first().click();
            const landed = await assertLoaded(page, `${target.role} more ${item.label} ${item.href}`);
            if (landed !== before) {
              await page.goBack().catch(() => {});
              await assertLoaded(page, `${target.role} back from ${item.label}`);
            }
          }
        } finally {
          await context.close();
        }
      });
    }
  }

  test('stored desktop view still shows the app shell and no web view button', async ({ browser }) => {
    const { context, page } = await openApp(browser, 'shop', 800, 1280, true);
    try {
      await page.goto('/shop/home', { waitUntil: 'domcontentloaded' });
      await settle(page);
      await expect(page.locator('[data-role-tab-bar="shop"]')).toBeVisible({ timeout: 20000 });
      await expect(page.locator('[data-desktop-view-escape]')).toHaveCount(0);
      const stored = await page.evaluate(() => localStorage.getItem('viewMode'));
      expect(stored).not.toBe('desktop');
      await page.locator('[data-role-tab-bar="shop"]').getByRole('button', { name: 'More' }).click();
      const more = page.locator('[data-role-more="open"]');
      await expect(more).toBeVisible();
      await expect(more.locator('[data-web-view-toggle]')).toHaveCount(0);
      await expect(more.getByRole('button', { name: /web view/i })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});

test.describe('browser desktop preference always has a way back', () => {
  const families = [
    { role: 'shop', path: '/shop/home' },
    { role: 'manager', path: '/manager/home' },
    { role: 'tech', path: '/tech/home' },
    { role: 'customer', path: '/customer/dashboard' },
    { role: 'superadmin', path: '/admin/home' },
    { role: 'shop', path: '/reports' },
  ] as const;

  for (const family of families) {
    test(`${family.role} ${family.path} shows Mobile View`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        hasTouch: true,
      });
      await session(context, family.role, false);
      await context.addInitScript(() => localStorage.setItem('viewMode', 'desktop'));
      const page = await context.newPage();
      try {
        await page.goto(family.path, { waitUntil: 'domcontentloaded' });
        await settle(page);
        const escape = page.locator('[data-desktop-view-escape]');
        await expect(escape).toBeVisible({ timeout: 20000 });
        await expect(escape.getByRole('button', { name: /mobile view/i })).toBeVisible();
      } finally {
        await context.close();
      }
    });
  }
});
