import { NextRequest, NextResponse } from 'next/server';
import { requireRole, type AuthUser } from '@/lib/auth';
import { booksAccess, shopIdForBooks } from '@/lib/books/access';

export function requireQuickBooksOwner(request: NextRequest): NextResponse | { auth: AuthUser; shopId: string } {
  const auth = requireRole(request, ['shop']);
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== 'shop' || !booksAccess(auth.role).quickBooksConnect) {
    return NextResponse.json({ error: 'Only the shop owner can connect QuickBooks Online' }, { status: 403 });
  }
  const shopId = shopIdForBooks(auth);
  if (!shopId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return { auth, shopId };
}
