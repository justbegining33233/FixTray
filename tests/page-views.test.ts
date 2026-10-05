import crypto from 'crypto';
import fs from 'fs';
import { NextRequest } from 'next/server';
import { generateAccessToken } from '../src/lib/auth';
import { allMobileNavHrefs, mobileNavForActor } from '../src/lib/mobileRoleNav';
import { hashVisitorIp } from '../src/lib/pageViews';
import { checkRateLimit } from '../src/lib/rateLimit';
import { menuHrefs, portalAccessDecision, renderedMenuHrefs } from '../src/lib/roleMenus';
import { PLATFORM_VISITS_HREF } from '../src/lib/platformVisits';
import { gateCrossRole } from '../src/proxy';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    pageView: {
      create: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/rateLimit', () => ({
  checkRateLimit: jest.fn(async () => ({ success: true, remaining: 1, resetTime: 0 })),
  getClientIP: (request: Request) => {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    const realIP = request.headers.get('x-real-ip');
    if (realIP) return realIP.trim();
    return 'unknown';
  },
}));

import prisma from '../src/lib/prisma';
import { GET as getLegacy, POST } from '../src/app/api/analytics/pageview/route';
import { GET as getVisits } from '../src/app/api/admin/visits/route';

const pageView = prisma.pageView as unknown as {
  create: jest.Mock;
  count: jest.Mock;
  groupBy: jest.Mock;
  findMany: jest.Mock;
};
const limit = checkRateLimit as jest.Mock;

const IP = '203.0.113.10';
const OTHER_IP = '198.51.100.20';
const SESSION = '11111111-1111-4111-8111-111111111111';

function tokenFor(username: string, role: string, extra: Record<string, unknown> = {}) {
  return generateAccessToken({ id: username, username, role, ...extra });
}

