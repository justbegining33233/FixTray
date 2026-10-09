import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import { ensureProductionColumns } from '@/lib/ensureProductionColumns';

const KEYS = new Set([
  'welcome',
  'shop-approved',
  'shop-denied',
  'workorder-created',
  'workorder-assigned',
  'workorder-completed',
  'payment-received',
  'password-reset',
]);

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'Only the platform owner can read email templates.' }, { status: 403 });
  }
  const key = request.nextUrl.searchParams.get('key') || '';
  if (!KEYS.has(key)) return NextResponse.json({ error: 'Unknown template.' }, { status: 400 });
  await ensureProductionColumns();
  const rows = await prisma.$queryRawUnsafe<Array<{ key: string; subject: string; body: string }>>(
    'SELECT "key", "subject", "body" FROM "email_templates" WHERE "key" = $1',
    key,
  );
  return NextResponse.json({ template: rows[0] || null });
}

export async function PUT(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'Only the platform owner can save email templates.' }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const key = typeof body.key === 'string' ? body.key : '';
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const text = typeof body.body === 'string' ? body.body.trim() : '';
  if (!KEYS.has(key) || !subject || !text) {
    return NextResponse.json({ error: 'Choose a template and enter a subject and body.' }, { status: 400 });
  }
  await ensureProductionColumns();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "email_templates" ("key", "subject", "body", "updatedAt")
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
     ON CONFLICT ("key") DO UPDATE SET "subject" = EXCLUDED."subject", "body" = EXCLUDED."body", "updatedAt" = CURRENT_TIMESTAMP`,
    key,
    subject,
    text,
  );
  return NextResponse.json({ ok: true, key });
}
