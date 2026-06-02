import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ') || '-';
  return { firstName, lastName };
}

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    if (auth.role === 'customer') {
      const customer = await prisma.customer.findUnique({
        where: { id: auth.id },
        select: { id: true, email: true, firstName: true, lastName: true, phone: true },
      });
      if (!customer) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
      return NextResponse.json({
        id: customer.id,
        role: auth.role,
        email: customer.email,
        name: `${customer.firstName} ${customer.lastName}`.trim(),
        phone: customer.phone || '',
      });
    }

    if (auth.role === 'shop') {
      const shop = await prisma.shop.findUnique({
        where: { id: auth.id },
        select: { id: true, email: true, ownerName: true, phone: true, shopName: true },
      });
      if (!shop) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
      return NextResponse.json({
        id: shop.id,
        role: auth.role,
        email: shop.email,
        name: shop.ownerName || shop.shopName,
        phone: shop.phone || '',
      });
    }

    if (auth.role === 'tech' || auth.role === 'manager') {
      const tech = await prisma.tech.findUnique({
        where: { id: auth.id },
        select: { id: true, email: true, firstName: true, lastName: true, phone: true, role: true },
      });
      if (!tech) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
      return NextResponse.json({
        id: tech.id,
        role: tech.role,
        email: tech.email,
        name: `${tech.firstName} ${tech.lastName}`.trim(),
        phone: tech.phone || '',
      });
    }

    const admin = await prisma.admin.findUnique({
      where: { id: auth.id },
      select: { id: true, email: true, username: true, isSuperAdmin: true },
    });
    if (!admin) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    return NextResponse.json({
      id: admin.id,
      role: 'superadmin',
      email: admin.email,
      name: admin.username,
      phone: '',
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json().catch(() => ({}));
    const name = String(body?.name || '').trim();
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';

    if (auth.role === 'customer') {
      const { firstName, lastName } = splitName(name || 'Customer');
      const customer = await prisma.customer.update({
        where: { id: auth.id },
        data: { firstName, lastName, phone },
        select: { id: true, email: true, firstName: true, lastName: true, phone: true },
      });
      return NextResponse.json({
        id: customer.id,
        role: auth.role,
        email: customer.email,
        name: `${customer.firstName} ${customer.lastName}`.trim(),
        phone: customer.phone || '',
      });
    }

    if (auth.role === 'shop') {
      const shop = await prisma.shop.update({
        where: { id: auth.id },
        data: { ownerName: name || undefined, phone: phone || undefined },
        select: { id: true, email: true, ownerName: true, shopName: true, phone: true },
      });
      return NextResponse.json({
        id: shop.id,
        role: auth.role,
        email: shop.email,
        name: shop.ownerName || shop.shopName,
        phone: shop.phone || '',
      });
    }

    if (auth.role === 'tech' || auth.role === 'manager') {
      const { firstName, lastName } = splitName(name || auth.role);
      const tech = await prisma.tech.update({
        where: { id: auth.id },
        data: { firstName, lastName, phone: phone || undefined },
        select: { id: true, email: true, firstName: true, lastName: true, phone: true, role: true },
      });
      return NextResponse.json({
        id: tech.id,
        role: tech.role,
        email: tech.email,
        name: `${tech.firstName} ${tech.lastName}`.trim(),
        phone: tech.phone || '',
      });
    }

    const admin = await prisma.admin.update({
      where: { id: auth.id },
      data: { username: name || undefined },
      select: { id: true, email: true, username: true, isSuperAdmin: true },
    });

    return NextResponse.json({
      id: admin.id,
      role: 'superadmin',
      email: admin.email,
      name: admin.username,
      phone: '',
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
