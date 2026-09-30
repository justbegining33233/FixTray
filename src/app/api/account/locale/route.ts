import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { writePreferredLocale } from '@/lib/chatTranslationStore';
import { isSupportedLocaleInput, normalizeLocale } from '@/lib/locale';

/** Remember the signed-in account's language so a later message can be translated while they are offline. */
export async function POST(request: NextRequest) {
  const user = authenticateRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let locale: unknown;
  try {
    const body = await request.json();
    locale = body?.locale;
  } catch {
    return NextResponse.json({ error: 'Invalid locale' }, { status: 400 });
  }
  if (!isSupportedLocaleInput(locale)) {
    return NextResponse.json({ error: 'Invalid locale' }, { status: 400 });
  }

  const saved = normalizeLocale(locale);
  const ok = await writePreferredLocale(user.role, user.id, saved);
  if (!ok) return NextResponse.json({ error: 'Could not save language' }, { status: 400 });
  return NextResponse.json({ locale: saved });
}
