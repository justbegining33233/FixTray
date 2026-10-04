import { NextRequest, NextResponse } from 'next/server';

jest.mock('@/lib/rateLimit', () => ({
  rateLimit: () => async () => null,
  rateLimitConfigs: { strict: { windowMs: 1000, maxRequests: 10 } },
}));

jest.mock('@/lib/auth', () => ({
  requireRole: jest.fn(),
}));

jest.mock('@/lib/supportInboxStore', () => ({
  listRememberedSupportInbox: jest.fn().mockResolvedValue([]),
  readRememberedSupportMail: jest.fn().mockResolvedValue(null),
  rememberSupportInboxMessage: jest.fn(),
  rememberSupportInboxSummary: jest.fn(),
}));

jest.mock('@/lib/platformMailbox', () => {
    const actual = jest.requireActual('@/lib/platformMailbox');
  return {
    ...actual,
    listReceivedSupportMail: jest.fn(),
    sendPlatformMail: jest.fn(),
    readReceivedSupportMail: jest.fn(),
  };
});

import { requireRole } from '../src/lib/auth';
import { listReceivedSupportMail, readReceivedSupportMail, sendPlatformMail } from '../src/lib/platformMailbox';
import { listRememberedSupportInbox } from '../src/lib/supportInboxStore';
import { GET, POST } from '../src/app/api/admin/emails/route';
import { GET as GET_ONE } from '../src/app/api/admin/emails/[id]/route';

const requireRoleMock = requireRole as jest.Mock;
const listMock = listReceivedSupportMail as jest.Mock;
const sendMock = sendPlatformMail as jest.Mock;
const readMock = readReceivedSupportMail as jest.Mock;
const rememberedMock = listRememberedSupportInbox as jest.Mock;

describe('platform email routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rememberedMock.mockResolvedValue([]);
  });

  it('refuses every login except SupAdm1006', async () => {
    requireRoleMock.mockReturnValue({ id: '2', role: 'superadmin', username: 'supadm1006', isOwner: true });
    const listed = await GET(new NextRequest('http://localhost/api/admin/emails'));
    const sent = await POST(new NextRequest('http://localhost/api/admin/emails', { method: 'POST', body: '{}' }));
    const one = await GET_ONE(new NextRequest('http://localhost/api/admin/emails/email_1'), { params: Promise.resolve({ id: 'email_1' }) });
    expect(listed.status).toBe(403);
    expect(sent.status).toBe(403);
    expect(one.status).toBe(403);
    expect(listMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
    expect(readMock).not.toHaveBeenCalled();
  });

  it('lists and sends for SupAdm1006 without echoing a key', async () => {
    requireRoleMock.mockReturnValue({ id: '1', role: 'superadmin', username: 'SupAdm1006' });
    listMock.mockResolvedValue({ ok: true, data: [{ id: 'email_1', subject: 'Hi' }] });
    sendMock.mockResolvedValue({ ok: true, data: { id: 'email_2' } });
    readMock.mockResolvedValue({ ok: true, data: { id: 'email_1', text: 'Hello' } });

    const listed = await GET(new NextRequest('http://localhost/api/admin/emails'));
    const sent = await POST(new NextRequest('http://localhost/api/admin/emails', {
      method: 'POST',
      body: JSON.stringify({ from: 'support@fixtray.app', to: 'a@b.com', subject: 'Hi', text: 'Hello', requestId: '11111111-1111-4111-8111-111111111111' }),
    }));
    const one = await GET_ONE(new NextRequest('http://localhost/api/admin/emails/email_1'), { params: Promise.resolve({ id: 'email_1' }) });
    expect(listMock).toHaveBeenCalledWith(100);
    expect(listed.status).toBe(200);
    expect(sent.status).toBe(200);
    expect(one.status).toBe(200);
    expect(JSON.stringify(await listed.json())).not.toMatch(/re_[A-Za-z0-9]{8,}/);
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ from: 'support@fixtray.app', to: 'a@b.com' }));
  });

  it('does not report an empty inbox when the receiving list failed', async () => {
    requireRoleMock.mockReturnValue({ id: '1', role: 'superadmin', username: 'SupAdm1006' });
    listMock.mockResolvedValue({ ok: false, status: 503, error: 'Email is not configured' });
    rememberedMock.mockResolvedValue([
      {
        id: '4662afdc-db61-45d2-b730-07146b7410a6',
        from: 'notifications@stripe.com',
        to: ['important@fixtray.app'],
        subject: 'Continue setting up your Stripe account',
        createdAt: '2026-10-03T14:17:57.597Z',
        lastEvent: 'received',
      },
    ]);
    const listed = await GET(new NextRequest('http://localhost/api/admin/emails'));
    expect(listed.status).toBe(503);
    expect(await listed.json()).toEqual({ error: 'Email is not configured' });
  });

  it('passes through an unsigned request', async () => {
    requireRoleMock.mockReturnValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    const listed = await GET(new NextRequest('http://localhost/api/admin/emails'));
    expect(listed.status).toBe(401);
    expect(listMock).not.toHaveBeenCalled();
  });
});
