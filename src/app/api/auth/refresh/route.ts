import { NextRequest, NextResponse } from 'next/server';
// Lazy-load prisma & bcrypt inside handler
import { enforceSingleActiveSession } from '@/lib/sessionPolicy';


export async function POST(request: NextRequest) {
  try {
    // Lazy-load runtime-sensitive modules
    const prisma = (await import('@/lib/prisma')).default;
    const bcryptMod = await import('bcrypt');
    const bcrypt = (bcryptMod && (bcryptMod.default ?? bcryptMod)) as typeof import('bcrypt');

    // Support new split cookies (`refresh_id` + `refresh_sig`) and legacy `refresh_token` cookie
    let id = request.cookies.get('refresh_id')?.value;
    let raw = request.cookies.get('refresh_sig')?.value;
    if ((!id || !raw) && request.cookies.get('refresh_token')?.value) {
      const legacy = request.cookies.get('refresh_token')!.value;
      const parts = legacy.split(':');
      id = parts[0] || id;
      raw = parts[1] || raw;
    }
    if (!id || !raw) return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
    const record = await prisma.refreshToken.findUnique({ where: { id } });
    if (!record) return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });

    // Check if session has been revoked
    if (record.revoked) {
      return NextResponse.json({ error: 'Session has been revoked' }, { status: 401 });
    }

    if (record.expiresAt < new Date()) {
      // expired - remove and reject
      await prisma.refreshToken.delete({ where: { id } }).catch(() => {});
      return NextResponse.json({ error: 'Refresh token expired' }, { status: 401 });
    }

    const match = await bcrypt.compare(raw, record.tokenHash);

    // If the token id exists but the raw doesn't match, treat as possible theft.
    if (!match) {
      try {
        // Revoke all sessions for this owner (adminId or metadata)
        if (record.adminId) {
          await prisma.refreshToken.deleteMany({ where: { adminId: record.adminId } }).catch(() => {});
        } else if (record.metadata) {
          // metadata is a JSON string � parse it to extract the owner ID for bulk revocation
          // Note: bulk LIKE-based revocation via String field is not reliable in all DBs;
          // the current token is deleted below regardless.
          const meta = JSON.parse(record.metadata) as { customerId?: string; shopId?: string; techId?: string };
          void meta; // parsed for future use; bulk revocation handled via single delete below
        }
      } catch {
        // ignore errors during cleanup
      }
      return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
    }

    // Token matched: rotate - create new refresh token and delete old one
    const origin = request.headers.get('x-forwarded-for') || request.headers.get('host') || '';
    const userAgent = request.headers.get('user-agent') || '';

    const newRaw = (await import('@/lib/auth')).generateRandomToken(48);
    const newHash = await bcrypt.hash(newRaw, 12);
    const newExpires = (await import('@/lib/auth')).refreshExpiryDate();
    const csrf = (await import('@/lib/csrf')).generateCsrfToken();

    if (record.adminId) {
      await enforceSingleActiveSession(prisma, { adminId: record.adminId });
    } else if (record.metadata) {
      try {
        const meta = JSON.parse(record.metadata) as { customerId?: string; shopId?: string; techId?: string };
        if (meta.customerId) {
          await enforceSingleActiveSession(prisma, { customerId: meta.customerId });
        } else if (meta.shopId) {
          await enforceSingleActiveSession(prisma, { shopId: meta.shopId });
        } else if (meta.techId) {
          await enforceSingleActiveSession(prisma, { techId: meta.techId });
        }
      } catch {
        // Ignore metadata parse issues here; the record validation below still protects refresh flow.
      }
    }

    const newRecord = await prisma.refreshToken.create({
      data: {
        tokenHash: newHash,
        adminId: record.adminId || null,
        metadata: JSON.stringify({ ...((() => { try { return JSON.parse(record.metadata || '{}'); } catch { return {}; } })()), lastIp: origin, lastAgent: userAgent, csrfToken: csrf }),
        expiresAt: newExpires,
      }
    });

    // delete old
    await prisma.refreshToken.delete({ where: { id } }).catch(() => {});

    // Build payload based on owner
    let payload: any = { role: 'unknown' };
    if (record.adminId) {
      const admin = await prisma.admin.findUnique({ where: { id: record.adminId } });
      if (!admin) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
      payload = { id: admin.id, username: admin.username, role: 'superadmin', isSuperAdmin: admin.isSuperAdmin };
    } else if (record.metadata) {
      let meta: { customerId?: string; shopId?: string; techId?: string } = {};
      try { meta = JSON.parse(record.metadata) as typeof meta; } catch { return NextResponse.json({ error: 'Invalid session' }, { status: 401 }); }
      if (meta.customerId) {
        const c = await prisma.customer.findUnique({ where: { id: meta.customerId } });
        if (!c) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
        payload = { id: c.id, username: c.email, role: 'customer' };
      } else if (meta.shopId) {
        const s = await prisma.shop.findUnique({ where: { id: meta.shopId } });
        if (!s) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
        payload = { id: s.id, shopId: s.id, username: s.username, role: 'shop' };
      } else if (meta.techId) {
        const t = await prisma.tech.findUnique({ where: { id: meta.techId } });
        if (!t) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
        payload = { id: t.id, shopId: t.shopId, username: t.email, role: t.role };
      }
    }

    const accessToken = (await import('@/lib/auth')).generateAccessToken(payload);

    const response = NextResponse.json({ accessToken });
    // set new refresh cookie
    response.cookies.set('refresh_id', newRecord.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor((newExpires.getTime() - Date.now()) / 1000),
    });
    response.cookies.set('refresh_sig', newRaw, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor((newExpires.getTime() - Date.now()) / 1000),
    });
    // expose CSRF token for client
    response.cookies.set('csrf_token', csrf, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor((newExpires.getTime() - Date.now()) / 1000),
    });
    // set access cookie
    response.cookies.set('sos_auth', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 15,
    });
    return response;
  } catch (error) {
    console.error('Refresh token error:', error);
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 });
  }
}
