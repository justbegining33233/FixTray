import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import crypto from 'crypto';

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function generateApiKey(): string {
  const random = crypto.randomBytes(32).toString('hex');
  return `ft_live_${random}`;
}

// GET /api/api-keys ΓÇö list API keys for the shop
export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const shopId = (auth.role === 'superadmin')
    ? new URL(request.url).searchParams.get('shopId') || ''
    : auth.id;

  if (!shopId) {
    return NextResponse.json({ error: 'shopId required' }, { status: 400 });
  }

  try {
    const keys = await prisma.apiKey.findMany({
      where: { shopId, revoked: false },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ keys });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json({ error: 'Failed to fetch keys' }, { status: 500 });
  }
}

// POST /api/api-keys ΓÇö create a new API key
export async function POST(request: NextRequest) {
  const auth = requireRole(request, ['shop']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { name, scopes, expiresInDays } = await request.json();
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Limit to 10 active keys per shop
    const activeCount = await prisma.apiKey.count({ where: { shopId: auth.id, revoked: false } });
    if (activeCount >= 10) {
      return NextResponse.json({ error: 'Maximum 10 active API keys per shop' }, { status: 400 });
    }

    const rawKey = generateApiKey();
    const keyHash = hashKey(rawKey);
    const prefix = rawKey.substring(0, 16);

    const key = await prisma.apiKey.create({
      data: {
        shopId: auth.id,
        name,
        keyHash,
        prefix,
        scopes: scopes || 'read',
        expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null,
      },
    });

    // Return the raw key only once ΓÇö it cannot be retrieved later
    return NextResponse.json({
      id: key.id,
      name: key.name,
      key: rawKey,
      prefix: key.prefix,
      scopes: key.scopes,
      expiresAt: key.expiresAt,
      message: 'Save this key securely ΓÇö it will not be shown again.',
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating API key:', error);
    return NextResponse.json({ error: 'Failed to create key' }, { status: 500 });
  }
}

// DELETE /api/api-keys?id=xxx ΓÇö revoke an API key
export async function DELETE(request: NextRequest) {
  const auth = requireRole(request, ['shop', 'admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const keyId = new URL(request.url).searchParams.get('id');
    if (!keyId) {
      return NextResponse.json({ error: 'Key id required' }, { status: 400 });
    }

    const key = await prisma.apiKey.findUnique({ where: { id: keyId } });
    if (!key) {
      return NextResponse.json({ error: 'Key not found' }, { status: 404 });
    }

    // Verify ownership
    if (auth.role !== 'superadmin' && key.shopId !== auth.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.apiKey.update({
      where: { id: keyId },
      data: { revoked: true, revokedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error revoking API key:', error);
    return NextResponse.json({ error: 'Failed to revoke key' }, { status: 500 });
  }
}
