import { NextRequest, NextResponse } from 'next/server';


export async function POST(_request: NextRequest) {
  try {
      return NextResponse.json({ error: 'deprecated - use /api/auth/reset/request and /api/auth/reset/confirm' }, { status: 410 });
  } catch (err: unknown) {
    logger.error('Password reset error', err);
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}
