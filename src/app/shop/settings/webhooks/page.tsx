'use client';

import ShopRestrictedRedirect from '@/components/ShopRestrictedRedirect';

export default function WebhooksPage() {
  return <ShopRestrictedRedirect fallback="/shop/integrations" />;
}
