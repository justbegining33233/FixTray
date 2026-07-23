import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import logger from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  let id = '';
  try {
    id = (await params).id;
    const { url, type, caption } = await request.json();

    // Validate photo URL — only allow Cloudinary and HTTPS URLs
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Photo URL is required' }, { status: 400 });
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') {
        return NextResponse.json({ error: 'Only HTTPS URLs are allowed' }, { status: 400 });
      }
      if (!parsed.hostname.endsWith('res.cloudinary.com') && !parsed.hostname.endsWith('cloudinary.com')) {
        return NextResponse.json({ error: 'Only Cloudinary URLs are allowed' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    const workOrder = await prisma.workOrder.findUnique({ where: { id } });
    if (!workOrder) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
    }

    // Sanitize caption
    const safeCaption = caption ? String(caption).slice(0, 500) : '';
    const safeType = ['photo', 'before', 'after', 'damage', 'receipt'].includes(type) ? type : 'photo';

    const photo = {
      id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      url,
      type: safeType,
      uploadedAt: new Date().toISOString(),
      uploadedBy: auth.role,
      caption: safeCaption,
    };

    // Use transaction to ensure atomicity - read-modify-write within transaction
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.workOrder.findUnique({ where: { id } });
      if (!current) throw new Error('Work order not found');

      const existingPhotos = (current.workPhotos as unknown[] || []);
      const workPhotos = [...existingPhotos, photo];
      
      return tx.workOrder.update({
        where: { id },
        data: { workPhotos: workPhotos as any },
      });
    });

    return NextResponse.json(updated);
  } catch (error) {
    logger.error('Error uploading photo', {
      error: error instanceof Error ? error.message : String(error),
      workOrderId: id
    });
    return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 });
  }
}
