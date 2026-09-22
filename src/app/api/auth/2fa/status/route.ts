/**
 * GET /api/auth/2fa/status
 * Returns 2FA enabled status for the authenticated shop, manager, or tech.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { ACCOUNT_TWO_FACTOR_ROLES, readTwoFactorAccount } from '@/lib/twoFactorAccount';

export async function GET(request: NextRequest) {
  const auth = requireRole(request, [...ACCOUNT_TWO_FACTOR_ROLES]);
  if (auth instanceof NextResponse) return auth;

  try {
    const prisma = (await import('@/lib/prisma')).default;
    const account = await readTwoFactorAccount(prisma, auth);
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    return NextResponse.json({
      enabled: account.twoFactorEnabled ?? false,
      userId: auth.id,
      role: auth.role,
    });
  } catch (err) {
    console.error('2fa/status GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
