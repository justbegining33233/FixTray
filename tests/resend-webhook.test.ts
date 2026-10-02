import { Webhook } from 'svix';
import { handleResendWebhook } from '../src/lib/resendWebhook';

jest.mock('@/lib/supportInboxStore', () => ({
  rememberSupportInboxMessage: jest.fn().mockResolvedValue(undefined),
}));

const SECRET = `whsec_${Buffer.from('inbound-support-webhook-test').toString('base64')}`;

function signed(payload: string) {
  const id = 'msg_test_1';
  const timestamp = new Date();
  const signature = new Webhook(SECRET).sign(id, timestamp, payload);
  return {
    id,
    timestamp: String(Math.floor(timestamp.getTime() / 1000)),
    signature,
  };
}

describe('resend inbound webhook', () => {
  const originalKey = process.env.RESEND_API_KEY;
  const originalSecret = process.env.RESEND_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_secret_value';
    process.env.RESEND_WEBHOOK_SECRET = SECRET;
    jest.spyOn(global, 'fetch').mockReset();
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalKey;
    if (originalSecret === undefined) delete process.env.RESEND_WEBHOOK_SECRET;
    else process.env.RESEND_WEBHOOK_SECRET = originalSecret;
    jest.restoreAllMocks();
  });

  it('rejects a missing or bad signature and does not call Resend', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const missing = await handleResendWebhook('{}', { id: null, timestamp: null, signature: null });
    expect(missing.status).toBe(400);
    const bad = await handleResendWebhook('{"type":"email.received"}', {
      id: 'msg_test_1',
      timestamp: String(Math.floor(Date.now() / 1000)),
      signature: 'v1,not-a-real-signature',
    });
    expect(bad.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.stringify(missing)).not.toContain(SECRET);
    expect(JSON.stringify(bad)).not.toContain('re_test_secret_value');
  });

  it('rejects the call when the signing secret is not configured', async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    const payload = JSON.stringify({ type: 'email.received', data: { email_id: 'email_123', to: ['support@fixtray.app'] } });
    const result = await handleResendWebhook(payload, signed(payload));
    expect(result.status).toBe(500);
    expect(result.body.error).toBe('Webhook secret not configured');
  });

  it('loads a support inbox message after email.received and ignores other events', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'email_123',
        from: 'Customer <person@example.com>',
        to: ['support@fixtray.app'],
        subject: 'Help',
        created_at: '2026-10-02T00:00:00.000Z',
        text: 'The car is ready',
      }),
    } as Response);

    const received = JSON.stringify({
      type: 'email.received',
      data: { email_id: 'email_123', to: ['FixTray Support <support@fixtray.app>'], subject: 'Help' },
    });
    const saved = await handleResendWebhook(received, signed(received));
    expect(saved.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith('https://api.resend.com/emails/receiving/email_123', expect.any(Object));

    fetchMock.mockClear();
    const other = JSON.stringify({
      type: 'email.received',
      data: { email_id: 'email_999', to: ['noreply@fixtray.app'] },
    });
    const ignored = await handleResendWebhook(other, signed(other));
    expect(ignored.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();

    const sent = JSON.stringify({ type: 'email.sent', data: { email_id: 'email_123' } });
    const skipped = await handleResendWebhook(sent, signed(sent));
    expect(skipped.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
