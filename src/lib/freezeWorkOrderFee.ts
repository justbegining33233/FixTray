/**
 * Persist the checkout fee snapshot and return the bill checkout should charge.
 * Reads PlatformConfig only when no snapshot and no invoiced fee exist yet.
 */

import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  billFromFrozenFee,
  embeddedFeeCents,
  freezeFeeSnapshot,
  readFeeSnapshot,
  type FixtrayFeeSnapshot,
} from '@/lib/feeSnapshot';
import { getConfiguredPlatformServiceFeeUsd } from '@/lib/platformFee';
import { usdToCents } from '@/lib/serviceFeeBill';
import { quoteAmount } from '@/lib/workOrderCloseout';
import { freezeSalesTaxSnapshot, taxSettingsFromShop } from '@/lib/books/shopTax';

export type FrozenCheckoutBill =
  | {
      ok: true;
      reused: boolean;
      snapshot: FixtrayFeeSnapshot;
      quoteCents: number;
      taxCents: number;
      subtotal: number;
      serviceFee: number;
      total: number;
    }
  | { ok: false; status: number; error: string };

export async function freezeWorkOrderCheckoutFee(workOrder: {
  id: string;
  shopId?: string;
  completion: unknown;
  estimatedCost?: number | null;
  estimate?: unknown;
  partsUsed?: unknown;
}): Promise<FrozenCheckoutBill> {
  const quoteCents = usdToCents(quoteAmount(workOrder));
  const link = await prisma.paymentLink.findFirst({
    where: {
      workOrderId: workOrder.id,
      description: { startsWith: 'Invoice for work order' },
    },
    orderBy: { createdAt: 'desc' },
    select: { amount: true },
  });
  const configured = await getConfiguredPlatformServiceFeeUsd();
  const frozen = freezeFeeSnapshot({
    completion: workOrder.completion,
    quoteCents,
    livePlatformFeeCents: configured == null ? null : Math.round(configured * 100),
    embeddedFeeCents: embeddedFeeCents(link?.amount, quoteCents),
    now: new Date().toISOString(),
  });
  if (!frozen.ok) {
    const status = frozen.error.includes('not configured') ? 503 : 400;
    return { ok: false, status, error: frozen.error };
  }

  let completion = frozen.completion;
  let taxCents = 0;
  if (workOrder.shopId) {
    const settings = await prisma.shopSettings.findUnique({
      where: { shopId: workOrder.shopId },
      select: { taxRate: true, laborTaxable: true, partsTaxable: true },
    }).catch(() => null);
    const taxed = freezeSalesTaxSnapshot({
      completion,
      quoteCents,
      partsUsed: workOrder.partsUsed,
      settings: taxSettingsFromShop(settings),
      now: new Date().toISOString(),
    });
    completion = taxed.completion;
    taxCents = taxed.snapshot.taxCents;
  }

  const previous = readFeeSnapshot(workOrder.completion);
  const changed = !previous
    || previous.customerFacingFeeCents !== frozen.snapshot.customerFacingFeeCents
    || previous.quoteCents !== frozen.snapshot.quoteCents
    || previous.frozenAt !== frozen.snapshot.frozenAt
    || previous.platformFeeCents !== frozen.snapshot.platformFeeCents
    || taxCents > 0;
  if (changed) {
    await prisma.workOrder.update({
      where: { id: workOrder.id },
      data: { completion: completion as Prisma.InputJsonValue },
    });
  }

  const bill = billFromFrozenFee(quoteCents, frozen.snapshot.customerFacingFeeCents);
  return {
    ok: true,
    reused: frozen.reused,
    snapshot: frozen.snapshot,
    quoteCents,
    taxCents,
    subtotal: bill.subtotal,
    serviceFee: bill.serviceFee,
    total: Math.round((bill.total + taxCents / 100) * 100) / 100,
  };
}
