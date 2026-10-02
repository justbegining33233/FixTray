import fs from 'fs';
import { NextRequest } from 'next/server';
import { generateAccessToken } from '../src/lib/auth';
import { allMobileNavHrefs, MOBILE_ROLE_NAVS, mobileNavForActor } from '../src/lib/mobileRoleNav';
import {
  isPlatformEmailAccount,
  platformFromHeader,
  PLATFORM_EMAIL_HREF,
} from '../src/lib/platformEmailAccess';
import {
  listRecentPlatformMail,
  preparePlatformSend,
  readPlatformMail,
  sendPlatformMail,
} from '../src/lib/platformMailbox';
import { menuHrefs, portalAccessDecision, renderedMenuHrefs } from '../src/lib/roleMenus';
import { gateCrossRole } from '../src/proxy';

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';

describe('platform email account', () => {
  it('accepts only the exact SupAdm1006 login', () => {
    expect(isPlatformEmailAccount('SupAdm1006')).toBe(true);
    expect(isPlatformEmailAccount(' SupAdm1006 ')).toBe(true);
    expect(isPlatformEmailAccount('supadm1006')).toBe(false);
    expect(isPlatformEmailAccount('SUPADM1006')).toBe(false);
    expect(isPlatformEmailAccount('StaffUser')).toBe(false);
    expect(isPlatformEmailAccount(null)).toBe(false);
  });

  it('keeps Emails off the shared menus and on only that account', () => {
    expect(menuHrefs('superadmin')).not.toContain(PLATFORM_EMAIL_HREF);
    expect(allMobileNavHrefs(MOBILE_ROLE_NAVS.superadmin)).not.toContain(PLATFORM_EMAIL_HREF);
    expect(renderedMenuHrefs('admin', 'superadmin', true)).not.toContain(PLATFORM_EMAIL_HREF);
    expect(renderedMenuHrefs('admin', 'superadmin', true, 'supadm1006')).not.toContain(PLATFORM_EMAIL_HREF);
    expect(renderedMenuHrefs('shop', 'shop', false, 'SupAdm1006')).not.toContain(PLATFORM_EMAIL_HREF);
    expect(renderedMenuHrefs('admin', 'superadmin', true, 'SupAdm1006')).toContain(PLATFORM_EMAIL_HREF);

    const labels = (username?: string) => {
      const nav = mobileNavForActor('admin', { role: 'superadmin', isOwner: true, isSuperAdmin: true, username });
      return nav?.more.flatMap((group) => group.items.map((item) => item.label)) ?? [];
    };
    expect(labels()).not.toContain('Emails');
    expect(labels('supadm1006')).not.toContain('Emails');
    expect(labels('SupAdm1006')).toContain('Emails');
    expect(allMobileNavHrefs(mobileNavForActor('shop', { role: 'shop', username: 'SupAdm1006' })!)).not.toContain(PLATFORM_EMAIL_HREF);
    expect(allMobileNavHrefs(mobileNavForActor('manager', { role: 'manager', username: 'SupAdm1006' })!)).not.toContain(PLATFORM_EMAIL_HREF);
    expect(allMobileNavHrefs(mobileNavForActor('tech', { role: 'tech', username: 'SupAdm1006' })!)).not.toContain(PLATFORM_EMAIL_HREF);
    expect(allMobileNavHrefs(mobileNavForActor('customer', { role: 'customer', username: 'SupAdm1006' })!)).not.toContain(PLATFORM_EMAIL_HREF);
  });

  it('opens the page only for SupAdm1006', () => {
    expect(portalAccessDecision('/admin/emails', 'superadmin')).toBe('home');
    expect(portalAccessDecision('/admin/emails', { role: 'superadmin', username: 'supadm1006', isOwner: true })).toBe('home');
    expect(portalAccessDecision('/admin/emails', { role: 'admin', username: 'StaffUser', isSuperAdmin: true })).toBe('home');
    expect(portalAccessDecision('/admin/emails', { role: 'admin', username: 'SupAdm1006' })).toBe('allow');
    expect(portalAccessDecision('/admin/emails', { role: 'superadmin', username: 'SupAdm1006', isOwner: false })).toBe('allow');
    for (const role of ['shop', 'manager', 'tech', 'customer'] as const) {
      expect(portalAccessDecision('/admin/emails', role)).toBe('forbidden');
      expect(portalAccessDecision('/admin/emails', { role, username: 'SupAdm1006', isOwner: true })).toBe('forbidden');
    }
  });

  it('blocks the page at the edge for every other login', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'platform-email-test-secret';
    const exactAdmin = generateAccessToken({ id: '1', username: 'SupAdm1006', role: 'admin', isOwner: true });
    const exactSuper = generateAccessToken({ id: '2', username: 'SupAdm1006', role: 'superadmin', isSuperAdmin: true });
    const lower = generateAccessToken({ id: '3', username: 'supadm1006', role: 'admin', isOwner: true, isSuperAdmin: true });
    const staff = generateAccessToken({ id: '4', username: 'StaffUser', role: 'superadmin', isSuperAdmin: true });
    const shop = generateAccessToken({ id: '5', username: 'SupAdm1006', role: 'shop' });
    const manager = generateAccessToken({ id: '6', role: 'manager' });
    const tech = generateAccessToken({ id: '7', role: 'tech' });
    const customer = generateAccessToken({ id: '8', role: 'customer' });

    for (const token of [exactAdmin, exactSuper]) {
      const gate = await gateCrossRole(new NextRequest('http://localhost/admin/emails', {
        headers: { cookie: `sos_auth=${token}` },
      }));
      expect(gate).toBeNull();
    }

    for (const token of [lower, staff]) {
      const gate = await gateCrossRole(new NextRequest('http://localhost/admin/emails', {
        headers: { cookie: `sos_auth=${token}` },
      }));
      expect(gate?.status).toBe(307);
      expect(gate?.headers.get('location')).toBe('http://localhost/admin/home');
    }

    for (const token of [shop, manager, tech, customer]) {
      const gate = await gateCrossRole(new NextRequest('http://localhost/admin/emails', {
        headers: { cookie: `sos_auth=${token}` },
      }));
      expect(gate?.headers.get('x-middleware-rewrite') || '').toContain('/forbidden');
    }
  });
});

