/**
 * GET /api/auth/verify-email?token=<raw>
 * Called when a user clicks the verification link in their welcome email.
 * Validates the token, marks the customer's email as verified, and redirects
 * to the login page with a success flag.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashTokenSha256 } from '@/lib/verification';
import logger from '@/lib/logger';

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fixtray.app';
  const { searchParams } = new URL(request.url);
  const rawToken = searchParams.get('token');

  if (!rawToken) {
    return NextResponse.redirect(`${appUrl}/auth/login?verified=invalid`);
  }

  try {
    const tokenHash = hashTokenSha256(rawToken);

    const record = await prisma.verificationToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.type !== 'email_verify') {
      return NextResponse.redirect(`${appUrl}/auth/login?verified=invalid`);
    }

    if (record.expiresAt < new Date()) {
      await prisma.verificationToken.delete({ where: { tokenHash } }).catch(() => {});
      return NextResponse.redirect(`${appUrl}/auth/login?verified=expired`);
    }

    // Mark customer email as verified
    await prisma.customer.update({
      where: { id: record.userId },
      data: { emailVerified: true, emailVerifiedAt: new Date() },
    });

    // Clean up the used token
    await prisma.verificationToken.delete({ where: { tokenHash } }).catch(() => {});

    return NextResponse.redirect(`${appUrl}/auth/login?verified=1`);
  } catch (err) {
    logger.error('[verify-email] error', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.redirect(`${appUrl}/auth/login?verified=error`);
  }
}
