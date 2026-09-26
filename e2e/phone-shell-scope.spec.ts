import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'playwright-shell-secret';

const SCROLL_PAGES = [
  { path: '/admin/user-management', role: 'superadmin' },
  { path: '/admin/activity-logs', role: 'superadmin' },
  { path: '/shop/reports', role: 'shop' },
  { path: '/shop/settings', role: 'shop' },
  { path: '/manager/team', role: 'manager' },
  { path: '/tech/jobs', role: 'tech' },
  { path: '/customer/history', role: 'customer' },
] as const;

const OWNER_REDIRECTS = [
  '/shop/dvi',
  '/shop/profile',
  '/manager/admin',
  '/tech/home',
  '/customer/features',
  '/reports',
  '/tech-offline/',
  '/admin/dvi-approvals',
];

const SHOP_MORE_STILL_THERE = ['Offline', 'Inventory', 'Environmental Fees', 'Campaigns'];
const OWNER_MORE_GONE = ['Offline', 'DVI Approvals', 'Compliance', 'Inventory', 'Environmental Fees', 'Campaigns', 'Performance'];
const OWNER_MORE_KEPT = ['Pending Shops', 'User Management', 'Platform Settings', 'Revenue & Payouts', 'Health Check', 'Activity Logs', 'Messaging'];

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
  });
}

async function probeScroll(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  const shell = page.locator('[data-mobile-shell-body]');
  await expect(shell).toBeVisible({ timeout: 20000 });
  await page.evaluate(() => {
    const body = document.querySelector('[data-mobile-shell-body]');
    if (!body) return;
    const spacer = document.createElement('div');
    spacer.dataset.scrollProbe = '1';
    spacer.style.height = '2400px';
    body.appendChild(spacer);
  });
  const metrics = await shell.evaluate((node) => ({
    scrollHeight: node.scrollHeight,
    clientHeight: node.clientHeight,
  }));
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);

  await shell.evaluate((node) => { node.scrollTop = 0; });
  await shell.hover();
  await page.mouse.wheel(0, 700);
  await expect.poll(() => shell.evaluate((node) => node.scrollTop), { timeout: 3000 }).toBeGreaterThan(40);

  await shell.evaluate((node) => { node.scrollTop = 0; });
  const box = await shell.boundingBox();
  if (!box) throw new Error(`no shell box for ${path}`);
  const client = await page.context().newCDPSession(page);
  const x = box.x + box.width / 2;
  const y1 = box.y + Math.min(box.height * 0.72, box.height - 24);
  const y2 = box.y + 40;
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y1, id: 1 }] });
  for (let step = 1; step <= 6; step += 1) {
    const y = y1 + ((y2 - y1) * step) / 6;
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] });
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await client.detach();
  await expect.poll(() => shell.evaluate((node) => node.scrollTop), { timeout: 3000 }).toBeGreaterThan(40);
}

