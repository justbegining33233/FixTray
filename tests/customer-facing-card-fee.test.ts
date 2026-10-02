import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import { estimateBillForOrder, customerChargeDisplay } from '../src/lib/customerLedger';
import { memberAndCustomerFeeCopy } from '../src/lib/publicFeeCopy';
import { PUBLIC_SITE_DESCRIPTION } from '../src/lib/publicMetadata';
import { normalizePlatformServiceFeeCents } from '../src/lib/platformFee';
import {
  billWithServiceFee,
  customerFacingServiceFeeCents,
  stripeUsCardFeeCents,
  unpaidInvoiceDisplay,
} from '../src/lib/serviceFeeBill';
import { buildConnectDestinationSplit, destinationChargeParams } from '../src/lib/stripeConnectSplit';
import { invoiceTotal } from '../src/lib/workOrderCloseout';

/** Nearest-cent 2.9% of a charge, plus 30 cents. Independent of the fee helper. */
function cardProcessingCents(chargeCents: number): number {
  const percent = Math.floor((chargeCents * 29 * 2 + 1000) / 2000);
  return percent + 30;
}

describe('customer-facing FixTray fee', () => {
  it('locks the $1,000 shop bill and $10 saved fee', () => {
    const savedFeeCents = 1000;
    const shopBillCents = 100_000;
    const feeCents = customerFacingServiceFeeCents(shopBillCents, savedFeeCents);

    expect(feeCents).toBe(4047);
    expect(billWithServiceFee(1000, 10)).toEqual({
      subtotal: 1000,
      serviceFee: 40.47,
      total: 1040.47,
    });
    expect(invoiceTotal({ estimatedCost: 1000 }, 10)).toEqual({
      quoteAmount: 1000,
      serviceFee: 40.47,
      amount: 1040.47,
    });

    const split = buildConnectDestinationSplit({
      quoteUsd: 1000,
      serviceFeeUsd: 40.47,
      connectedAccountId: 'acct_shop_1000',
    });
    expect(split.ok).toBe(true);
    if (!split.ok) return;

    expect(split.shopPayoutCents).toBe(shopBillCents);
    expect(split.applicationFeeCents).toBe(4047);
    expect(split.chargeCents).toBe(104047);
    expect(split.shopPayoutCents + split.applicationFeeCents).toBe(split.chargeCents);
    expect(split.paymentIntentData).toEqual({
      application_fee_amount: 4047,
      transfer_data: { destination: 'acct_shop_1000' },
    });
    expect(split.paymentIntentData.transfer_data).not.toHaveProperty('amount');

    const params = destinationChargeParams(split, { workOrderId: 'wo_1000' });
    expect(params.amount).toBe(104047);
    expect(params.application_fee_amount).toBe(4047);
    expect(params.amount - params.application_fee_amount).toBe(100_000);

    const stripeCents = cardProcessingCents(split.chargeCents);
    expect(stripeCents).toBe(3047);
    expect(stripeUsCardFeeCents(split.chargeCents)).toBe(stripeCents);
    const platformNetCents = split.applicationFeeCents - stripeCents;
    expect(platformNetCents).toBe(savedFeeCents);
    expect(platformNetCents).toBeGreaterThanOrEqual(savedFeeCents);

    const oneCentLess = cardProcessingCents(shopBillCents + 4046);
    expect(4046 - oneCentLess).toBeLessThan(savedFeeCents);

    expect(normalizePlatformServiceFeeCents({ serviceFee: 1000 })).toBe(1000);
    expect(normalizePlatformServiceFeeCents({ serviceFee: 1000 })).not.toBe(4047);
  });

  it('keeps a recorded charge on the old flat fee and uses the new fee only when unpaid', () => {
    const paid = estimateBillForOrder({
      paymentStatus: 'paid',
      estimatedCost: 1000,
      amountPaid: 1010,
    }, 10);
    expect(paid).toEqual({ subtotal: 1000, serviceFee: 10, total: 1010 });
    expect(customerChargeDisplay({
      paymentStatus: 'paid',
      estimatedCost: 1000,
      amountPaid: 1010,
    }, 10).amount).toBe(1010);

    const open = estimateBillForOrder({
      paymentStatus: 'unpaid',
      estimatedCost: 1000,
      amountPaid: null,
    }, 10);
    expect(open).toEqual({ subtotal: 1000, serviceFee: 40.47, total: 1040.47 });
    expect(unpaidInvoiceDisplay(1010, 1000, 10)).toMatchObject({
      serviceCost: 1000,
      serviceFee: 40.47,
      amount: 1040.47,
    });
  });

  it('refuses the charge when the shop cannot receive it', () => {
    const refused = buildConnectDestinationSplit({
      quoteUsd: 1000,
      serviceFeeUsd: 40.47,
      connectedAccountId: null,
    });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.status).toBe(409);
    expect(refused).not.toHaveProperty('paymentIntentData');
    expect(refused).not.toHaveProperty('chargeCents');
  });

  it('does not print a dollar amount on public fee copy', () => {
    expect(memberAndCustomerFeeCopy()).not.toMatch(/\$\d/);
    expect(PUBLIC_SITE_DESCRIPTION).not.toMatch(/\$\d/);
    const root = path.join(__dirname, '..');
    const terms = fs.readFileSync(path.join(root, 'src/app/terms/page.tsx'), 'utf8');
    const privacy = fs.readFileSync(path.join(root, 'src/app/privacy/page.tsx'), 'utf8');
    expect(terms).not.toMatch(/\$\d/);
    expect(privacy).not.toMatch(/\$\d/);
    expect(terms).not.toContain('40.47');
    expect(privacy).not.toContain('40.47');
    expect(fs.existsSync(path.join(root, 'src/app/pricing/page.tsx'))).toBe(false);
  });
});
