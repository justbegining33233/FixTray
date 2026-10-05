import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { isPlatformEmailAccount } from '@/lib/platformEmailAccess';

/** The visits view uses the same login rule as the Emails page. */
export function requireVisitViewer(request: NextRequest) {
  const auth = requireRole(request, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;
  if (!isPlatformEmailAccount(auth.username)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return auth;
}
