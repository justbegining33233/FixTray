import { describe, it, expect, jest } from '@jest/globals';
import { billWithServiceFee, customerPaymentBill, paymentLinkFeeBreakdown } from '../src/lib/serviceFeeBill';

jest.mock('../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    platformConfig: {
      findUnique: jest.fn(),
    },
  },
}));

import prisma from '../src/lib/prisma';
import { getPlatformServiceFeeUsd } from '../src/lib/platformFee';

describe('getPlatformServiceFeeUsd', () => {
  it('reads PlatformConfig.serviceFee (cents) set by superadmin', async () => {
    (prisma.platformConfig.findUnique as jest.Mock).mockResolvedValue({ serviceFee: 750 });
    await expect(getPlatformServiceFeeUsd()).resolves.toBe(7.5);
  });

  it('falls back to the default $5 when config is missing', async () => {
    (prisma.platformConfig.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(getPlatformServiceFeeUsd()).resolves.toBe(5);
  });
});

describe('billWithServiceFee', () => {
  it('adds the live platform fee to a quote and to a paid bill', () => {
    expect(billWithServiceFee(1.08, 10)).toEqual({
      subtotal: 1.08,
      serviceFee: 10,
      total: 11.08,
    });
    expect(customerPaymentBill({
      estimatedCost: 1.08,
      amountPaid: 1.08,
      serviceFeeUsd: 10,
    })).toEqual({
      subtotal: 1.08,
      serviceFee: 10,
      total: 11.08,
    });
  });

  it('omits the fee when the quote or the configured fee is zero', () => {
    expect(billWithServiceFee(0, 10).serviceFee).toBe(0);
    expect(billWithServiceFee(40, 0)).toEqual({ subtotal: 40, serviceFee: 0, total: 40 });
  });

  it('keeps a fee already baked into a payment link and adds the live fee when the link stored only the quote', () => {
    expect(paymentLinkFeeBreakdown(11.08, 1.08, 10)).toMatchObject({
      serviceCost: 1.08,
      serviceFee: 10,
      amount: 11.08,
    });
    expect(paymentLinkFeeBreakdown(1.08, 1.08, 10)).toMatchObject({
      serviceCost: 1.08,
      serviceFee: 10,
      amount: 11.08,
    });
    expect(paymentLinkFeeBreakdown(50, 0, 10)).toMatchObject({
      serviceCost: 40,
      serviceFee: 10,
      amount: 50,
    });
  });
});
