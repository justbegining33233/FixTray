import { NextRequest, NextResponse } from 'next/server';

// Legacy endpoint retained for compatibility.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    if (!body?.deviceId) {
      return NextResponse.json({ error: 'deviceId is required' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Device unenrollment accepted by compatibility endpoint.',
    });
  } catch (error) {
    console.error('MDM unenroll compatibility error:', error);
    return NextResponse.json({ error: 'Failed to unenroll device' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');
    if (!deviceId) {
      return NextResponse.json({ error: 'deviceId is required' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Device unenrollment accepted by compatibility endpoint.',
    });
  } catch (error) {
    console.error('MDM unenroll compatibility delete error:', error);
    return NextResponse.json({ error: 'Failed to unenroll device' }, { status: 500 });
  }
}
