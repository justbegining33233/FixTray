/**
 * Unit tests for POST /api/payment/webhook
 *
 * Stripe webhook handler: verifies signature, processes payment_intent.succeeded,
 * updates work order, sends email, creates notification.
 */

import { NextRequest } from 'next/server';
import Stripe from 'stripe';

// ── mocks ────────────────────────────────────────────────────────────────────

const mockConstructEvent = jest.fn();

jest.mock('@/lib/stripe', () => ({
  __esModule: true,
  default: {
    webhooks: {
      constructEvent: mockConstructEvent,
    },
  },
}));

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    workOrder: {
      update: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
  },
}));

jest.mock('@/lib/emailService', () => ({
  sendPaymentConfirmationEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/webhookService', () => ({
  dispatchWebhook: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/loyaltyService', () => ({
  awardLoyaltyPoints: jest.fn().mockResolvedValue(undefined),
}));

import prisma from '@/lib/prisma';
import { sendPaymentConfirmationEmail } from '@/lib/emailService';
import { POST } from '../webhook/route';

// ── helpers ──────────────────────────────────────────────────────────────────

const WEBHOOK_SECRET = 'whsec_test_secret';

function makeWebhookRequest(body: string, sig = 'valid-sig', extraHeaders: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/payment/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': sig,
      ...extraHeaders,
    },
    body,
  });
}

function buildPaymentSucceededEvent(workOrderId: string, amount: number): Stripe.Event {
  return {
    id: 'evt_test_001',
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: 'pi_test_001',
        amount,
        metadata: { workOrderId },
      } as unknown as Stripe.PaymentIntent,
    },
  } as unknown as Stripe.Event;
}

const mockWorkOrder = {
  id: 'wo-001',
  customerId: 'cust-001',
  shopId: 'shop-001',
  amountPaid: 125.0,
  customer: { email: 'bob@test.com' },
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  // default: notification.create resolves successfully
  (prisma.notification.create as jest.Mock).mockResolvedValue({});
});

afterEach(() => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.CUSTOM_WEBHOOK_SECRET;
});

// ── tests ────────────────────────────────────────────────────────────────────

describe('POST /api/payment/webhook', () => {
  it('returns 400 when stripe-signature header is missing', async () => {
    const req = new NextRequest('http://localhost/api/payment/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/no signature/i);
  });

  it('returns 500 when STRIPE_WEBHOOK_SECRET is not configured', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/not configured/i);
  });

  it('returns 500 when Stripe signature verification fails', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Webhook signature verification failed');
    });
    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(500);
  });

  it('returns 401 when custom webhook secret header is wrong', async () => {
    process.env.CUSTOM_WEBHOOK_SECRET = 'super-secret';
    const res = await POST(makeWebhookRequest('{}', 'valid-sig', { 'x-webhook-secret': 'wrong-secret' }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/invalid webhook secret/i);
  });

  it('returns 200 { received: true } for unhandled event types', async () => {
    mockConstructEvent.mockReturnValue({ type: 'customer.created', data: { object: {} } } as Stripe.Event);
    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);
    // workOrder.update should NOT be called
    expect(prisma.workOrder.update).not.toHaveBeenCalled();
  });

  it('updates work order to closed/paid on payment_intent.succeeded', async () => {
    const event = buildPaymentSucceededEvent('wo-001', 12500); // $125.00
    mockConstructEvent.mockReturnValue(event);
    (prisma.workOrder.update as jest.Mock).mockResolvedValue(mockWorkOrder);

    const res = await POST(makeWebhookRequest(JSON.stringify(event)));
    expect(res.status).toBe(200);

    expect(prisma.workOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'wo-001' },
        data: expect.objectContaining({
          status: 'closed',
          paymentStatus: 'paid',
          amountPaid: 125, // amount / 100
        }),
      })
    );
  });

  it('sends a payment confirmation email after successful payment', async () => {
    const event = buildPaymentSucceededEvent('wo-001', 5000);
    mockConstructEvent.mockReturnValue(event);
    (prisma.workOrder.update as jest.Mock).mockResolvedValue({ ...mockWorkOrder, amountPaid: 50 });

    await POST(makeWebhookRequest(JSON.stringify(event)));

    // Email is fire-and-forget; give it a tick to resolve
    await Promise.resolve();
    expect(sendPaymentConfirmationEmail).toHaveBeenCalledWith(
      'bob@test.com',
      mockWorkOrder.id,
      50
    );
  });

  it('creates an in-app notification after successful payment', async () => {
    const event = buildPaymentSucceededEvent('wo-001', 9900);
    mockConstructEvent.mockReturnValue(event);
    (prisma.workOrder.update as jest.Mock).mockResolvedValue({ ...mockWorkOrder, amountPaid: 99 });

    await POST(makeWebhookRequest(JSON.stringify(event)));

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerId: 'cust-001',
          type: 'payment',
          workOrderId: 'wo-001',
        }),
      })
    );
  });
});
