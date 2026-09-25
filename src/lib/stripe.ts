import Stripe from 'stripe';
import {
  shopCanReceiveConnectTransfer,
  type ConnectDestinationSplit,
  destinationChargeParams,
} from '@/lib/stripeConnectSplit';

// Only instantiate Stripe when the secret key is provided. During build-time
// (or in environments where Stripe isn't configured) constructing the Stripe
// client with an empty key throws â€” that causes build failures when Next.js
// collects page data. Export a safe proxy instead so imports don't throw.
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-01-28.clover' })
  : new Proxy({}, {
      get() {
        return () => {
          throw new Error('STRIPE_SECRET_KEY is not configured. Stripe methods are unavailable in this environment.');
        };
      },
    }) as unknown as Stripe;

export default stripe;

/**
 * Destination charge for a work order.
 * The platform keeps only the live service fee (application_fee_amount).
 * The rest transfers to the connected shop. Callers must pass a split that
 * already has a connected account — this does not create a platform-only charge.
 */
export async function createPaymentIntent(
  split: ConnectDestinationSplit,
  metadata: Record<string, string>,
) {
  const params: Stripe.PaymentIntentCreateParams = {
    ...destinationChargeParams(split, metadata),
    automatic_payment_methods: {
      enabled: true,
    },
  };

  return stripe.paymentIntents.create(params);
}

/** True when the connected account can receive the shop's transfer. */
export async function shopConnectPayoutReady(connectedAccountId: string): Promise<boolean> {
  const account = await stripe.accounts.retrieve(connectedAccountId);
  return shopCanReceiveConnectTransfer(account);
}

export async function createCustomer(email: string, name: string) {
  return stripe.customers.create({
    email,
    name,
  });
}

export async function attachPaymentMethod(paymentMethodId: string, customerId: string) {
  return stripe.paymentMethods.attach(paymentMethodId, {
    customer: customerId,
  });
}

export async function detachPaymentMethod(paymentMethodId: string) {
  return stripe.paymentMethods.detach(paymentMethodId);
}

export async function listPaymentMethods(customerId: string) {
  return stripe.paymentMethods.list({
    customer: customerId,
    type: 'card',
  });
}

export async function setDefaultPaymentMethod(customerId: string, paymentMethodId: string) {
  return stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });
}

export async function refundPayment(paymentIntentId: string, amount?: number) {
  const refundData: any = { payment_intent: paymentIntentId };
  if (amount) refundData.amount = Math.round(amount * 100);
  return stripe.refunds.create(refundData);
}

/**
 * Create or retrieve a Stripe customer
 */
export async function createOrRetrieveCustomer(email: string, name?: string) {
  try {
    // Try to find existing customer
    const existingCustomers = await stripe.customers.list({
      email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      return existingCustomers.data[0];
    }

    // Create new customer
    const customer = await stripe.customers.create({
      email,
      name,
    });

    return customer;
  } catch (error) {
    console.error('Error creating/retrieving Stripe customer', error, { email });
    throw error;
  }
}

// NOTE: Webhook handling lives in src/app/api/stripe/webhook/route.ts.
// Do NOT add duplicate webhook logic here.

