import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole, hashPassword } from '@/lib/auth';

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || 'Team',
    lastName: parts.slice(1).join(' ') || 'Member',
  };
}

// Legacy endpoint retained for backward compatibility.
// Prefer /api/techs for team-member creation.
export async function POST(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'manager', 'admin']);
  if (auth instanceof NextResponse) {
    return NextResponse.json({ error: 'Use /api/customers/register or /api/shops/register for public registration' }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const role = String(body.role || 'tech');

    if (!email || !password) {
      return NextResponse.json({ error: 'email and password are required' }, { status: 400 });
    }

    const shopId = auth.role === 'shop' ? auth.id : auth.shopId;
    if (!shopId) {
      return NextResponse.json({ error: 'Shop context required' }, { status: 400 });
    }

    const existing = await prisma.tech.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }

    const name = String(body.name || '').trim();
    const firstName = String(body.firstName || '').trim();
    const lastName = String(body.lastName || '').trim();
    const fallback = splitName(name || email.split('@')[0]);

    const tech = await prisma.tech.create({
      data: {
        shopId,
        email,
        password: await hashPassword(password),
        firstName: firstName || fallback.firstName,
        lastName: lastName || fallback.lastName,
        phone: body.phone || null,
        role,
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });

    return NextResponse.json(tech, { status: 201 });
  } catch (error) {
    console.error('Legacy auth/register error:', error);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
