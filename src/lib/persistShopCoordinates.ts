import prisma from '@/lib/prisma';
import { geocodeAddress, type GeoPoint } from '@/lib/geocodeAddress';

export function formatShopAddress(shop: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
}): string {
  return [shop.address, shop.city, shop.state, shop.zipCode]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ');
}

export async function saveShopPoint(shopId: string, point: GeoPoint): Promise<void> {
  if (!shopId || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) return;
  if (point.latitude === 0 && point.longitude === 0) return;
  await prisma.shopSettings.upsert({
    where: { shopId },
    create: { shopId, shopLatitude: point.latitude, shopLongitude: point.longitude },
    update: { shopLatitude: point.latitude, shopLongitude: point.longitude },
  });
}

/** Save a geocoded shop pin on ShopSettings. Returns null when the address cannot be placed. */
export async function persistShopCoordinates(shopId: string, address: string): Promise<GeoPoint | null> {
  const query = address.trim();
  if (!shopId || !query) return null;
  const point = await geocodeAddress(query);
  if (!point) return null;
  await saveShopPoint(shopId, point);
  return point;
}

export async function storedShopPoint(shopId: string): Promise<GeoPoint | null> {
  const settings = await prisma.shopSettings.findUnique({
    where: { shopId },
    select: { shopLatitude: true, shopLongitude: true },
  });
  const latitude = settings?.shopLatitude;
  const longitude = settings?.shopLongitude;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude };
}
