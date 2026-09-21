'use client';

import ShopRestrictedSurface from '@/components/ShopRestrictedSurface';

export default function SessionsPage() {
  return (
    <ShopRestrictedSurface
      title="This sessions address is not used by the shop portal."
      detail="Review and revoke sessions from Shop Settings → Security. This page does not call the sessions API."
    />
  );
}
