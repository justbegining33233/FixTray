import { NextRequest, NextResponse } from 'next/server';
import { requireQuickBooksOwner } from '@/lib/books/qboOwner';
import { writeAudit } from '@/lib/books/persist';
import { qboAccountMap, qboAudit } from '@/lib/books/qbo';
import { saveQboAccountMap } from '@/lib/books/qboStore';

export const dynamic = 'force-dynamic';

/** POST /api/shop/quickbooks/map — save the six shop accounts. Fee accounts are rejected. */
export async function POST(request: NextRequest) {
  const owner = requireQuickBooksOwner(request);
  if (owner instanceof NextResponse) return owner;
  const body = await request.json().catch(() => null);
  const raw = body && typeof body === 'object' ? (body as { map?: Record<string, unknown> }).map : null;
  const mapped = qboAccountMap(raw);
  if (!mapped.ok) return NextResponse.json({ error: mapped.error }, { status: 400 });
  await saveQboAccountMap(owner.shopId, mapped.map);
  const at = new Date().toISOString();
  await writeAudit(qboAudit({
    actorId: owner.auth.id,
    at,
    shopId: owner.shopId,
    action: 'books.quickbooks_map',
    details: 'mapped sales, payments, refunds, labor, parts, and tax',
  }));
  return NextResponse.json({ ok: true, qbMap: mapped.map, mapSaved: true });
}
