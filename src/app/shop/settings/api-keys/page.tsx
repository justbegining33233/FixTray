'use client';

import ShopRestrictedSurface from '@/components/ShopRestrictedSurface';

export default function ApiKeysPage() {
  return (
    <ShopRestrictedSurface
      title="API keys are not available from the shop portal."
      detail="This page does not call the API key service."
    />
  );
}
