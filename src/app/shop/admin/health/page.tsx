'use client';

import ShopRestrictedSurface from '@/components/ShopRestrictedSurface';

export default function HealthCheckPage() {
  return (
    <ShopRestrictedSurface
      title="System health is not available for shop accounts."
      detail="Environment and platform health stay with FixTray administrators. This page does not probe those checks."
    />
  );
}
