import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth';
import {
  isWaitingRoomCandidate,
  toWaitingRoomCard,
  waitingRoomWorkOrderWhere,
} from '@/lib/waitingRoomBoard';

function resolveShopId(req: NextRequest): string | null {
  const fromQuery = new URL(req.url).searchParams.get('shopId');
  if (fromQuery) return fromQuery;

  const auth = authenticateRequest(req);
  if (!auth) return null;
  if (auth.role === 'shop') return auth.id;
  return auth.shopId || null;
}

// Public display: a known shopId is enough for the lobby TV.
// Signed-in shop staff can omit shopId; the session identifies the shop.
export async function GET(req: NextRequest) {
  const shopId = resolveShopId(req);
  if (!shopId) return NextResponse.json({ error: 'shopId required' }, { status: 400 });

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { shopName: true, id: true },
  });
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const orders = await prisma.workOrder.findMany({
    where: waitingRoomWorkOrderWhere(shopId),
    include: {
      customer: { select: { firstName: true } },
      assignedTo: { select: { firstName: true, lastName: true } },
      vehicle: { select: { year: true, make: true, model: true } },
    },
    orderBy: { createdAt: 'asc' },
    take: 40,
  });

  const bays = await prisma.bay.findMany({ where: { shopId } });
  const boardOrders = orders
    .filter((wo) => isWaitingRoomCandidate(wo))
    .map((wo) => toWaitingRoomCard(wo));

  return NextResponse.json({
    shopName: shop.shopName,
    orders: boardOrders,
    bays: bays.map((b) => ({ name: b.name, status: b.status, vehicleDesc: b.vehicleDesc })),
  });
}
