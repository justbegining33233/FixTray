import { FIXTRAY_SERVICE_FEE } from '@/lib/constants';

/** Flat fee named in the product. PlatformConfig can set a different live amount. */
export function fixtrayServiceFeeLabel(): string {
  return `$${FIXTRAY_SERVICE_FEE.toFixed(2)}`;
}

/**
 * Public explanation of who is free and what a customer pays.
 * The dollar amount comes from FIXTRAY_SERVICE_FEE, the product default.
 */
export function memberAndCustomerFeeCopy(): string {
  return `Shop owners and their employees, including technicians and managers, use FixTray at no charge. FixTray does not charge members a subscription. A customer pays the shop's quote plus a FixTray service fee of ${fixtrayServiceFeeLabel()} when that fee applies. The amount shown at checkout is the amount charged.`;
}
