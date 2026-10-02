/**
 * Saved FixTray platform fee (per work order).
 *
 * Source of truth: PlatformConfig.serviceFee (cents), edited by superadmin
 * via /superadmin/settings and /api/admin/settings. This is what the platform
 * nets after Stripe. Checkout grosses it up into the customer-facing fee.
 * Do not write the customer-facing amount back here.
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

/**
 * Fee used to charge a card. Returns null when PlatformConfig has no fee,
 * so checkout fails closed instead of charging the public $5 fallback.
 */
export async function getConfiguredPlatformServiceFeeUsd(): Promise<number | null> {
  try {
    const config = await prisma.platformConfig.findUnique({ where: { id: 'global' } });
    if (typeof config?.serviceFee !== 'number' || !Number.isFinite(config.serviceFee)) return null;
    return round2(Math.max(0, config.serviceFee) / 100);
  } catch {
    return null;
  }
}

/** Convert a USD fee (e.g. from an invoice snapshot) to cents. */
export function serviceFeeUsdToCents(usd: number): number {
  return Math.round(Math.max(0, usd) * 100);
}

/**
 * PlatformConfig.serviceFee is stored in cents.
 * System settings and superadmin both submit cents (`serviceFee` or `serviceFeeRaw`).
 * Do not multiply by 100 again — that turns a $10 fee (1000) into $1,000.
 */
export function normalizePlatformServiceFeeCents(body: {
  serviceFee?: unknown;
  serviceFeeRaw?: unknown;
}): number | undefined {
  const raw = typeof body.serviceFeeRaw === 'number' && Number.isFinite(body.serviceFeeRaw)
    ? body.serviceFeeRaw
    : typeof body.serviceFee === 'number' && Number.isFinite(body.serviceFee)
      ? body.serviceFee
      : undefined;
  if (raw === undefined) return undefined;
  return Math.max(0, Math.round(raw));
}
