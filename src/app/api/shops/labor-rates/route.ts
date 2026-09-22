import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import type { AuthUser } from '@/lib/auth';
import { z } from 'zod';

// GET - Public: returns labor rates for a shop (used by customers during booking)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shopId');

    if (!shopId) {
      return NextResponse.json({ error: 'Shop ID is required' }, { status: 400 });
    }

    const laborRates = await prisma.shopLaborRate.findMany({
      where: { shopId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(laborRates);
  } catch (error) {
    console.error('Error fetching labor rates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'manager', 'admin']);
  if (auth instanceof NextResponse) return auth;
  const user = auth as AuthUser;

  try {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const schema = z.object({
      shopId: z.string().min(1),
      name: z.string().min(1),
      rate: z.union([z.string(), z.number()]),
      category: z.string().min(1),
    });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const { shopId, name, rate, category } = parsed.data;

    // Shop-role users may only create rates for their own shop
    if (user.role === 'shop' && user.shopId !== shopId && user.id !== shopId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const numericRate = typeof rate === 'number' ? rate : parseFloat(rate as string);
    if (!Number.isFinite(numericRate)) {
      return NextResponse.json({ error: 'Invalid rate value' }, { status: 400 });
    }

    const laborRate = await prisma.shopLaborRate.create({
      data: { shopId, name, rate: numericRate, category },
    });

    return NextResponse.json(laborRate, { status: 201 });
  } catch (error) {
    console.error('Error creating labor rate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'manager', 'admin']);
  if (auth instanceof NextResponse) return auth;
  const user = auth as AuthUser;

  try {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const schema = z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      rate: z.union([z.string(), z.number()]),
      category: z.string().min(1),
    });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const { id, name, rate, category } = parsed.data;

    // Verify ownership before mutating
    const existing = await prisma.shopLaborRate.findUnique({ where: { id }, select: { shopId: true } });
    if (!existing) return NextResponse.json({ error: 'Labor rate not found' }, { status: 404 });
    if (user.role === 'shop' && user.shopId !== existing.shopId && user.id !== existing.shopId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const numericRate = typeof rate === 'number' ? rate : parseFloat(rate as string);
    if (!Number.isFinite(numericRate)) {
      return NextResponse.json({ error: 'Invalid rate value' }, { status: 400 });
    }

    const laborRate = await prisma.shopLaborRate.update({
      where: { id },
      data: { name, rate: numericRate, category },
    });

    return NextResponse.json(laborRate);
  } catch (error) {
    console.error('Error updating labor rate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'manager', 'admin']);
  if (auth instanceof NextResponse) return auth;
  const user = auth as AuthUser;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Labor rate ID is required' }, { status: 400 });
    }

    // Verify ownership before deleting
    const existing = await prisma.shopLaborRate.findUnique({ where: { id }, select: { shopId: true } });
    if (!existing) return NextResponse.json({ error: 'Labor rate not found' }, { status: 404 });
    if (user.role === 'shop' && user.shopId !== existing.shopId && user.id !== existing.shopId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.shopLaborRate.delete({ where: { id } });

    return NextResponse.json({ message: 'Labor rate deleted successfully' });
  } catch (error) {
    console.error('Error deleting labor rate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}