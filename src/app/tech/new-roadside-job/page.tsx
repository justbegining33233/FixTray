'use client';

import ShopNewRoadsideJob from '@/app/shop/new-roadside-job/page';
import TechPortalFrame from '@/components/TechPortalFrame';

/** Techs create roadside jobs for their shop, with technician navigation. */
export default function TechNewRoadsideJob() {
  return (
    <TechPortalFrame>
      <ShopNewRoadsideJob />
    </TechPortalFrame>
  );
}