test.describe('phone shell scroll and platform owner scope', () => {
  test.describe.configure({ mode: 'serial' });

  for (const mode of [
    { name: 'android-app-phone', width: 390, height: 844, ua: 'FixTray-Android-App-Pro', native: true },
    { name: 'android-app-tablet', width: 800, height: 1280, ua: 'FixTray-Android-App-Pro', native: true },
    { name: 'phone-browser', width: 390, height: 844, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', native: false },
  ]) {
    for (const target of SCROLL_PAGES) {
      test(`${mode.name} scrolls ${target.path}`, async ({ browser }) => {
        const context = await browser.newContext({
          viewport: { width: mode.width, height: mode.height },
          userAgent: mode.ua,
          hasTouch: true,
        });
        await session(context, target.role, mode.native);
        const page = await context.newPage();
        try {
          await probeScroll(page, target.path);
        } finally {
          await context.close();
        }
      });
    }
  }

  test('platform owner tabs and More stay on platform pages', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'FixTray-Android-App-Pro',
      hasTouch: true,
    });
    await session(context, 'superadmin', true);
    const page = await context.newPage();
    try {
      await page.goto('/admin/home', { waitUntil: 'domcontentloaded' });
      const bar = page.locator('[data-role-tab-bar="superadmin"]');
      await expect(bar).toBeVisible({ timeout: 20000 });
      await expect(bar).toContainText('Overview');
      await expect(bar).toContainText('Shops');
      await expect(bar).toContainText('Customers');
      await expect(bar).toContainText('Analytics');
      await bar.getByRole('button', { name: 'More' }).click();
      const more = page.locator('[data-role-more="open"]');
      await expect(more).toBeVisible();
      const labels = await more.locator('button').allInnerTexts();
      const flat = labels.join('\n');
      for (const gone of OWNER_MORE_GONE) expect(flat).not.toContain(gone);
      for (const kept of OWNER_MORE_KEPT) expect(flat).toContain(kept);
    } finally {
      await context.close();
    }
  });

  test('platform owner is sent home from shop pages', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'FixTray-Android-App-Pro',
    });
    await session(context, 'superadmin', true);
    const page = await context.newPage();
    try {
      for (const path of OWNER_REDIRECTS) {
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/\/admin\/home$/, { timeout: 20000 });
      }
      await page.goto('/admin/home');
      await page.evaluate(() => {
        const anchor = document.createElement('a');
        anchor.href = '/shop/profile';
        anchor.textContent = 'shop profile';
        document.body.appendChild(anchor);
        anchor.click();
      });
      await expect(page).toHaveURL(/\/admin\/home$/, { timeout: 20000 });
    } finally {
      await context.close();
    }
  });

  test('shop, manager, tech, and customer still reach their pages and 403 on admin', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      hasTouch: true,
    });
    await session(context, 'shop', false);
    const page = await context.newPage();
    try {
      await page.goto('/shop/reports', { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/shop\/reports/);
      await expect(page.locator('[data-mobile-shell-body]')).toBeVisible({ timeout: 20000 });
      const bar = page.locator('[data-role-tab-bar="shop"]');
      await bar.getByRole('button', { name: 'More' }).click();
      const more = page.locator('[data-role-more="open"]');
      const flat = (await more.locator('button').allInnerTexts()).join('\n');
      for (const label of SHOP_MORE_STILL_THERE) expect(flat).toContain(label);

      await page.goto('/admin/user-management', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Forbidden' })).toBeVisible({ timeout: 20000 });
    } finally {
      await context.close();
    }

    for (const [role, path] of [['manager', '/manager/team'], ['tech', '/tech/jobs'], ['customer', '/customer/history']] as const) {
      const roleContext = await browser.newContext({
        viewport: { width: 390, height: 844 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      });
      await session(roleContext, role, false);
      const rolePage = await roleContext.newPage();
      try {
        await rolePage.goto(path, { waitUntil: 'domcontentloaded' });
        await expect(rolePage).toHaveURL(new RegExp(`${path}$`));
        await expect(rolePage.locator('[data-mobile-shell-body]')).toBeVisible({ timeout: 20000 });
        await rolePage.goto('/admin/pending-shops', { waitUntil: 'domcontentloaded' });
        await expect(rolePage.getByRole('heading', { name: 'Forbidden' })).toBeVisible({ timeout: 20000 });
      } finally {
        await roleContext.close();
      }
    }
  });

  test('a stale cached tech-offline page does not keep the platform owner', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'FixTray-Android-App-Pro',
      serviceWorkers: 'allow',
    });
    await session(context, 'superadmin', true);
    const page = await context.newPage();
    try {
      await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => navigator.serviceWorker?.controller, undefined, { timeout: 20000 });
      await page.evaluate(async () => {
        const cache = await caches.open('fixtray-v8');
        const stale = '<!doctype html><html><head><title>stale</title></head><body><h1>STUCK OFFLINE</h1></body></html>';
        const response = new Response(stale, { headers: { 'Content-Type': 'text/html' } });
        await cache.put('/tech-offline/index.html', response);
      });
      await context.setOffline(true);
      await page.goto('/tech-offline/', { waitUntil: 'domcontentloaded' });
      await expect(page.getByText('STUCK OFFLINE')).toBeVisible({ timeout: 15000 });
      await expect.poll(() => page.evaluate(() => typeof (window as Window & { fixtrayLeavePlatformOwner?: unknown }).fixtrayLeavePlatformOwner)).toBe('function');
      await context.setOffline(false);
      await page.evaluate(() => window.dispatchEvent(new Event('online')));
      await expect(page).toHaveURL(/\/admin\/home$/, { timeout: 20000 });
    } finally {
      await context.setOffline(false);
      await context.close();
    }
  });
});
