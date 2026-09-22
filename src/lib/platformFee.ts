/**
 * FixTray platform service fee (per work order).
 *
 * Source of truth: PlatformConfig.serviceFee (cents), edited by superadmin
 * via /superadmin/settings and /api/admin/settings.
 * FIXTRAY_SERVICE_FEE_CENTS is only the fallback when no config row exists.
 */

import prisma from '@/lib/prisma';
import { FIXTRAY_SERVICE_FEE_CENTS } from '@/lib/constants';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Current FixTray fee in USD, read from PlatformConfig. */
export async function getPlatformServiceFeeUsd(): Promise<number> {
  try {
    const config = await prisma.platformConfig.findUnique({ where: { id: 'global' } });
    const cents =
      typeof config?.serviceFee === 'number' && Number.isFinite(config.serviceFee)
        ? config.serviceFee
        : FIXTRAY_SERVICE_FEE_CENTS;
    return round2(Math.max(0, cents) / 100);
  } catch {
    return round2(FIXTRAY_SERVICE_FEE_CENTS / 100);
  }
}

/** Convert a USD fee (e.g. from an invoice snapshot) to cents. */
export function serviceFeeUsdToCents(usd: number): number {
  return Math.round(Math.max(0, usd) * 100);
}
