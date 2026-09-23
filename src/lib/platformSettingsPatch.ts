import { isSupportedLocaleInput, normalizeLocale } from './locale';
import { normalizePlatformServiceFeeCents } from './platformFee';

export function platformSettingsUpdate(body: Record<string, unknown>): {
  data: Record<string, unknown>;
  error?: string;
} {
  const data: Record<string, unknown> = {};

  // System settings and superadmin both submit cents. Do not multiply again.
  const serviceFeeCents = normalizePlatformServiceFeeCents(body);
  if (serviceFeeCents !== undefined) data.serviceFee = serviceFeeCents;
  if (typeof body.platformName === 'string') data.platformName = body.platformName;
  if (typeof body.supportEmail === 'string') data.supportEmail = body.supportEmail;
  if (typeof body.maintenanceMode === 'boolean') data.maintenanceMode = body.maintenanceMode;
  if (typeof body.enableShopRegistration === 'boolean') data.enableShopRegistration = body.enableShopRegistration;
  if (typeof body.enableCustomerPortal === 'boolean') data.enableCustomerPortal = body.enableCustomerPortal;
  if (typeof body.enableEmailNotifications === 'boolean') data.enableEmailNotifications = body.enableEmailNotifications;

  if (body.defaultLanguage !== undefined) {
    if (!isSupportedLocaleInput(body.defaultLanguage)) {
      return { data: {}, error: 'Unsupported language.' };
    }
    data.defaultLanguage = normalizeLocale(body.defaultLanguage);
  }

  return { data };
}
