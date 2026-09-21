'use client';

import ShopNewInShopJob from '@/app/shop/new-inshop-job/page';
import TechPortalFrame from '@/components/TechPortalFrame';

/** Techs create in-shop jobs for their shop, with technician navigation. */
export default function TechNewInShopJob() {
  return (
    <TechPortalFrame>
      <ShopNewInShopJob />
    </TechPortalFrame>
  );
}
