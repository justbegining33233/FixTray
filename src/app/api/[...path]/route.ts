import { NextResponse } from 'next/server';

function missing() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export const GET = missing;
export const POST = missing;
export const PUT = missing;
export const PATCH = missing;
export const DELETE = missing;
export const OPTIONS = missing;
