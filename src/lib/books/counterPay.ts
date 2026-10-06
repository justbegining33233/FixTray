/**
 * Counter checkout used by POST /api/workorders/[id]/pay for cash, check,
 * and in-person card. The fee is the snapshot frozen at invoice time.
 */

import { planInPersonPayment, type InPersonMethod, type InPersonPlan } from '@/lib/books/money';
import { readCheckoutFeeForInPerson, type FeeFreezeResult } from '@/lib/feeSnapshot';

export type CounterMethod = InPersonMethod;

export function planCounterPayment(input: {
  workOrderId: string;
  shopId: string;
  completion: unknown;
  quoteCents: number;
  embeddedFeeCents?: number | null;
  alreadyReceivedCents: number;
  tenderedCents: number;
  taxCents?: number | null;
  taxAlreadyCollectedCents?: number | null;
  method: CounterMethod;
  feeAlreadyRecorded: boolean;
  actorId: string;
  at: string;
}): { ok: true; frozen: Extract<FeeFreezeResult, { ok: true }>; planned: InPersonPlan } | { ok: false; error: string } {
  const frozen = readCheckoutFeeForInPerson({
    completion: input.completion,
    quoteCents: input.quoteCents,
    embeddedFeeCents: input.embeddedFeeCents,
    now: input.at,
  });
  if (!frozen.ok) return frozen;
  const planned = planInPersonPayment({
    workOrderId: input.workOrderId,
    shopId: input.shopId,
    jobCents: input.quoteCents,
    alreadyReceivedCents: input.alreadyReceivedCents,
    tenderedCents: input.tenderedCents,
    savedFeeCents: 0,
    customerFacingFeeCents: frozen.snapshot.customerFacingFeeCents,
    taxCents: input.taxCents,
    taxAlreadyCollectedCents: input.taxAlreadyCollectedCents,
    method: input.method,
    feeAlreadyRecorded: input.feeAlreadyRecorded,
    actorId: input.actorId,
    at: input.at,
  });
  if (!planned.ok) return planned;
  return { ok: true, frozen, planned };
}
