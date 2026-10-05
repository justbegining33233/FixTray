/**
 * Destination-charge refund.
 *
 * Stripe's default refund is paid from the platform balance. On a Connect
 * destination charge that leaves the shop's transfer in place, so FixTray
 * would fund the shop's job refund. A job refund reverses the transfer.
 * A fee refund returns the application fee. A job-only refund does not
 * return the application fee.
 *
 * When the charge has a transfer id, the route reverses that exact job
 * amount before refunding the customer. The flags below are the fallback
 * Stripe applies when the transfer id is not on the charge.
 */

import { allocateRefund } from '@/lib/books/money';

export interface DestinationRefundPlan {
  amountCents: number;
  jobCents: number;
  feeCents: number;
  reverseTransfer: boolean;
  refundApplicationFee: boolean;
}

export function destinationChargeRefundPlan(input: {
  amountCents: number;
  jobRemainingCents: number;
  feeRemainingCents: number;
  appliesTo?: 'auto' | 'job' | 'fee';
}): { ok: true; plan: DestinationRefundPlan } | { ok: false; error: string } {
  const split = allocateRefund(
    input.amountCents,
    input.jobRemainingCents,
    input.feeRemainingCents,
    input.appliesTo ?? 'auto',
  );
  if ('error' in split) return { ok: false, error: split.error };
  return {
    ok: true,
    plan: {
      amountCents: split.jobCents + split.feeCents,
      jobCents: split.jobCents,
      feeCents: split.feeCents,
      reverseTransfer: split.jobCents > 0,
      refundApplicationFee: split.feeCents > 0,
    },
  };
}
