import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { logActivity } from '@/lib/activityLogger';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const { status } = await request.json();

    // Validate status
    const validStatuses = ['pending', 'approved', 'suspended'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be one of: pending, approved, suspended' },
        { status: 400 }
      );
    }

    // Check if shop exists
    const existingShop = await prisma.shop.findUnique({
      where: { id }
    });

    if (!existingShop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    // Update shop status
    const updatedShop = await prisma.shop.update({
      where: { id },
      data: {
        status,
        ...(status === 'approved' && !existingShop.approvedAt ? { approvedAt: new Date() } : {})
      }
    });

    // Fire-and-forget audit log for the status change
    const actionMap: Record<string, string> = { approved: 'shop_approved', suspended: 'shop_suspended', pending: 'shop_pending' };
    logActivity(
      actionMap[status] ?? 'settings_updated',
      (auth as any).username ?? (auth as any).id ?? 'admin',
      `Shop "${existingShop.shopName}" status changed from "${existingShop.status}" to "${status}"`,
      { type: 'shop', shopId: id, severity: status === 'approved' ? 'success' : status === 'suspended' ? 'warning' : 'info' }
    );

    return NextResponse.json({
      message: `Shop status updated to ${status}`,
      shop: {
        id: updatedShop.id,
        shopName: updatedShop.shopName,
        status: updatedShop.status
      }
    });
  } catch (error) {
    console.error('Error updating shop status:', error);
    return NextResponse.json(
      { error: 'Failed to update shop status' },
      { status: 500 }
    );
  }
}
