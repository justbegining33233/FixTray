import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { booksAccess, shopIdForBooks } from '@/lib/books/access';
import { loadShopBooks, loadShopLabor } from '@/lib/books/loadShopBooks';
import { quickBooksExportAudit, quickBooksHandoff } from '@/lib/books/quickbooks';
import { writeAudit } from '@/lib/books/persist';

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'manager']);
  if (auth instanceof NextResponse) return auth;
  if (!booksAccess(auth.role).quickBooks) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const shopId = shopIdForBooks(auth);
  if (!shopId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const month = new URL(request.url).searchParams.get('month');
  const books = await loadShopBooks(shopId, month);
  const labor = await loadShopLabor(shopId, month);
  const handoff = quickBooksHandoff({
    jobs: books.ledger.jobs,
    reversals: books.reversals,
    labor,
    tax: books.tickets.map((ticket) => ({ workOrderId: ticket.workOrderId, taxCents: ticket.taxCents })),
    map: books.qbMap,
    close: books.monthClose,
  });
  if (!handoff.ok) {
    return NextResponse.json({
      blocked: true,
      warnings: handoff.warnings,
      copy: handoff.copy,
      quickBooksOwnsBooks: handoff.ownsBooks,
    }, { status: 409 });
  }
  const at = new Date().toISOString();
  const audit = quickBooksExportAudit({
    actorId: auth.id,
    at,
    shopId,
    rowCount: handoff.csv.split('\n').filter((line) => line && !line.startsWith('#') && !line.startsWith('section')).length,
  });
  await writeAudit(audit);
  return new NextResponse(handoff.csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="fixtray-quickbooks.csv"',
      'X-FixTray-Books-Copy': handoff.copy,
    },
  });
}
