import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { REWARD_TIERS, buildCustomerRewards, emptyRewardsPayload } from '@/lib/rewardPayload';

// Extract loyalty points calculation to shared function (Phase 2: Consolidate logic)
async function calculateLoyaltyPoints(customerId: string): Promise<number> {
  const completedWOs = await prisma.workOrder.findMany({
    where: {
      customerId,
      status: { in: ['closed', 'completed', 'Completed'] },
    },
    select: { amountPaid: true, estimatedCost: true },
  });
  return completedWOs.reduce((sum, w) => {
    const paid = w.amountPaid || w.estimatedCost || 0;
    return sum + Math.floor(paid);
  }, 0);
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['customer']);
  if (auth instanceof NextResponse) return auth;

  try {
    const customerId = auth.id;
    // Ensure customer can only view their own rewards
    const requestedCustomerId = new URL(request.url).searchParams.get('customerId') || customerId;
    if (requestedCustomerId !== customerId) {
      return NextResponse.json({ error: 'Unauthorized: cannot view another customer\'s rewards' }, { status: 403 });
    }

    const [loyaltyPoints, existingClaims, workOrders] = await Promise.all([
      calculateLoyaltyPoints(customerId).catch((error) => {
        console.error('Loyalty points lookup failed:', error);
        return 0;
      }),
      prisma.rewardClaim.findMany({
        where: { customerId },
        select: { tierId: true, status: true, claimedAt: true, redeemedAt: true, expiresAt: true },
      }).catch((error) => {
        console.error('Reward claims lookup failed:', error);
        return [];
      }),
      prisma.workOrder.findMany({
        where: { customerId },
        select: { status: true, completedAt: true, amountPaid: true, estimatedCost: true },
      }).catch((error) => {
        console.error('Reward work order lookup failed:', error);
        return [];
      }),
    ]);

    const completed = workOrders.filter(w =>
      ['closed', 'completed', 'Completed'].includes(w.status)
    );

    return NextResponse.json(buildCustomerRewards({
      loyaltyPoints,
      claims: existingClaims,
      completed,
    }));
  } catch (error) {
    console.error('Error fetching customer rewards:', error);
    return NextResponse.json(emptyRewardsPayload());
  }
}

// POST /api/customers/rewards  — claim a reward
export async function POST(request: NextRequest) {
  const auth = requireRole(request, ['customer']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json().catch(() => ({}));
    const tierId = body.tierId || body.rewardId;
    const tier = REWARD_TIERS.find(t => t.id === tierId);
    if (!tier) return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });

    const customerId = auth.id;

    // Check loyalty points - reuse shared function (Phase 2: Consolidated logic)
    const loyaltyPoints = await calculateLoyaltyPoints(customerId);
    if (loyaltyPoints < tier.pointCost) {
      return NextResponse.json({ error: 'Not enough points' }, { status: 400 });
    }

    // Prevent duplicate active claims
    const existing = await prisma.rewardClaim.findFirst({
      where: {
        customerId,
        tierId,
        status: { not: 'expired' },
        expiresAt: { gt: new Date() },
      },
    });
    if (existing) {
      return NextResponse.json({ error: 'You already have an active claim for this reward' }, { status: 409 });
    }

    const claim = await prisma.rewardClaim.create({
      data: {
        customerId,
        tierId,
        status: 'pending',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });

    return NextResponse.json({ success: true, claim }, { status: 201 });
  } catch (error) {
    console.error('Error claiming reward:', error);
    return NextResponse.json({ error: 'Failed to claim reward' }, { status: 500 });
  }
}
