export const REWARD_TIERS = [
  { id: 'tier-1', name: '$10 Off Next Service', value: '$10', description: 'Redeem for $10 off any service at a FixTray shop.', pointCost: 200 },
  { id: 'tier-2', name: 'Free Oil Change', value: 'Free', description: 'Redeem for a complimentary standard oil change (up to $45 value).', pointCost: 500 },
  { id: 'tier-3', name: '$25 Off Any Repair', value: '$25', description: 'Redeem for $25 off any repair service over $75.', pointCost: 750 },
  { id: 'tier-4', name: 'Free Annual Inspection', value: 'Free', description: 'Redeem for a complimentary annual vehicle inspection.', pointCost: 1000 },
];

export type RewardClaimRow = {
  tierId: string;
  status: string;
  claimedAt: Date | string;
  redeemedAt?: Date | string | null;
  expiresAt?: Date | string | null;
};

export type CompletedOrderRow = {
  amountPaid?: number | null;
  estimatedCost?: number | null;
  completedAt?: Date | string | null;
  status?: string | null;
};

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function emptyRewardsPayload() {
  return buildCustomerRewards({ loyaltyPoints: 0, claims: [], completed: [] });
}

export function buildCustomerRewards(input: {
  loyaltyPoints: number;
  claims: RewardClaimRow[];
  completed: CompletedOrderRow[];
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const points = Number.isFinite(input.loyaltyPoints) ? Math.max(0, Math.floor(input.loyaltyPoints)) : 0;
  const claimMap = new Map<string, RewardClaimRow>();
  for (const claim of input.claims || []) {
    const existing = claimMap.get(claim.tierId);
    const claimAt = asDate(claim.claimedAt)?.getTime() ?? 0;
    const existingAt = existing ? (asDate(existing.claimedAt)?.getTime() ?? 0) : -1;
    if (!existing || claimAt > existingAt) claimMap.set(claim.tierId, claim);
  }

  const rewards = REWARD_TIERS.map((tier) => {
    const claim = claimMap.get(tier.id);
    const expiresAt = asDate(claim?.expiresAt);
    const activeClaim = claim && claim.status !== 'expired' && expiresAt && expiresAt > now ? claim : null;
    const claimedAt = asDate(activeClaim?.claimedAt);
    const redeemedAt = asDate(activeClaim?.redeemedAt);
    return {
      ...tier,
      expires: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      earned: points >= tier.pointCost,
      claimed: !!activeClaim,
      claimStatus: activeClaim?.status ?? null,
      claimedAt: claimedAt ? claimedAt.toLocaleDateString() : null,
      redeemedAt: redeemedAt ? redeemedAt.toLocaleDateString() : null,
      progress: Math.min(points, tier.pointCost),
      total: tier.pointCost,
    };
  });

  const history = (input.completed || []).slice(0, 10).map((order, index) => {
    const paid = order.amountPaid || order.estimatedCost || 0;
    const completedAt = asDate(order.completedAt);
    return {
      id: `entry-${index}`,
      description: `Completed service — $${Number(paid).toFixed(2)} spent`,
      points: Math.floor(Number(paid) || 0),
      date: completedAt ? completedAt.toLocaleDateString() : 'N/A',
    };
  });

  return { loyaltyPoints: points, rewards, history };
}

/** Rewards API field is `loyaltyPoints`. Older callers looked for `points` and then invented 50 per job. */
export function loyaltyPointsFromRewards(payload: unknown, fallback = 0): number {
  if (!payload || typeof payload !== 'object') return fallback;
  const record = payload as { loyaltyPoints?: unknown; points?: unknown };
  if (typeof record.loyaltyPoints === 'number' && Number.isFinite(record.loyaltyPoints)) {
    return Math.max(0, Math.floor(record.loyaltyPoints));
  }
  if (typeof record.points === 'number' && Number.isFinite(record.points)) {
    return Math.max(0, Math.floor(record.points));
  }
  return fallback;
}
