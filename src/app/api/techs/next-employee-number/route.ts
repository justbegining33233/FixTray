import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/middleware';
import { generateUniqueEmployeeNumber, isFixTrayShopId } from '@/lib/employeeNumber';

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'manager', 'admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const shopId = auth.role === 'shop' ? auth.id : auth.shopId;

    if (!shopId) {
      return NextResponse.json({ error: 'Shop context required' }, { status: 400 });
    }

    const fixTrayShop = await isFixTrayShopId(prisma, shopId);
    const employeeNumber = await generateUniqueEmployeeNumber(prisma, fixTrayShop);

    return NextResponse.json({ employeeNumber });
  } catch (error) {
    console.error('Error generating next employee number:', error);
    return NextResponse.json({ error: 'Failed to generate employee number' }, { status: 500 });
  }
}
