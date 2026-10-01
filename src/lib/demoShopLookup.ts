import prisma from '@/lib/prisma';
import { isDemoUsername } from '@/lib/demoShopRules';

const CACHE_MS = 5_000;
const cache = new Map<string, { demo: boolean; at: number }>();

/** Remember a shop id that was just created as a demo, before the next lookup. */
export function rememberDemoShop(shopId: string): void {
  cache.set(shopId, { demo: true, at: Date.now() });
}

/**
 * True when this shop is a demo shop.
 * A deleted demo shop still counts while its demo session row exists, so a
 * send that was already loaded cannot go out after the shop row is gone.
 */
export async function isDemoShopId(shopId: string | null | undefined): Promise<boolean> {
  if (!shopId) return false;
  const hit = cache.get(shopId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.demo;
  try {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { username: true },
    });
    if (shop) {
      const demo = isDemoUsername(shop.username);
      cache.set(shopId, { demo, at: Date.now() });
      return demo;
    }
    const session = await prisma.demoSession.findUnique({
      where: { shopId },
      select: { id: true },
    });
    const demo = !!session;
    cache.set(shopId, { demo, at: Date.now() });
    return demo;
  } catch {
    return hit?.demo ?? false;
  }
}
