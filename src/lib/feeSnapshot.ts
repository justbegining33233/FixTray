/**
 * Customer-facing FixTray fee, frozen when an invoice or checkout total is fixed.
 *
 * Stored on the existing work order JSON column `completion.fixtrayFeeSnapshot`.
 * No new column and no migration. Later edits to PlatformConfig.serviceFee do
 * not change a snapshot whose shop quote is unchanged. Estimate saves do not
 * write `completion`, and offline notes spread the rest of that object, so the
 * snapshot survives both.
 *
 * `platformFeeCents` is the PlatformConfig net that was used when the customer
 * fee was calculated. It is audit context. Owed amounts use
 * `customerFacingFeeCents` and are not recomputed from the live setting.
 */

import { centsToUsd, customerFacingServiceFeeCents, usdToCents, type ServiceFeeBill } from '@/lib/serviceFeeBill';

export const FEE_SNAPSHOT_KEY = 'fixtrayFeeSnapshot';

export interface FixtrayFeeSnapshot {
  /** Exact customer-facing fee in cents at the moment the total was fixed. */
  customerFacingFeeCents: number;
  /** Shop quote in cents that this fee belongs to. */
  quoteCents: number;
  /**
   * PlatformConfig.serviceFee cents used to calculate the customer fee.
   * Zero when the fee was copied off a payment link that already stored it.
   */
  platformFeeCents: number;
  frozenAt: string;
}

export type FeeFreezeResult =
  | { ok: true; reused: boolean; snapshot: FixtrayFeeSnapshot; completion: Record<string, unknown> }
  | { ok: false; error: string };

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
}

function parseSnapshot(value: unknown): FixtrayFeeSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const customerFacingFeeCents = row.customerFacingFeeCents;
  const quoteCents = row.quoteCents;
  const platformFeeCents = row.platformFeeCents;
  const frozenAt = row.frozenAt;
  if (!Number.isInteger(customerFacingFeeCents) || (customerFacingFeeCents as number) < 0) return null;
  if (!Number.isInteger(quoteCents) || (quoteCents as number) <= 0) return null;
  if (!Number.isInteger(platformFeeCents) || (platformFeeCents as number) < 0) return null;
  if (typeof frozenAt !== 'string' || frozenAt.trim() === '') return null;
  return {
    customerFacingFeeCents: customerFacingFeeCents as number,
    quoteCents: quoteCents as number,
    platformFeeCents: platformFeeCents as number,
    frozenAt,
  };
}

export function readFeeSnapshot(completion: unknown): FixtrayFeeSnapshot | null {
  return parseSnapshot(asRecord(completion)[FEE_SNAPSHOT_KEY]);
}

function withSnapshot(completion: unknown, snapshot: FixtrayFeeSnapshot): Record<string, unknown> {
  return { ...asRecord(completion), [FEE_SNAPSHOT_KEY]: snapshot };
}

function snapshotFromEmbedded(
  completion: unknown,
  quoteCents: number,
  embeddedFeeCents: number,
  now: string,
): FeeFreezeResult {
  const snapshot: FixtrayFeeSnapshot = {
    customerFacingFeeCents: embeddedFeeCents,
    quoteCents,
    platformFeeCents: 0,
    frozenAt: now,
  };
  return { ok: true, reused: false, snapshot, completion: withSnapshot(completion, snapshot) };
}

/**
 * Fix the customer fee for a checkout or invoice.
 * A snapshot for the same shop quote is reused, even when the live platform
 * fee is different or missing. A payment-link total that already includes a
 * fee is adopted when nothing has been snapshotted yet. A changed shop quote
 * is a new total and uses the live platform fee.
 */
export function freezeFeeSnapshot(input: {
  completion: unknown;
  quoteCents: number;
  livePlatformFeeCents: number | null;
  embeddedFeeCents?: number | null;
  now: string;
}): FeeFreezeResult {
  const quoteCents = Math.round(input.quoteCents);
  if (!Number.isInteger(quoteCents) || quoteCents <= 0) {
    return { ok: false, error: 'Add a shop total before fixing the FixTray fee.' };
  }
  const existing = readFeeSnapshot(input.completion);
  if (existing && existing.quoteCents === quoteCents) {
    return { ok: true, reused: true, snapshot: existing, completion: withSnapshot(input.completion, existing) };
  }
  const embedded = input.embeddedFeeCents;
  if (!existing && Number.isInteger(embedded) && (embedded as number) > 0) {
    return snapshotFromEmbedded(input.completion, quoteCents, embedded as number, input.now);
  }
  if (input.livePlatformFeeCents == null || !Number.isInteger(input.livePlatformFeeCents) || input.livePlatformFeeCents < 0) {
    return { ok: false, error: 'The platform service fee is not configured.' };
  }
  const snapshot: FixtrayFeeSnapshot = {
    customerFacingFeeCents: customerFacingServiceFeeCents(quoteCents, input.livePlatformFeeCents),
    quoteCents,
    platformFeeCents: input.livePlatformFeeCents,
    frozenAt: input.now,
  };
  return { ok: true, reused: false, snapshot, completion: withSnapshot(input.completion, snapshot) };
}

/**
 * In-person mark-paid. Uses a stored snapshot or a fee already baked into a
 * payment link. Never calculates from the live platform fee.
 */
export function readCheckoutFeeForInPerson(input: {
  completion: unknown;
  quoteCents: number;
  embeddedFeeCents?: number | null;
  now: string;
}): FeeFreezeResult {
  const quoteCents = Math.round(input.quoteCents);
  if (!Number.isInteger(quoteCents) || quoteCents <= 0) {
    return { ok: false, error: 'The shop job amount is missing' };
  }
  const existing = readFeeSnapshot(input.completion);
  if (existing && existing.quoteCents === quoteCents) {
    return { ok: true, reused: true, snapshot: existing, completion: withSnapshot(input.completion, existing) };
  }
  if (existing && existing.quoteCents !== quoteCents) {
    return {
      ok: false,
      error: 'The shop total changed after the FixTray fee was fixed. Invoice the job again before taking payment.',
    };
  }
  const embedded = input.embeddedFeeCents;
  if (Number.isInteger(embedded) && (embedded as number) > 0) {
    return snapshotFromEmbedded(input.completion, quoteCents, embedded as number, input.now);
  }
  return {
    ok: false,
    error: 'Invoice this job before taking an in-person payment so the FixTray fee stays the amount fixed at checkout.',
  };
}

export function billFromFrozenFee(quoteCents: number, customerFacingFeeCents: number): ServiceFeeBill {
  return {
    subtotal: centsToUsd(quoteCents),
    serviceFee: centsToUsd(customerFacingFeeCents),
    total: centsToUsd(quoteCents + customerFacingFeeCents),
  };
}

/** Customer-facing fee in USD when the snapshot belongs to this shop quote. */
export function frozenCustomerFeeUsd(completion: unknown, quoteUsd: number): number | undefined {
  const snapshot = readFeeSnapshot(completion);
  if (!snapshot) return undefined;
  if (snapshot.quoteCents !== usdToCents(quoteUsd)) return undefined;
  return centsToUsd(snapshot.customerFacingFeeCents);
}

/** Positive difference when a payment link total already includes the fee. */
export function embeddedFeeCents(linkAmountUsd: number | null | undefined, quoteCents: number): number | null {
  if (linkAmountUsd == null || quoteCents <= 0) return null;
  const extra = usdToCents(linkAmountUsd) - quoteCents;
  return extra > 0 ? extra : null;
}
