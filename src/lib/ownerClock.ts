import crypto from 'crypto';
import bcrypt from 'bcrypt';
import prisma from '@/lib/prisma';
import { resolveClockTechId } from '@/lib/books/clocks';

/** Stable address so the owner clock profile is not a real login. */
export function ownerClockEmail(shopId: string): string {
  return `owner-clock+${shopId}@clock.fixtray.invalid`;
}

export async function ensureOwnerClockTech(shopId: string): Promise<string> {
  const email = ownerClockEmail(shopId);
  const existing = await prisma.tech.findUnique({ where: { email }, select: { id: true } });
  if (existing) return existing.id;
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { ownerName: true, shopName: true, phone: true },
  });
  const owner = (shop?.ownerName || shop?.shopName || 'Shop Owner').trim();
  const [firstName, ...rest] = owner.split(/\s+/);
  const password = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
  const tech = await prisma.tech.create({
    data: {
      shopId,
      email,
      password,
      firstName: firstName || 'Shop',
      lastName: rest.join(' ') || 'Owner',
      phone: shop?.phone || null,
      role: 'owner',
      jobTitle: 'Shop owner',
    },
    select: { id: true },
  });
  return tech.id;
}

export async function resolveActorClockTech(input: {
  role: string;
  actorId: string;
  requestedTechId: string;
  shopId: string;
}): Promise<{ ok: true; techId: string } | { ok: false; error: string }> {
  const ownerTechId = input.role === 'shop'
    ? await ensureOwnerClockTech(input.actorId)
    : null;
  return resolveClockTechId({
    role: input.role,
    requestedTechId: input.requestedTechId,
    actorId: input.actorId,
    ownerTechId,
  });
}
