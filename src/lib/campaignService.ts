import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';

/**
 * Get active campaigns for a shop
 */
export async function getActiveCampaigns(shopId: string) {
  try {
    const today = new Date();

    const campaigns = await prisma.campaign.findMany({
      where: {
        shopId,
        active: true,
        startDate: { lte: today },
        endDate: { gte: today },
      },
      orderBy: { createdAt: 'desc' },
    });

    logger.info(`Retrieved ${campaigns.length} active campaigns for shop ${shopId}`);
    return campaigns;
  } catch (error) {
    logger.error('Error getting active campaigns', { shopId, error });
    throw error;
  }
}

/**
 * Calculate campaign discount
 */
export async function calculateCampaignDiscount(
  shopId: string,
  subtotal: number,
  campaignId?: string
): Promise<{ discount: number; campaign: any | null }> {
  try {
    let campaign = null;
    let discount = 0;

    if (campaignId) {
      campaign = await prisma.campaign.findFirst({
        where: { id: campaignId, shopId },
      });
    } else {
      // Get first active campaign
      const campaigns = await getActiveCampaigns(shopId);
      campaign = campaigns[0] || null;
    }

    if (campaign) {
      discount =
        campaign.discountType === 'percentage'
          ? (subtotal * campaign.discountValue) / 100
          : campaign.discountValue;
    }

    logger.info('Calculated campaign discount', { shopId, discount, campaignId });
    return { discount, campaign };
  } catch (error) {
    logger.error('Error calculating campaign discount', { shopId, error });
    throw error;
  }
}

/**
 * Get campaign performance analytics
 */
export async function getCampaignAnalytics(shopId: string, campaignId: string) {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, shopId },
    });

    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    // Get work orders affected by this campaign (in campaign date range)
    const workOrders = await prisma.workOrder.findMany({
      where: {
        shopId,
        createdAt: {
          gte: campaign.startDate,
          lte: campaign.endDate,
        },
      },
    });

    const totalSavings =
      workOrders.length *
      (campaign.discountType === 'percentage'
        ? (5000 * campaign.discountValue) / 100 // Assume avg $5000 job
        : campaign.discountValue);

    logger.info('Retrieved campaign analytics', { campaignId, workOrders: workOrders.length });

    return {
      campaign,
      workOrdersAffected: workOrders.length,
      estimatedSavings: totalSavings,
    };
  } catch (error) {
    logger.error('Error getting campaign analytics', { campaignId, error });
    throw error;
  }
}

/**
 * Get all campaigns (past, present, future)
 */
export async function getAllCampaigns(shopId: string) {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { shopId },
      orderBy: { startDate: 'desc' },
    });

    logger.info(`Retrieved ${campaigns.length} campaigns for shop ${shopId}`);
    return campaigns;
  } catch (error) {
    logger.error('Error getting all campaigns', { shopId, error });
    throw error;
  }
}

/**
 * Generate coupon code from campaign
 */
export function generateCouponCode(campaignId: string): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${timestamp}${random}`.substring(0, 10);
}
