import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import jwt from 'jsonwebtoken';
import { menuHrefs, roleHome, type MenuRole } from '../src/lib/roleMenus';

const SECRET = process.env.JWT_SECRET || 'playwright-shell-secret';

const ROLES: { role: MenuRole; home: string; bar: string }[] = [
  { role: 'superadmin', home: '/admin/home', bar: 'superadmin' },
  { role: 'shop', home: '/shop/home', bar: 'shop' },
  { role: 'manager', home: '/manager/home', bar: 'manager' },
  { role: 'tech', home: '/tech/home', bar: 'tech' },
  { role: 'customer', home: '/customer/dashboard', bar: 'customer' },
];

const BLOCKED: Record<MenuRole, string[]> = {
  superadmin: ['/superadmin/dashboard', '/admin/security-settings', '/admin/command-center', '/admin', '/superadmin'],
  shop: ['/reports', '/tech-offline'],
  manager: [
    '/shop/automations',
    '/shop/campaigns',
    '/shop/condition-reports',
    '/shop/customers/cust-1/crm',
    '/shop/environmental-fees',
    '/shop/eod-report',
    '/shop/inspections',
    '/shop/loaners',
    '/shop/parts-labor',
    '/shop/photos',
    '/shop/purchase-orders-receiving',
    '/shop/team-performance',
    '/shop/calendar',
    '/reports',
  ],
  tech: ['/shop/calendar', '/reports'],
  customer: ['/reports', '/customer/features'],
};

function sign(role: string) {
  return jwt.sign({
    id: `${role}-menu`,
    username: role === 'superadmin' ? 'supadm1006' : role,
    role,
    isOwner: role === 'superadmin',
    isSuperAdmin: role === 'superadmin',
  }, SECRET, { expiresIn: '2h' });
}

async function session(context: BrowserContext, role: string) {
  const token = sign(role);
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  await context.addCookies([
    { name: 'sos_auth', value: token, url: base, httpOnly: true, sameSite: 'Lax' },
    { name: 'x-fixtray-native', value: 'android', url: base, httpOnly: false, sameSite: 'Lax' },
  ]);
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
    id: `${role}-menu`,
    owner: role === 'superadmin',
  });
}

async function openRole(browser: import('@playwright/test').Browser, role: string) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'FixTray-Android-App-Pro',
    hasTouch: true,
    serviceWorkers: 'block',
  });
  await session(context, role);
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  page.setDefaultNavigationTimeout(30_000);
  return { context, page };
}

async function renderedHrefs(page: Page, bar: string): Promise<string[]> {
  const shell = page.locator(`[data-role-tab-bar="${bar}"][data-shell-ready="1"]`);
  await expect(shell).toBeVisible({ timeout: 20_000 });
  const tabs = await shell.locator('[data-tab-href]').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-tab-href') || '').filter(Boolean));
  const more = await page.locator('[data-more-href]').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-more-href') || '').filter(Boolean));
  return [...tabs, ...more];
}

test.describe('app menus match the computer menu', () => {
  for (const target of ROLES) {
    test(`${target.role} app hrefs match the web menu and blocked pages go home`, async ({ browser }) => {
      test.setTimeout(180_000);
      const { context, page } = await openRole(browser, target.role);
      try {
        await page.goto(target.home, { waitUntil: 'domcontentloaded' });
        const hrefs = await renderedHrefs(page, target.bar);
        expect(hrefs.slice().sort()).toEqual(menuHrefs(target.role).slice().sort());

        const home = roleHome(target.role);
        for (const path of BLOCKED[target.role]) {
          await page.goto(path, { waitUntil: 'domcontentloaded' });
          await expect(page, path).toHaveURL(new RegExp(`${home.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), { timeout: 20_000 });
          await expect(page.getByRole('heading', { name: 'Forbidden' })).toHaveCount(0);
        }

        await page.goto('/admin/user-management', { waitUntil: 'domcontentloaded' });
        if (target.role === 'superadmin') {
          await expect(page).toHaveURL(/\/admin\/user-management$/);
        } else {
          await expect(page.getByRole('heading', { name: 'Forbidden' })).toBeVisible({ timeout: 20_000 });
        }
      } finally {
        await context.close();
      }
    });
  }
});
