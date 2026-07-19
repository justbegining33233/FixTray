import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import logger from '@/lib/logger';

/**
 * GET /api/shops/[id]/reward-redemptions — List pending customer reward redemption requests
 * Phase 4: Integration fix - Customers can claim rewards but shops can't see pending redemptions
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, ['shop', 'manager']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    // Verify user has access to this shop
    if (auth.role !== 'superadmin' && auth.id !== id && auth.shopId !== id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch pending reward claims for this shop's customers
    const rewardClaims = await prisma.rewardClaim.findMany({
      where: {
        customer: {
          workOrders: { some: { shopId: id } },
        },
        status: 'pending', // Only show pending claims
        expiresAt: { gt: new Date() }, // Not expired
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { claimedAt: 'desc' },
    });

    // Map to reward tier info
    const rewardTierMap = new Map([
      ['tier-1', { name: '$10 Off Next Service', value: '$10', pointCost: 200 }],
      ['tier-2', { name: 'Free Oil Change', value: 'Free', pointCost: 500 }],
      ['tier-3', { name: '$25 Off Any Repair', value: '$25', pointCost: 750 }],
      ['tier-4', { name: 'Free Annual Inspection', value: 'Free', pointCost: 1000 }],
    ]);

    const redemptions = rewardClaims.map(claim => {
      const tierInfo = rewardTierMap.get(claim.tierId);
      return {
        claimId: claim.id,
        customerId: claim.customer.id,
        customerName: `${claim.customer.firstName} ${claim.customer.lastName}`,
        customerEmail: claim.customer.email,
        reward: tierInfo?.name || 'Unknown Reward',
        value: tierInfo?.value || 'Unknown',
        pointCost: tierInfo?.pointCost || 0,
        claimedAt: claim.claimedAt,
        expiresAt: claim.expiresAt,
        status: claim.status,
      };
    });

    return NextResponse.json({
      shopId: id,
      totalPending: redemptions.length,
      redemptions,
    });
  } catch (error) {
    logger.error('Reward redemptions GET error:', error, { endpoint: '/api/shops/[id]/reward-redemptions' });
    return NextResponse.json({ error: 'Failed to fetch pending redemptions' }, { status: 500 });
  }
}

/**
 * POST /api/shops/[id]/reward-redemptions/{claimId} — Mark reward as redeemed
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, ['shop', 'manager']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();
    const { claimId, action } = body; // action: 'redeem' | 'cancel'

    if (!claimId || !['redeem', 'cancel'].includes(action)) {
      return NextResponse.json({ error: 'Invalid claimId or action' }, { status: 400 });
    }

    // Verify user has access to this shop
    if (auth.role !== 'superadmin' && auth.id !== id && auth.shopId !== id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify the claim belongs to a customer of this shop
    const claim = await prisma.rewardClaim.findUnique({
      where: { id: claimId },
      include: { customer: { select: { id: true } } },
    });

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    // Verify customer belongs to this shop
    const isShopCustomer = await prisma.workOrder.findFirst({
      where: { shopId: id, customerId: claim.customer.id },
      select: { id: true },
    });

    if (!isShopCustomer) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update reward claim status
    const updated = await prisma.rewardClaim.update({
      where: { id: claimId },
      data: {
        status: action === 'redeem' ? 'redeemed' : 'cancelled',
        redeemedAt: action === 'redeem' ? new Date() : undefined,
      },
    });

    logger.info('Reward claim updated', {
      claimId,
      shopId: id,
      action,
      newStatus: updated.status,
    });

    return NextResponse.json({
      success: true,
      claimId: updated.id,
      status: updated.status,
    });
  } catch (error) {
    logger.error('Reward redemption POST error:', error, { endpoint: '/api/shops/[id]/reward-redemptions' });
    return NextResponse.json({ error: 'Failed to update reward redemption' }, { status: 500 });
  }
}
