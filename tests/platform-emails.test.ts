import fs from 'fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextRequest } from 'next/server';
import { SupportInboxList } from '../src/app/admin/emails/SupportInboxList';
import { generateAccessToken } from '../src/lib/auth';
import { allMobileNavHrefs, MOBILE_ROLE_NAVS, mobileNavForActor } from '../src/lib/mobileRoleNav';
import {
  isPlatformEmailAccount,
  platformFromHeader,
  PLATFORM_EMAIL_HREF,
} from '../src/lib/platformEmailAccess';
import {
  listReceivedSupportMail,
  mergeSupportInbox,
  preparePlatformSend,
  readReceivedSupportMail,
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

  it('lists and reads the support inbox and skips other recipients', async () => {
    process.env.RESEND_API_KEY = 're_test_secret_value';
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'email_123',
              from: 'Customer <person@example.com>',
              to: ['FixTray Support <support@fixtray.app>'],
              subject: 'Hi',
              created_at: '2026-01-02T00:00:00.000Z',
            },
            {
              id: 'email_other',
              from: 'Customer <person@example.com>',
              to: ['noreply@fixtray.app'],
              subject: 'Skip me',
              created_at: '2026-01-03T00:00:00.000Z',
            },
          ],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'email_123',
          from: 'Customer <person@example.com>',
          to: ['support@fixtray.app'],
          subject: 'Hi',
          created_at: '2026-01-02T00:00:00.000Z',
          html: '<p>Hello <b>there</b></p><script>secret</script>',
          text: '',
        }),
      } as Response);
    const listed = await listReceivedSupportMail();
    const read = await readReceivedSupportMail('email_123');
    expect(listed.ok && listed.data.map((item) => item.subject)).toEqual(['Hi']);
    expect(read.ok && read.data.text).toBe('Hello there');
    expect(JSON.stringify(read)).not.toContain('<script>');
    expect(JSON.stringify(read)).not.toContain('re_test_secret_value');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.resend.com/emails/receiving?limit=20');
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.resend.com/emails/receiving/email_123');
    const merged = mergeSupportInbox(
      [{ id: 'email_saved', from: 'a@b.com', to: ['support@fixtray.app'], subject: 'Saved', createdAt: '2026-01-01T00:00:00.000Z', lastEvent: 'received' }],
      listed.ok ? listed.data : [],
    );
    expect(merged.map((item) => item.id)).toEqual(['email_123', 'email_saved']);
  });

  it('shows support mail Resend already received, including mail past the first page', async () => {
    process.env.RESEND_API_KEY = 're_test_secret_value';
    const robinId = 'a39999a6-88e3-48b1-888b-beaabcde1b33';
    const gomezId = 'b39999a6-88e3-48b1-888b-beaabcde1b44';
    const otherId = 'c39999a6-88e3-48b1-888b-beaabcde1b55';
    const robinSubject = 'Re: Action Transmission Specialists, want a free way to run your shop?';
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'list',
          has_more: true,
          data: [{
            id: otherId,
            from: 'Spam <junk@example.com>',
            to: ['other@fixtray.app'],
            subject: 'Not support',
            created_at: '2026-10-03T19:00:00.000Z',
          }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'list',
          has_more: false,
          data: [
            {
              id: robinId,
              from: 'Robin Sidbury <sales@transmission-repair-jacksonville.com>',
              to: ['support@fixtray.app'],
              cc: [],
              subject: robinSubject,
              created_at: '2026-10-03T18:05:00.000Z',
              message_id: '<robin@mail.example>',
            },
            {
              id: gomezId,
              from: 'Gomez Repairs <202andrescelle@gmail.com>',
              to: ['support@fixtray.app'],
              subject: 'Gomez Repairs',
              created_at: '2026-10-03T02:00:00.000Z',
              message_id: '<gomez@mail.example>',
            },
          ],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'email',
          id: robinId,
          from: 'Robin Sidbury <sales@transmission-repair-jacksonville.com>',
          to: ['support@fixtray.app'],
          subject: robinSubject,
          created_at: '2026-10-03T18:05:00.000Z',
          text: 'Unsubscribe',
          html: null,
        }),
      } as Response);

    const listed = await listReceivedSupportMail();
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.data.map((item) => item.id)).toEqual([robinId, gomezId]);
    expect(listed.data[0].subject).toBe(robinSubject);
    expect(listed.data[0].from).toBe('Robin Sidbury <sales@transmission-repair-jacksonville.com>');
    expect(listed.data[1].from).toBe('Gomez Repairs <202andrescelle@gmail.com>');
    expect(listed.data.every((item) => item.to.some((address) => address.includes('support@fixtray.app')))).toBe(true);

    const opened = await readReceivedSupportMail(robinId);
    expect(opened.ok && opened.data.text).toBe('Unsubscribe');
    expect(opened.ok && opened.data.subject).toBe(robinSubject);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.resend.com/emails/receiving?limit=20');
    expect(fetchMock.mock.calls[1][0]).toBe(`https://api.resend.com/emails/receiving?limit=20&after=${otherId}`);
    expect(fetchMock.mock.calls[2][0]).toBe(`https://api.resend.com/emails/receiving/${robinId}`);
    expect(JSON.stringify({ listed, opened })).not.toContain('re_test_secret_value');
  });

  it('shows the newest receiving page in the inbox and keeps an empty or failed load obvious', async () => {
    process.env.RESEND_API_KEY = 're_test_secret_value';
    const fixture = JSON.parse(fs.readFileSync('tests/fixtures/receiving-list-newest-page.json', 'utf8'));
    const robinSubject = 'Re: Action Transmission Specialists, want a free way to run your shop?';
    const gomezSubject = 'Re: Gomez Repairs, want a free way to run your shop?';
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('after=')) {
        return { ok: true, json: async () => ({ object: 'list', has_more: false, data: [] }) } as Response;
      }
      return { ok: true, json: async () => fixture } as Response;
    });

    const listed = await listReceivedSupportMail(100);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.data.map((item) => item.subject)).toEqual(expect.arrayContaining([robinSubject, gomezSubject]));
    expect(listed.data[0].subject).toBe(robinSubject);
    expect(listed.data[0].from).toBe('sales@transmission-repair-jacksonville.com');
    expect(listed.data.find((item) => item.subject === gomezSubject)?.from).toBe('202andrescelle@gmail.com');
    expect(listed.data.every((item) => item.to.some((address) => address.toLowerCase() === 'support@fixtray.app'))).toBe(true);
    const subjects = listed.data.map((item) => item.subject);
    expect(subjects).not.toContain('Launch your checkout experience');
    expect(subjects).not.toContain('Continue setting up your Stripe account');
    expect(subjects).not.toContain('Join the "FixTray" account on Stripe');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.resend.com/emails/receiving?limit=100');
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('after=');

    const html = renderToStaticMarkup(createElement(SupportInboxList, {
      emails: listed.data,
      loaded: true,
      error: '',
      selectedId: null,
      onOpen: () => {},
    }));
    expect(html).toContain(robinSubject);
    expect(html).toContain(gomezSubject);
    expect(html).toContain('sales@transmission-repair-jacksonville.com');
    expect(html).toContain('202andrescelle@gmail.com');
    expect(html).not.toContain('Launch your checkout experience');
    expect(html).not.toContain('Continue setting up your Stripe account');
    expect(html).not.toContain('No mail in the support@fixtray.app inbox.');

    const loading = renderToStaticMarkup(createElement(SupportInboxList, {
      emails: [],
      loaded: false,
      error: '',
      selectedId: null,
      onOpen: () => {},
    }));
    expect(loading).toContain('Loading mail...');
    expect(loading).not.toContain('No mail in the support@fixtray.app inbox.');

    const failed = renderToStaticMarkup(createElement(SupportInboxList, {
      emails: [],
      loaded: false,
      error: 'The support inbox could not be loaded.',
      selectedId: null,
      onOpen: () => {},
    }));
    expect(failed).toContain('The support inbox could not be loaded.');
    expect(failed).not.toContain('No mail in the support@fixtray.app inbox.');

    const empty = renderToStaticMarkup(createElement(SupportInboxList, {
      emails: [],
      loaded: true,
      error: '',
      selectedId: null,
      onOpen: () => {},
    }));
    expect(empty).toContain('No mail in the support@fixtray.app inbox.');

    const page = fs.readFileSync('src/app/admin/emails/page.tsx', 'utf8');
    expect(page).toContain('cache: \'no-store\'');
    expect(page).toMatch(/const \[listLoaded, setListLoaded\] = useState\(false\)/);
  });

  it('keeps a clear message when the inbox is empty or cannot be loaded', async () => {
    process.env.RESEND_API_KEY = 're_test_secret_value';
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'not allowed' }),
    } as Response);
    const failed = await listReceivedSupportMail();
    expect(failed).toEqual({ ok: false, status: 502, error: 'The support inbox could not be loaded.' });

    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ object: 'list', has_more: false, data: [] }),
    } as Response);
    const empty = await listReceivedSupportMail();
    expect(empty).toEqual({ ok: true, data: [] });
  });

  it('stops when the server key is missing and never prints a provider key', async () => {
    delete process.env.RESEND_API_KEY;
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'bad key re_test_secret_value' }),
    } as Response);
    const missing = await listReceivedSupportMail();
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
      'src/lib/resendWebhook.ts',
      'src/app/api/resend/webhook/route.ts',
      'src/lib/supportInboxStore.ts',
    ];
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      expect(src).not.toMatch(/re_[A-Za-z0-9]{8,}/);
      expect(src).not.toMatch(/RESEND_API_KEY\s*[:=]\s*['"]/);
      expect(src).not.toMatch(/RESEND_WEBHOOK_SECRET\s*[:=]\s*['"]/);
      expect(src).not.toMatch(/whsec_/);
      expect(src).not.toMatch(/\$\d/);
    }
  });
});
