import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  // Compatibility endpoint for legacy callers that expect feature flags.
  const isShopStaff = ['shop', 'manager', 'admin', 'superadmin'].includes(auth.role);
  const isTech = auth.role === 'tech';

  return NextResponse.json({
    role: auth.role,
    features: {
      inventory: isShopStaff,
      messaging: isShopStaff || isTech || auth.role === 'customer',
      timeTracking: isShopStaff || isTech,
      reports: isShopStaff,
    },
    permissions: {
      canReadInventory: isShopStaff,
      canEditInventory: auth.role === 'shop' || auth.role === 'superadmin',
    },
  });
}
