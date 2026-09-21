'use client';

import ShopRestrictedSurface from '@/components/ShopRestrictedSurface';

export default function TwoFactorSettingsPage() {
  return (
    <ShopRestrictedSurface
      title="Two-factor setup has moved."
      detail="Turn two-factor authentication on or off from Shop Settings → Security. This address does not call the two-factor API."
    />
  );
}
