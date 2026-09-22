'use client';

import ShopRestrictedRedirect from '@/components/ShopRestrictedRedirect';

export default function TwoFactorSettingsPage() {
  return <ShopRestrictedRedirect fallback="/shop/settings?tab=security" />;
}
