import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import jwt from 'jsonwebtoken';
import { menuHrefs, portalAccessDecision, roleHome, type MenuRole } from '../src/lib/roleMenus';

const SECRET = process.env.JWT_SECRET || 'playwright-shell-secret';

const ROLES: MenuRole[] = ['customer', 'shop', 'manager', 'tech', 'superadmin'];

function sign(role: string) {
  return jwt.sign({
    id: `${role}-links`,
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
  ]);
  await context.addInitScript((payload) => {
    localStorage.setItem('token', payload.token);
    localStorage.setItem('userRole', payload.role);
    localStorage.setItem('userName', payload.name);
    localStorage.setItem('userId', payload.id);
    localStorage.setItem('onboardingCompleted', 'true');
    localStorage.setItem('fixtrayAgreementAccepted', 'true');
    localStorage.setItem('shopProfileComplete', 'true');
    if (payload.owner) {
      localStorage.setItem('isOwner', 'true');
      localStorage.setItem('isSuperAdmin', 'true');
    }
  }, {
    token,
    role,
    name: role === 'superadmin' ? 'Platform Owner' : role,
    id: `${role}-links`,
    owner: role === 'superadmin',
  });
}

function cleanPath(value: string): string {
  const path = value.split('?')[0].split('#')[0].replace(/\/+$/, '');
  return path || '/';
}

function isDynamicRecord(path: string): boolean {
  return /^\/workorders\/(?!roadside$|inshop$|new$|list$)[^/]+$/.test(path)
    || /\/\[[^/]+\]/.test(path)
    || /^\/admin\/shop-details\/[^/]+$/.test(path)
    || /^\/admin\/shops\/[^/]+$/.test(path)
    || /^\/customer\/findshops\/[^/]+$/.test(path)
    || /^\/customer\/workorders\/[^/]+$/.test(path)
    || /^\/shop\/customer-reports\/[^/]+$/.test(path);
}

async function collectTargets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const found = new Set<string>();
    const nodes = document.querySelectorAll('a[href], [data-href], button[formaction]');
    nodes.forEach((node) => {
      const raw = node.getAttribute('href') || node.getAttribute('data-href') || node.getAttribute('formaction') || '';
      if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:') || raw.startsWith('javascript:')) return;
      if (/^https?:\/\//i.test(raw)) {
        try {
          const url = new URL(raw);
          if (url.origin !== window.location.origin) return;
          found.add(`${url.pathname}${url.search}`);
        } catch {
          return;
        }
        return;
      }
      if (raw.startsWith('/')) found.add(raw);
    });
    return [...found];
  });
}

test.describe.configure({ mode: 'serial' });

test.describe('in-page links stay inside each role menu', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'The link crawl runs once on Chromium.');

  for (const role of ROLES) {
    test(`${role} menu pages and their links do not bounce home or 404`, async ({ browser }) => {
      test.setTimeout(600_000);
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        serviceWorkers: 'block',
      });
      await session(context, role);
      const page = await context.newPage();
      page.setDefaultTimeout(20_000);
      page.setDefaultNavigationTimeout(30_000);
      const home = roleHome(role);
      const pages = menuHrefs(role);
      const failures: string[] = [];
      const seen = new Set<string>();

      const checkLanding = async (from: string, requested: string) => {
        const requestedPath = cleanPath(requested);
        const landed = cleanPath(new URL(page.url()).pathname);
        const decision = portalAccessDecision(requestedPath, role);
        if (decision !== 'allow') {
          failures.push(`${role} ${from} links to ${requested} (${decision})`);
          return;
        }
        if (landed.startsWith('/auth/login')) {
          failures.push(`${role} ${from} -> ${requested} sent the session to login`);
          return;
        }
        if (landed === home && requestedPath !== home) {
          failures.push(`${role} ${from} -> ${requested} bounced to ${landed}`);
        }
        const forbidden = await page.getByRole('heading', { name: 'Forbidden' }).count();
        if (forbidden > 0) failures.push(`${role} ${from} -> ${requested} showed Forbidden`);
        const missing = await page.getByRole('heading', { name: /page not found|404/i }).count();
        if (missing > 0 && !isDynamicRecord(requestedPath)) {
          failures.push(`${role} ${from} -> ${requested} showed 404`);
        }
      };

      try {
        if (role === 'customer') {
          await page.goto('/customer/dashboard', { waitUntil: 'domcontentloaded' });
          await expect(page.locator('a[href="/customer/messages"]').first()).toBeVisible({ timeout: 20_000 });
        }
        if (role === 'superadmin') {
          await page.goto('/admin/home', { waitUntil: 'domcontentloaded' });
          await expect(page.locator('aside a[href="/admin/shops"]').first()).toBeVisible({ timeout: 20_000 });
          await expect(page.locator('a[href="/admin/messaging"]').first()).toBeVisible({ timeout: 20_000 });
        }

        for (const href of pages) {
          if (seen.has(`page:${href}`)) continue;
          seen.add(`page:${href}`);
          const response = await page.goto(href, { waitUntil: 'domcontentloaded' });
          if ((response?.status() || 200) >= 400 && !isDynamicRecord(cleanPath(href))) {
            failures.push(`${role} menu ${href} responded ${response?.status()}`);
          }
          await checkLanding('menu', href);
          const targets = await collectTargets(page);
          for (const target of targets) {
            if (target.startsWith('/api/') || target.startsWith('/auth/') || target.startsWith('/_next')) continue;
            const targetPath = cleanPath(target);
            const targetKey = `link:${target}`;
            if (seen.has(targetKey) || pages.some((item) => cleanPath(item) === targetPath && item === target)) {
              const decision = portalAccessDecision(targetPath, role);
              if (decision !== 'allow') failures.push(`${role} ${href} links to ${target} (${decision})`);
              continue;
            }
            seen.add(targetKey);
            const decision = portalAccessDecision(targetPath, role);
            if (decision !== 'allow') {
              failures.push(`${role} ${href} links to ${target} (${decision})`);
              continue;
            }
            const response = await page.goto(target, { waitUntil: 'domcontentloaded' });
            if ((response?.status() || 200) >= 400 && !isDynamicRecord(targetPath)) {
              failures.push(`${role} ${href} -> ${target} responded ${response?.status()}`);
            }
            await checkLanding(href, target);
          }
        }
      } finally {
        await context.close();
      }

      expect(failures, failures.join('\n')).toEqual([]);
    });
  }
});
