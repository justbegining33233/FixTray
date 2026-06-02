import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole, hashPassword } from '@/lib/auth';
import { logAdminAction } from '@/lib/auditLog';

export async function POST(request: NextRequest) {
  const auth = requireRole(request, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { userId, userType, newPassword } = await request.json();

    if (!userId || !userType || !newPassword) {
      return NextResponse.json({ error: 'userId, userType, and newPassword are required' }, { status: 400 });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const hashedPassword = await hashPassword(newPassword);

    switch (userType) {
      case 'customer': {
        const user = await prisma.customer.findUnique({ where: { id: userId } });
        if (!user) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        await prisma.customer.update({ where: { id: userId }, data: { password: hashedPassword } });
        break;
      }
      case 'tech':
      case 'manager': {
        const user = await prisma.tech.findUnique({ where: { id: userId } });
        if (!user) return NextResponse.json({ error: 'Tech/Manager not found' }, { status: 404 });
        await prisma.tech.update({ where: { id: userId }, data: { password: hashedPassword } });
        break;
      }
      case 'shop': {
        const user = await prisma.shop.findUnique({ where: { id: userId } });
        if (!user) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
        await prisma.shop.update({ where: { id: userId }, data: { password: hashedPassword } });
        break;
      }
      case 'admin': {
        const user = await prisma.admin.findUnique({ where: { id: userId } });
        if (!user) return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
        await prisma.admin.update({ where: { id: userId }, data: { password: hashedPassword } });
        break;
      }
      default:
        return NextResponse.json({ error: 'Invalid userType. Must be: customer, tech, manager, shop, or admin' }, { status: 400 });
    }

    logAdminAction(auth.id, 'password_reset', `Reset password for ${userType} ${userId}`).catch(() => {});

    return NextResponse.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Error resetting password:', error);
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}
