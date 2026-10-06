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

export type FrozenCheckoutBill =
  | {
      ok: true;
      reused: boolean;
      snapshot: FixtrayFeeSnapshot;
      quoteCents: number;
      subtotal: number;
      serviceFee: number;
      total: number;
    }
  | { ok: false; status: number; error: string };

export async function freezeWorkOrderCheckoutFee(workOrder: {
  id: string;
  completion: unknown;
  estimatedCost?: number | null;
  estimate?: unknown;
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

  const previous = readFeeSnapshot(workOrder.completion);
  const changed = !previous
    || previous.customerFacingFeeCents !== frozen.snapshot.customerFacingFeeCents
    || previous.quoteCents !== frozen.snapshot.quoteCents
    || previous.frozenAt !== frozen.snapshot.frozenAt
    || previous.platformFeeCents !== frozen.snapshot.platformFeeCents;
  if (changed) {
    await prisma.workOrder.update({
      where: { id: workOrder.id },
      data: { completion: frozen.completion as Prisma.InputJsonValue },
    });
  }

  const bill = billFromFrozenFee(quoteCents, frozen.snapshot.customerFacingFeeCents);
  return {
    ok: true,
    reused: frozen.reused,
    snapshot: frozen.snapshot,
    quoteCents,
    subtotal: bill.subtotal,
    serviceFee: bill.serviceFee,
    total: bill.total,
  };
}
