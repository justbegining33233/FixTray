import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { booksAccess, shopIdForBooks } from '@/lib/books/access';
import { postBankDeposit } from '@/lib/books/journal';
import { saveJournalDraft } from '@/lib/books/persistJournal';

export const dynamic = 'force-dynamic';

/** Deposits grouped the way a bank statement shows them. Not a bank feed. */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'accountant']);
  if (auth instanceof NextResponse) return auth;
  if (!booksAccess(auth.role).shopLedger) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const shopId = shopIdForBooks(auth);
  if (!shopId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const deposits = await prisma.bankDeposit.findMany({
    where: { shopId },
    orderBy: { depositedAt: 'desc' },
  });
  return NextResponse.json({
    deposits: deposits.map((row) => ({
      id: row.id,
      depositedAt: row.depositedAt.toISOString(),
      amountCents: row.amountCents,
      method: row.method,
      workOrderIds: row.workOrderIds,
      memo: row.memo,
    })),
  });
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, ['shop']);
  if (auth instanceof NextResponse) return auth;
  const shopId = shopIdForBooks(auth);
  if (!shopId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => null);
  const amountCents = Math.round(Number(body?.amountCents));
  const method = String(body?.method || 'check');
  const workOrderIds = Array.isArray(body?.workOrderIds) ? body.workOrderIds.map(String) : [];
  if (amountCents <= 0) return NextResponse.json({ error: 'Deposit amount is required' }, { status: 400 });
  const depositedAt = new Date(String(body?.depositedAt || new Date().toISOString()));
  const deposit = await prisma.bankDeposit.create({
    data: {
      shopId,
      depositedAt,
      amountCents,
      method,
      workOrderIds,
      memo: String(body?.memo || ''),
    },
  });
  await saveJournalDraft(shopId, auth.id, postBankDeposit({
    id: deposit.id,
    date: depositedAt.toISOString().slice(0, 10),
    amountCents,
    workOrderId: workOrderIds[0] || null,
  }));
  return NextResponse.json({ id: deposit.id, amountCents }, { status: 201 });
}
