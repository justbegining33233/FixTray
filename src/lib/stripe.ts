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

// Stripe Product and Price IDs for each plan.
// Set these in your environment — see docs/STRIPE_SETUP_GUIDE.md.
// If an env var is missing the value will be undefined, and the
// `requireStripeId()` guard below will throw a clear error at
// runtime so you know exactly which env var to set.

function requireStripeId(envVar: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing Stripe env var: ${envVar}. ` +
      `Run \`node scripts/setup-stripe.js\` or add it to your .env file. ` +
      `See docs/STRIPE_SETUP_GUIDE.md for details.`
    );
  }
  return value;
}

export const STRIPE_PRODUCTS = {
  starter: {
    get productId() { return requireStripeId('STRIPE_STARTER_PRODUCT_ID', process.env.STRIPE_STARTER_PRODUCT_ID); },
    get priceId()   { return requireStripeId('STRIPE_STARTER_PRICE_ID',   process.env.STRIPE_STARTER_PRICE_ID); },
    name: 'Starter',
    price: 99.88,
    interval: 'month' as const,
    maxUsers: 1,
    maxShops: 1,
  },
  growth: {
    get productId() { return requireStripeId('STRIPE_GROWTH_PRODUCT_ID', process.env.STRIPE_GROWTH_PRODUCT_ID); },
    get priceId()   { return requireStripeId('STRIPE_GROWTH_PRICE_ID',   process.env.STRIPE_GROWTH_PRICE_ID); },
    name: 'Growth',
    price: 249.88,
    interval: 'month' as const,
    maxUsers: 5,
    maxShops: 1,
  },
  professional: {
    get productId() { return requireStripeId('STRIPE_PROFESSIONAL_PRODUCT_ID', process.env.STRIPE_PROFESSIONAL_PRODUCT_ID); },
    get priceId()   { return requireStripeId('STRIPE_PROFESSIONAL_PRICE_ID',   process.env.STRIPE_PROFESSIONAL_PRICE_ID); },
    name: 'Professional',
    price: 499.88,
    interval: 'month' as const,
    maxUsers: 15,
    maxShops: 3,
  },
  business: {
    get productId() { return requireStripeId('STRIPE_BUSINESS_PRODUCT_ID', process.env.STRIPE_BUSINESS_PRODUCT_ID); },
    get priceId()   { return requireStripeId('STRIPE_BUSINESS_PRICE_ID',   process.env.STRIPE_BUSINESS_PRICE_ID); },
    name: 'Business',
    price: 749.88,
    interval: 'month' as const,
    maxUsers: 40,
    maxShops: 5,
  },
  enterprise: {
    get productId() { return requireStripeId('STRIPE_ENTERPRISE_PRODUCT_ID', process.env.STRIPE_ENTERPRISE_PRODUCT_ID); },
    get priceId()   { return requireStripeId('STRIPE_ENTERPRISE_PRICE_ID',   process.env.STRIPE_ENTERPRISE_PRICE_ID); },
    name: 'Enterprise',
    price: 999.88,
    interval: 'month' as const,
    maxUsers: -1, // unlimited
    maxShops: -1, // unlimited
  },
};

export type StripePlan = keyof typeof STRIPE_PRODUCTS;

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