describe('platform mailbox', () => {
  const originalKey = process.env.RESEND_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalKey;
    jest.restoreAllMocks();
  });

  it('sends only from support@fixtray.app', () => {
    expect(platformFromHeader('support@fixtray.app')).toBe('FixTray Support <support@fixtray.app>');
    expect(platformFromHeader('FixTray Support <support@fixtray.app>')).toBe('FixTray Support <support@fixtray.app>');
    expect(platformFromHeader('noreply@fixtray.app')).toBeNull();
    expect(platformFromHeader('FixTray <noreply@fixtray.app>')).toBeNull();
    expect(platformFromHeader('onboarding@resend.dev')).toBeNull();
    const prepared = preparePlatformSend({
      from: 'noreply@fixtray.app',
      to: 'person@example.com',
      subject: 'Hello',
      text: 'Body',
      requestId: REQUEST_ID,
    });
    expect(prepared.ok).toBe(false);
    const page = fs.readFileSync('src/app/admin/emails/page.tsx', 'utf8');
    const access = fs.readFileSync('src/lib/platformEmailAccess.ts', 'utf8');
    expect(page).not.toContain('noreply@fixtray.app');
    expect(access).not.toContain('noreply@fixtray.app');
    expect(page).toContain('support@fixtray.app');
  });

  it('sends through the existing Resend endpoint and keeps the key out of the result', async () => {
    process.env.RESEND_API_KEY = 're_test_secret_value';
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'email_123' }),
    } as Response);
    const result = await sendPlatformMail({
      from: 'support@fixtray.app',
      to: 'person@example.com',
      subject: 'Hello',
      text: 'Body <script>',
      requestId: REQUEST_ID,
    });
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('https://api.resend.com/emails', expect.any(Object));
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer re_test_secret_value');
    expect(headers['Idempotency-Key']).toBe(`platform-mail/${REQUEST_ID}`);
    const body = JSON.parse(String(init.body));
    expect(body.from).toBe('FixTray Support <support@fixtray.app>');
    expect(body.to).toEqual(['person@example.com']);
    expect(body.html).not.toContain('<script>');
    expect(JSON.stringify(result)).not.toContain('re_test_secret_value');
  });

  it('lists and reads recent mail without returning the key or raw html', async () => {
    process.env.RESEND_API_KEY = 're_test_secret_value';
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{
            id: 'email_123',
            from: 'FixTray <noreply@fixtray.app>',
            to: ['person@example.com'],
            subject: 'Hi',
            created_at: '2026-01-01T00:00:00.000Z',
            last_event: 'delivered',
          }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'email_123',
          from: 'FixTray <noreply@fixtray.app>',
          to: ['person@example.com'],
          subject: 'Hi',
          created_at: '2026-01-01T00:00:00.000Z',
          last_event: 'delivered',
          html: '<p>Hello <b>there</b></p><script>secret</script>',
          text: '',
        }),
      } as Response);
    const listed = await listRecentPlatformMail();
    const read = await readPlatformMail('email_123');
    expect(listed.ok && listed.data[0].subject).toBe('Hi');
    expect(read.ok && read.data.text).toBe('Hello there');
    expect(JSON.stringify(read)).not.toContain('<script>');
    expect(JSON.stringify(read)).not.toContain('re_test_secret_value');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.resend.com/emails?limit=20');
  });

  it('stops when the server key is missing and never prints a provider key', async () => {
    delete process.env.RESEND_API_KEY;
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'bad key re_test_secret_value' }),
    } as Response);
    const missing = await listRecentPlatformMail();
    expect(missing).toEqual({ ok: false, status: 503, error: 'Email is not configured' });
    expect(fetchMock).not.toHaveBeenCalled();

    process.env.RESEND_API_KEY = 're_test_secret_value';
    const failed = await sendPlatformMail({
      from: 'support@fixtray.app',
      to: 'person@example.com',
      subject: 'Hello',
      text: 'Body',
      requestId: REQUEST_ID,
    });
    expect(failed.ok).toBe(false);
    expect(JSON.stringify(failed)).not.toContain('re_test_secret_value');
  });

  it('does not commit a key or a dollar amount', () => {
    const files = [
      'src/lib/platformEmailAccess.ts',
      'src/lib/platformMailbox.ts',
      'src/lib/useSessionUsername.ts',
      'src/app/api/admin/emails/route.ts',
      'src/app/api/admin/emails/[id]/route.ts',
      'src/app/admin/emails/page.tsx',
    ];
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      expect(src).not.toMatch(/re_[A-Za-z0-9]{8,}/);
      expect(src).not.toMatch(/RESEND_API_KEY\s*[:=]\s*['"]/);
      expect(src).not.toMatch(/\$\d/);
    }
  });
});
