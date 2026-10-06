import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { hashPassword, requireRole } from '@/lib/auth';
import { shopIdForBooks } from '@/lib/books/access';
import { sendEmail } from '@/lib/emailService';

export const dynamic = 'force-dynamic';

/** Shop owner invites a read-only accountant for this shop only. */
export async function POST(request: NextRequest) {
  const auth = requireRole(request, ['shop']);
  if (auth instanceof NextResponse) return auth;
  const shopId = shopIdForBooks(auth);
  if (!shopId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => null);
  const email = String(body?.email || '').trim().toLowerCase();
  const name = String(body?.name || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter the accountant email' }, { status: 400 });
  }
  const temporaryPassword = crypto.randomBytes(9).toString('base64url');
  const password = await hashPassword(temporaryPassword);
  const row = await prisma.shopAccountant.upsert({
    where: { shopId_email: { shopId, email } },
    update: { name, password, status: 'active' },
    create: { shopId, email, name, password, status: 'active' },
  });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fixtray.app';
  await sendEmail({
    to: email,
    subject: 'FixTray accountant access',
    html: `<p>You have read-only access to one shop's books on FixTray.</p><p>Sign in at ${appUrl}/auth/login with this email.</p><p>Temporary password: ${temporaryPassword}</p>`,
    shopId,
  }).catch(() => false);
  return NextResponse.json({
    id: row.id,
    email: row.email,
    shopId,
    temporaryPassword,
    login: 'The accountant signs in with this email on the staff login. They only see this shop\'s books.',
  }, { status: 201 });
}
