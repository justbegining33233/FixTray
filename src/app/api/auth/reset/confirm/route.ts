import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashTokenSha256 } from '@/lib/verification';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const identifier = body.identifier; // username or email
    const rawToken = body.token;
    const newPassword = body.password;
    const type = body.type || 'password_reset';

    if (!identifier || !rawToken || !newPassword) return NextResponse.json({ error: 'Invalid' }, { status: 400 });
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const tokenHash = hashTokenSha256(rawToken);

    // Find matching token
    const rec = await prisma.verificationToken.findFirst({ where: { tokenHash, type } });
    if (!rec || rec.expiresAt.getTime() < Date.now()) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });

    // Resolve user
    let userModel: 'admin'|'shop'|'customer'|'tech'|null = null;
    let user: any = null;
    user = await prisma.admin.findUnique({ where: { username: identifier } }); if (user) userModel = 'admin';
    if (!user) { user = await prisma.shop.findUnique({ where: { username: identifier } }); if (user) userModel = 'shop'; }
    if (!user) { user = await prisma.customer.findUnique({ where: { email: identifier } }); if (user) userModel = 'customer'; }
    if (!user) { user = await prisma.tech.findUnique({ where: { email: identifier } }); if (user) userModel = 'tech'; }

    if (!user || user.id !== rec.userId) return NextResponse.json({ error: 'Invalid token' }, { status: 400 });

    // Update password — Prisma middleware will hash the password
    if (userModel === 'admin') {
      await prisma.admin.update({ where: { id: user.id }, data: { password: newPassword } });
    } else if (userModel === 'shop') {
      await prisma.shop.update({ where: { id: user.id }, data: { password: newPassword } });
    } else if (userModel === 'customer') {
      await prisma.customer.update({ where: { id: user.id }, data: { password: newPassword } });
    } else if (userModel === 'tech') {
      await prisma.tech.update({ where: { id: user.id }, data: { password: newPassword } });
    }

    // HIGH FIX #9: Invalidate all existing sessions on password change
    // This forces the user to log in again with new password
    const metadata = { 
      adminId: userModel === 'admin' ? user.id : null,
    };
    const jsonString = JSON.stringify(metadata);
    
    // Delete all refresh tokens for this user (search by metadata if available)
    await prisma.refreshToken.deleteMany({
      where: { 
        metadata: { 
          contains: `"${userModel === 'admin' ? 'adminId' : userModel}":"${user.id}"`
        }
      }
    }).catch(() => {
      // If metadata search fails, try alternative approach
      return prisma.refreshToken.deleteMany({
        where: { 
          OR: [
            { metadata: { contains: userModel === 'admin' ? `"${user.id}"` : `"${user.id}"` } }
          ]
        }
      });
    });

    console.log(`[SECURITY] Session invalidation: All tokens cleared for ${userModel}:${user.id} due to password reset`);

    // Delete token record
    await prisma.verificationToken.delete({ where: { id: rec.id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Reset confirm error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
