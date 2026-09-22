'use client';

import ShopRestrictedRedirect from '@/components/ShopRestrictedRedirect';

export default function SessionsPage() {
  return <ShopRestrictedRedirect fallback="/shop/settings?tab=security" />;
}