function visitRequest(token?: string) {
  return new NextRequest('http://localhost/api/admin/visits', {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe('page views', () => {
  const originalSalt = process.env.PAGE_VIEW_IP_SALT;

  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'page-view-test-secret';
  });

  beforeEach(() => {
    process.env.PAGE_VIEW_IP_SALT = 'page-view-test-salt';
    pageView.create.mockReset();
    pageView.count.mockReset();
    pageView.groupBy.mockReset();
    pageView.findMany.mockReset();
    limit.mockClear();
    pageView.create.mockResolvedValue({ id: 'pv_1' });
  });

  afterAll(() => {
    if (originalSalt === undefined) delete process.env.PAGE_VIEW_IP_SALT;
    else process.env.PAGE_VIEW_IP_SALT = originalSalt;
  });

  it('records a page view with a hashed IP and does not store the raw address', async () => {
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await POST(new NextRequest('http://localhost/api/analytics/pageview', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': IP,
        'user-agent': `FixTrayTest ${IP}`,
      },
      body: JSON.stringify({
        path: '/pricing?token=secret',
        sessionId: SESSION,
        referrer: 'https://news.example/story?utm=1',
        ip: OTHER_IP,
      }),
    }));

    const hash = hashVisitorIp(IP);
    expect(response.status).toBe(200);
    expect(hash).toHaveLength(64);
    expect(hash).toBe(crypto.createHash('sha256').update(`page-view-test-salt|${IP}`).digest('hex'));
    expect(pageView.create).toHaveBeenCalledTimes(1);
    const data = pageView.create.mock.calls[0][0].data;
    expect(data).toEqual({
      path: '/pricing',
      userAgent: 'FixTrayTest',
      ipHash: hash,
      sessionId: SESSION,
      referrer: 'https://news.example/story',
    });
    const stored = JSON.stringify(data);
    expect(stored).not.toContain(IP);
    expect(stored).not.toContain(OTHER_IP);
    expect(stored).not.toContain('token=secret');
    expect(stored).not.toContain('utm=1');
    expect(JSON.stringify(await response.json())).not.toContain(IP);
    const rateKey = String(limit.mock.calls[0][0]);
    expect(rateKey).toBe(`pageview:${hash}`);
    expect(rateKey).not.toContain(IP);

    pageView.create.mockRejectedValueOnce(new Error(`database ${IP}`));
    const failed = await POST(new NextRequest('http://localhost/api/analytics/pageview', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': IP },
      body: JSON.stringify({ path: '/about', sessionId: SESSION }),
    }));
    expect(failed.status).toBe(500);
    expect(JSON.stringify(await failed.json())).not.toContain(IP);
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(IP);
    expect(errorLog).toHaveBeenCalledWith('Failed to record page view');
    errorLog.mockRestore();

    const layout = fs.readFileSync('src/app/layout.tsx', 'utf8');
    const tracker = fs.readFileSync('src/components/PageViewTracker.tsx', 'utf8');
    expect(layout).toContain('<PageViewTracker />');
    expect(tracker).toContain('/api/analytics/pageview');
    expect(tracker).not.toContain('resend');
  });

  it('counts distinct hashed addresses and shows them only to SupAdm1006', async () => {
    pageView.count.mockResolvedValue(2);
    pageView.groupBy.mockResolvedValue([{ ipHash: 'abc' }]);
    pageView.findMany.mockResolvedValue([
      { path: '/pricing', createdAt: new Date('2026-10-04T02:00:00.000Z'), referrer: null },
      { path: '/', createdAt: new Date('2026-10-04T01:00:00.000Z'), referrer: 'https://news.example/story' },
    ]);

    const owner = await getVisits(visitRequest(tokenFor('SupAdm1006', 'admin', { isOwner: true })));
    const legacy = await getLegacy(new NextRequest('http://localhost/api/analytics/pageview', {
      headers: { authorization: `Bearer ${tokenFor('SupAdm1006', 'superadmin', { isSuperAdmin: true })}` },
    }));
    const body = await owner.json();
    expect(owner.status).toBe(200);
    expect(legacy.status).toBe(200);
    expect(body).toEqual({
      visitCount: 2,
      uniqueVisitors: 1,
      recentPages: [
        { path: '/pricing', createdAt: '2026-10-04T02:00:00.000Z', referrer: null },
        { path: '/', createdAt: '2026-10-04T01:00:00.000Z', referrer: 'https://news.example/story' },
      ],
    });
    expect(JSON.stringify(body)).not.toContain(IP);
    expect(JSON.stringify(body)).not.toContain('ipHash');
    expect(pageView.groupBy).toHaveBeenCalledWith({
      by: ['ipHash'],
      where: { ipHash: { not: null } },
    });
    expect(pageView.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: { path: true, createdAt: true, referrer: true },
      take: 50,
    }));

    pageView.groupBy.mockClear();
    const denied = [
      tokenFor('supadm1006', 'superadmin', { isOwner: true, isSuperAdmin: true }),
      tokenFor('StaffUser', 'superadmin', { isSuperAdmin: true }),
      tokenFor('SupAdm1006', 'shop'),
      tokenFor('SupAdm1006', 'manager'),
      tokenFor('SupAdm1006', 'tech'),
      tokenFor('SupAdm1006', 'customer'),
    ];
    for (const token of denied) {
      const visits = await getVisits(visitRequest(token));
      const oldRoute = await getLegacy(new NextRequest('http://localhost/api/analytics/pageview', {
        headers: { authorization: `Bearer ${token}` },
      }));
      expect(visits.status).toBe(403);
      expect(oldRoute.status).toBe(403);
    }
    const anonymous = await getVisits(visitRequest());
    expect(anonymous.status).toBe(401);
    expect(pageView.groupBy).not.toHaveBeenCalled();

    const page = fs.readFileSync('src/app/admin/visits/page.tsx', 'utf8');
    const route = fs.readFileSync('src/app/api/admin/visits/route.ts', 'utf8');
    expect(`${page}\n${route}`).not.toContain('resend');
  });

  it('opens the visits page only for SupAdm1006', async () => {
    expect(menuHrefs('superadmin')).not.toContain(PLATFORM_VISITS_HREF);
    expect(renderedMenuHrefs('admin', 'superadmin', true)).not.toContain(PLATFORM_VISITS_HREF);
    expect(renderedMenuHrefs('admin', 'superadmin', true, 'supadm1006')).not.toContain(PLATFORM_VISITS_HREF);
    expect(renderedMenuHrefs('admin', 'superadmin', true, 'StaffUser')).not.toContain(PLATFORM_VISITS_HREF);
    expect(renderedMenuHrefs('shop', 'shop', false, 'SupAdm1006')).not.toContain(PLATFORM_VISITS_HREF);
    expect(renderedMenuHrefs('manager', 'manager', false, 'SupAdm1006')).not.toContain(PLATFORM_VISITS_HREF);
    expect(renderedMenuHrefs('tech', 'tech', false, 'SupAdm1006')).not.toContain(PLATFORM_VISITS_HREF);
    expect(renderedMenuHrefs('customer', 'customer', false, 'SupAdm1006')).not.toContain(PLATFORM_VISITS_HREF);
    expect(renderedMenuHrefs('admin', 'superadmin', true, 'SupAdm1006')).toContain(PLATFORM_VISITS_HREF);

    for (const role of ['shop', 'manager', 'tech', 'customer'] as const) {
      const nav = mobileNavForActor(role, { role, username: 'SupAdm1006' });
      expect(nav).not.toBeNull();
      expect(allMobileNavHrefs(nav!)).not.toContain(PLATFORM_VISITS_HREF);
    }
    const ownerNav = mobileNavForActor('admin', { role: 'superadmin', isOwner: true, isSuperAdmin: true, username: 'SupAdm1006' });
    const staffNav = mobileNavForActor('admin', { role: 'superadmin', isSuperAdmin: true, username: 'StaffUser' });
    expect(allMobileNavHrefs(ownerNav!)).toContain(PLATFORM_VISITS_HREF);
    expect(allMobileNavHrefs(staffNav!)).not.toContain(PLATFORM_VISITS_HREF);

    expect(portalAccessDecision('/admin/visits', { role: 'admin', username: 'SupAdm1006' })).toBe('allow');
    expect(portalAccessDecision('/admin/visits', { role: 'superadmin', username: 'SupAdm1006', isOwner: false })).toBe('allow');
    expect(portalAccessDecision('/admin/visits', 'superadmin')).toBe('home');
    expect(portalAccessDecision('/admin/visits', { role: 'superadmin', username: 'supadm1006', isOwner: true })).toBe('home');
    expect(portalAccessDecision('/admin/visits', { role: 'admin', username: 'StaffUser', isSuperAdmin: true })).toBe('home');
    for (const role of ['shop', 'manager', 'tech', 'customer'] as const) {
      expect(portalAccessDecision('/admin/visits', role)).toBe('forbidden');
      expect(portalAccessDecision('/admin/visits', { role, username: 'SupAdm1006', isOwner: true })).toBe('forbidden');
    }

    process.env.JWT_SECRET = process.env.JWT_SECRET || 'page-view-test-secret';
    const exactAdmin = tokenFor('SupAdm1006', 'admin', { isOwner: true });
    const exactSuper = tokenFor('SupAdm1006', 'superadmin', { isSuperAdmin: true });
    for (const token of [exactAdmin, exactSuper]) {
      const gate = await gateCrossRole(new NextRequest('http://localhost/admin/visits', {
        headers: { cookie: `sos_auth=${token}` },
      }));
      expect(gate).toBeNull();
    }

    for (const token of [
      tokenFor('supadm1006', 'admin', { isOwner: true, isSuperAdmin: true }),
      tokenFor('StaffUser', 'superadmin', { isSuperAdmin: true }),
    ]) {
      const gate = await gateCrossRole(new NextRequest('http://localhost/admin/visits', {
        headers: { cookie: `sos_auth=${token}` },
      }));
      expect(gate?.status).toBe(307);
      expect(gate?.headers.get('location')).toBe('http://localhost/admin/home');
    }

    for (const token of [
      tokenFor('SupAdm1006', 'shop'),
      tokenFor('mgr', 'manager'),
      tokenFor('tech', 'tech'),
      tokenFor('customer', 'customer'),
    ]) {
      const gate = await gateCrossRole(new NextRequest('http://localhost/admin/visits', {
        headers: { cookie: `sos_auth=${token}` },
      }));
      expect(gate?.headers.get('x-middleware-rewrite') || '').toContain('/forbidden');
    }
  });
});
