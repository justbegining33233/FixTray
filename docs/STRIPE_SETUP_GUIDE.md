# Stripe for FixTray

Shop subscription plans are discontinued. Do not create Stripe products, prices, or billing portal configuration for shop plans.

FixTray charges shops through Stripe Connect:

- Each shop connects its own Stripe account.
- Work-order payments are destination charges. The shop receives the quote. FixTray keeps only the per-work-order service fee (`application_fee_amount`).
- Customer payment links and invoice checkout stay on `/api/payment/checkout` and `/api/payment-links`.

## Environment variables still used

- `STRIPE_SECRET_KEY` — platform secret key for Connect and payment intents
- `STRIPE_WEBHOOK_SECRET` — verifies `/api/stripe/webhook` and `/api/payment/webhook`
- `NEXT_PUBLIC_APP_URL` — Connect return URLs and payment redirects

## Environment variables to delete

These were only for shop subscription products and prices:

- `STRIPE_STARTER_PRODUCT_ID`
- `STRIPE_STARTER_PRICE_ID`
- `STRIPE_GROWTH_PRODUCT_ID`
- `STRIPE_GROWTH_PRICE_ID`
- `STRIPE_PROFESSIONAL_PRODUCT_ID`
- `STRIPE_PROFESSIONAL_PRICE_ID`
- `STRIPE_BUSINESS_PRODUCT_ID`
- `STRIPE_BUSINESS_PRICE_ID`
- `STRIPE_ENTERPRISE_PRODUCT_ID`
- `STRIPE_ENTERPRISE_PRICE_ID`

`STRIPE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` are not read by the app. Delete them if they were only added for subscription Checkout.
