import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { getLocationsByShop, createLocation } from '@/lib/shop-locations';

// GET /api/shop/locations — List all locations for the shop
export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'manager']);
  if (auth instanceof NextResponse) return auth;

  const shopId = auth.shopId ?? auth.id;
  const locations = await getLocationsByShop(shopId);

  return NextResponse.json({ locations });
}

// POST /api/shop/locations — Add a new location
export async function POST(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'manager']);
  if (auth instanceof NextResponse) return auth;

  const shopId = auth.shopId ?? auth.id;

  let body: Awaited<ReturnType<typeof request.json>>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { name, address, city, state, zip, phone, email, isMain, notes } = body;

  if (!name || !address || !city || !state) {
    return NextResponse.json(
      { error: 'name, address, city, and state are required' },
      { status: 400 }
    );
  }

  const location = await createLocation(shopId, {
    name,
    address,
    city,
    state,
    zip: zip ?? '',
    phone: phone ?? '',
    email: email ?? '',
    isMain: isMain ?? false,
    status: 'active',
    notes: notes ?? '',
  });

  return NextResponse.json({ location }, { status: 201 });
}
