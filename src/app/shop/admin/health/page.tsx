'use client';

import ShopRestrictedRedirect from '@/components/ShopRestrictedRedirect';

export default function HealthCheckPage() {
  return <ShopRestrictedRedirect fallback="/shop/home" />;
}
