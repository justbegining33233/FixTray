import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';

/**
 * Get active campaigns for a shop
 */
export async function getActiveCampaigns(shopId: string) {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: {
        shopId,
        status: { not: 'draft' },
      },
      orderBy: { createdAt: 'desc' },
    });

    logger.info(`Retrieved ${campaigns.length} active campaigns for shop ${shopId}`);
    return campaigns;
  } catch (error) {
    logger.error('Error getting active campaigns', { shopId, error: error instanceof Error ? error.message : String(error) });
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

    // Campaign model doesn't have discount fields, so no discount is applied
    logger.info('Calculated campaign discount', { shopId, discount, campaignId });
    return { discount, campaign };
  } catch (error) {
    logger.error('Error calculating campaign discount', { shopId, error: error instanceof Error ? error.message : String(error) });
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

    logger.info('Retrieved campaign analytics', { campaignId });

    return {
      campaign,
      workOrdersAffected: 0,
      estimatedSavings: 0,
    };
  } catch (error) {
    logger.error('Error getting campaign analytics', { campaignId, error: error instanceof Error ? error.message : String(error) });
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
      orderBy: { createdAt: 'desc' },
    });

    logger.info(`Retrieved ${campaigns.length} campaigns for shop ${shopId}`);
    return campaigns;
  } catch (error) {
    logger.error('Error getting all campaigns', { shopId, error: error instanceof Error ? error.message : String(error) });
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
