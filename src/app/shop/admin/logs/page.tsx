'use client';

import ShopRestrictedSurface from '@/components/ShopRestrictedSurface';

export default function ShopLogsPage() {
  return (
    <ShopRestrictedSurface
      title="Audit logs are not available from the shop portal."
      detail="This page does not call the logs API. Use Shop Home for day-to-day work."
    />
  );
}
