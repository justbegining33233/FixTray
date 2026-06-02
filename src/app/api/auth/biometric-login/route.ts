import { NextRequest, NextResponse } from 'next/server';
import { generateAccessToken, generateRandomToken } from '@/lib/auth';
import { checkRateLimit, getClientIP } from '@/lib/rateLimit';

const BIOMETRIC_TOKEN_EXPIRY_DAYS = 30;

type BiometricMetadata = {
  userType: 'shop' | 'tech' | 'customer';
  deviceId?: string;
  deviceName?: string;
  biometryType?: string;
  registeredAt?: string;
  lastUsed?: string;
};

/**
 * POST /api/auth/biometric-login
 * Login using a previously registered biometric device token.
 * Body: { userId, deviceToken, deviceId?, biometryType? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, deviceToken, deviceId, biometryType } = body;

    if (!userId || !deviceToken) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Rate limiting — prevent brute-force against device tokens
    const clientIP = getClientIP(request);
    const rateLimitKey = `biometric_login:${clientIP}:${userId}`;
    const rateLimit = await checkRateLimit(rateLimitKey);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: rateLimit.message, retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000) },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)) } }
      );
    }

    const prisma = (await import('@/lib/prisma')).default;
    const bcryptMod = await import('bcrypt');
    const bcrypt = (bcryptMod.default ?? bcryptMod) as typeof import('bcrypt');

    // Find all valid biometric device tokens for this user
    const deviceTokenRecords = await prisma.verificationToken.findMany({
      where: {
        userId,
        type: 'biometric_device',
        expiresAt: { gt: new Date() },
      },
    });

    if (deviceTokenRecords.length === 0) {
      return NextResponse.json(
        { error: 'Biometric authentication not registered for this account' },
        { status: 403 }
      );
    }

    // Find the record whose hash matches the provided token
    let matchedRecord: typeof deviceTokenRecords[0] | null = null;
    for (const record of deviceTokenRecords) {
      if (await bcrypt.compare(deviceToken, record.tokenHash)) {
        matchedRecord = record;
        break;
      }
    }

    if (!matchedRecord) {
      return NextResponse.json({ error: 'Invalid biometric credentials' }, { status: 403 });
    }

    // Parse user type from stored metadata
    let metadata: BiometricMetadata = { userType: 'customer' };
    try {
      metadata = JSON.parse(matchedRecord.metadata || '{}') as BiometricMetadata;
    } catch {
      // default to customer if metadata is malformed
    }
    const userType = metadata.userType ?? 'customer';

    // Look up the user and build their access token
    let accessToken: string;
    let userPayload: Record<string, unknown>;

    if (userType === 'shop') {
      const shop = await prisma.shop.findUnique({
        where: { id: userId },
        select: { id: true, username: true, email: true, shopName: true, status: true },
      });
      if (!shop || shop.status !== 'approved') {
        return NextResponse.json({ error: 'Account not active' }, { status: 403 });
      }
      accessToken = generateAccessToken({ id: shop.id, shopId: shop.id, username: shop.username, role: 'shop' });
      userPayload = { id: shop.id, email: shop.email, username: shop.username, shopName: shop.shopName, role: 'shop' };
    } else if (userType === 'tech') {
      const tech = await prisma.tech.findUnique({
        where: { id: userId },
        select: { id: true, email: true, firstName: true, lastName: true, role: true, shopId: true },
      });
      if (!tech) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      accessToken = generateAccessToken({ id: tech.id, email: tech.email, role: tech.role, shopId: tech.shopId });
      userPayload = { id: tech.id, email: tech.email, name: `${tech.firstName} ${tech.lastName}`, role: tech.role, shopId: tech.shopId };
    } else {
      const customer = await prisma.customer.findUnique({
        where: { id: userId },
        select: { id: true, email: true, firstName: true, lastName: true },
      });
      if (!customer) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      accessToken = generateAccessToken({ id: customer.id, email: customer.email, role: 'customer' });
      userPayload = { id: customer.id, email: customer.email, name: `${customer.firstName} ${customer.lastName}`, role: 'customer' };
    }

    // Rolling expiry — extend the token window on each successful use
    const updatedMetadata: BiometricMetadata = {
      ...metadata,
      lastUsed: new Date().toISOString(),
      deviceId: deviceId ?? metadata.deviceId,
      biometryType: biometryType ?? metadata.biometryType,
    };
    await prisma.verificationToken.update({
      where: { id: matchedRecord.id },
      data: {
        expiresAt: new Date(Date.now() + BIOMETRIC_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
        metadata: JSON.stringify(updatedMetadata),
      },
    });

    return NextResponse.json({
      success: true,
      token: accessToken,
      accessToken,
      user: userPayload,
    });
  } catch (error) {
    console.error('Biometric login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/auth/biometric-login
 * Register a device for biometric login. Call this after a successful
 * password login to enable future biometric logins on this device.
 * Body: { userId, userType: 'shop'|'tech'|'customer', deviceId?, deviceName?, biometryType? }
 * Returns: { success, deviceToken, expiresAt }
 * The caller must store `deviceToken` securely on the device.
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, userType, deviceId, deviceName, biometryType } = body;

    if (!userId || !userType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!['shop', 'tech', 'customer'].includes(userType)) {
      return NextResponse.json({ error: 'Invalid user type' }, { status: 400 });
    }

    const prisma = (await import('@/lib/prisma')).default;
    const bcryptMod = await import('bcrypt');
    const bcrypt = (bcryptMod.default ?? bcryptMod) as typeof import('bcrypt');

    // Confirm the user actually exists before storing a token for them
    let userExists = false;
    if (userType === 'shop') {
      const shop = await prisma.shop.findUnique({ where: { id: userId }, select: { id: true, status: true } });
      userExists = !!shop && shop.status === 'approved';
    } else if (userType === 'tech') {
      const tech = await prisma.tech.findUnique({ where: { id: userId }, select: { id: true } });
      userExists = !!tech;
    } else {
      const customer = await prisma.customer.findUnique({ where: { id: userId }, select: { id: true } });
      userExists = !!customer;
    }

    if (!userExists) {
      return NextResponse.json({ error: 'User not found or account not active' }, { status: 404 });
    }

    // Remove any existing biometric tokens for this user before issuing a new one
    await prisma.verificationToken.deleteMany({
      where: { userId, type: 'biometric_device' },
    });

    const rawToken = generateRandomToken(48);
    const tokenHash = await bcrypt.hash(rawToken, 12);
    const expiresAt = new Date(Date.now() + BIOMETRIC_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const metadata: BiometricMetadata = {
      userType,
      deviceId: deviceId ?? 'unknown',
      deviceName: deviceName ?? 'Mobile Device',
      biometryType: biometryType ?? 'unknown',
      registeredAt: new Date().toISOString(),
    };

    await prisma.verificationToken.create({
      data: {
        userId,
        type: 'biometric_device',
        tokenHash,
        expiresAt,
        metadata: JSON.stringify(metadata),
      },
    });

    return NextResponse.json({ success: true, deviceToken: rawToken, expiresAt });
  } catch (error) {
    console.error('Biometric registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/auth/biometric-login?userId=<id>
 * Check whether a user has any active biometric devices registered.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const prisma = (await import('@/lib/prisma')).default;

    const deviceTokenRecords = await prisma.verificationToken.findMany({
      where: {
        userId,
        type: 'biometric_device',
        expiresAt: { gt: new Date() },
      },
      select: { metadata: true, createdAt: true, expiresAt: true },
    });

    const registeredDevices = deviceTokenRecords.map(record => {
      let meta: Partial<BiometricMetadata> = {};
      try { meta = JSON.parse(record.metadata || '{}'); } catch { /* ignore */ }
      return {
        deviceId: meta.deviceId ?? 'unknown',
        deviceName: meta.deviceName ?? 'Mobile Device',
        biometryType: meta.biometryType ?? 'unknown',
        lastUsed: meta.lastUsed ?? null,
        registeredAt: record.createdAt,
        expiresAt: record.expiresAt,
      };
    });

    return NextResponse.json({
      biometricEnabled: registeredDevices.length > 0,
      registeredDevices,
    });
  } catch (error) {
    console.error('Biometric status check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/auth/biometric-login?userId=<id>
 * Remove all biometric device registrations for a user.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const prisma = (await import('@/lib/prisma')).default;
    const { count } = await prisma.verificationToken.deleteMany({
      where: { userId, type: 'biometric_device' },
    });

    return NextResponse.json({ success: true, removed: count });
  } catch (error) {
    console.error('Biometric deregistration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}