import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';

// Compatibility endpoint for legacy bulk push payloads.
export async function POST(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'manager', 'admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json().catch(() => ({}));
    const userIds = Array.isArray(body.userIds) ? body.userIds : [];

    return NextResponse.json({
      success: true,
      accepted: userIds.length,
      message: 'Bulk request accepted by compatibility endpoint.',
    });
  } catch (error) {
    console.error('Bulk push compatibility error:', error);
    return NextResponse.json({ error: 'Failed to process bulk push request' }, { status: 500 });
  }
}
