import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

// PATCH /api/reviews/[id] - Shop responds to a review
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded || !['shop', 'manager'].includes(decoded.role)) {
      return NextResponse.json({ error: 'Shop account required' }, { status: 403 });
    }

    const { response } = await request.json();
    if (!response || typeof response !== 'string' || response.trim().length === 0) {
      return NextResponse.json({ error: 'Response text is required' }, { status: 400 });
    }
    if (response.length > 1000) {
      return NextResponse.json({ error: 'Response must be 1000 characters or fewer' }, { status: 400 });
    }

    // Verify the review belongs to this shop
    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 });

    const shopId = decoded.role === 'shop' ? decoded.id : decoded.shopId;
    if (review.shopId !== shopId) {
      return NextResponse.json({ error: 'Not authorized to respond to this review' }, { status: 403 });
    }

    const updated = await prisma.review.update({
      where: { id },
      // shopResponse/shopResponseAt exist in schema — cast avoids stale TS cache mismatch
      data: {
        shopResponse: response.trim(),
        shopResponseAt: new Date(),
      } as Parameters<typeof prisma.review.update>[0]['data'],
    });

    return NextResponse.json({ review: updated });
  } catch (error) {
    console.error('Error responding to review:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/reviews/[id] - Delete shop response
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded || !['shop', 'manager', 'admin'].includes(decoded.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 });

    if (decoded.role !== 'superadmin') {
      const shopId = decoded.role === 'shop' ? decoded.id : decoded.shopId;
      if (review.shopId !== shopId) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
    }

    const updated = await prisma.review.update({
      where: { id },
      data: { shopResponse: null, shopResponseAt: null } as Parameters<typeof prisma.review.update>[0]['data'],
    });

    return NextResponse.json({ review: updated });
  } catch (error) {
    console.error('Error deleting review response:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
