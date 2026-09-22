'use client';

import ShopRestrictedRedirect from '@/components/ShopRestrictedRedirect';

export default function ApiKeysPage() {
  return <ShopRestrictedRedirect fallback="/shop/integrations" />;
}
