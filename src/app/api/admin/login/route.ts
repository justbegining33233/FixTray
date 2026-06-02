import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { rateLimit, rateLimitConfigs } from '@/lib/rateLimit';
import { validateRequest } from '@/lib/validation';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { generateAccessToken } from '@/lib/auth';
import { isOwnerAdmin } from '@/lib/owner-access';

const adminLoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// POST - Admin login
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(rateLimitConfigs.auth)(request);
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    
    const validation = await validateRequest(adminLoginSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const { username, password } = validation.data;

    // Find admin
    const admin = await prisma.admin.findUnique({
      where: { username },
    });

    if (!admin) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify password
    const valid = await bcrypt.compare(password, admin.password);

    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const ownerAccess = isOwnerAdmin({ id: admin.id, username: admin.username });
    const token = generateAccessToken({
      id: admin.id,
      username: admin.username,
      role: 'admin',
      isSuperAdmin: admin.isSuperAdmin,
      isOwner: ownerAccess,
    });

    const response = NextResponse.json({
      token,
      accessToken: token,
      id: admin.id,
      username: admin.username,
      email: admin.email,
      isSuperAdmin: admin.isSuperAdmin,
      isOwner: ownerAccess,
      role: 'admin',
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        isSuperAdmin: admin.isSuperAdmin,
        isOwner: ownerAccess,
      },
    });

    response.cookies.set('sos_auth', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}


