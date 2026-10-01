import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json(
    { error: 'Paid is recorded only after a Stripe charge.' },
    { status: 403 }
  );
}
