'use client';

import ShopRestrictedRedirect from '@/components/ShopRestrictedRedirect';

export default function ShopLogsPage() {
  return <ShopRestrictedRedirect fallback="/shop/admin" />;
}
