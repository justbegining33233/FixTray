'use client';

import ShopRestrictedSurface from '@/components/ShopRestrictedSurface';

export default function WebhooksPage() {
  return (
    <ShopRestrictedSurface
      title="Webhooks are not available from the shop portal."
      detail="This page does not call the webhook service."
    />
  );
}
