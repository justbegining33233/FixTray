import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { validateCsrf } from '@/lib/csrf';

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    let sessions = await prisma.refreshToken.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const parseMeta = (raw: string | null) => {
      if (!raw) return {} as { customerId?: string; shopId?: string; techId?: string };
      try {
        return JSON.parse(raw) as { customerId?: string; shopId?: string; techId?: string };
      } catch {
        return {} as { customerId?: string; shopId?: string; techId?: string };
      }
    };

    // Self-heal older data: keep only the newest active session per user identity.
    const seenOwnerKeys = new Set<string>();
    const duplicateActiveIds: string[] = [];
    for (const session of sessions) {
      if (session.revoked || session.expiresAt <= now) continue;

      const meta = parseMeta(session.metadata ?? null);
      const ownerKey = session.adminId
        ? `admin:${session.adminId}`
        : meta.customerId
        ? `customer:${meta.customerId}`
        : meta.shopId
        ? `shop:${meta.shopId}`
        : meta.techId
        ? `tech:${meta.techId}`
        : null;

      if (!ownerKey) continue;
      if (seenOwnerKeys.has(ownerKey)) {
        duplicateActiveIds.push(session.id);
      } else {
        seenOwnerKeys.add(ownerKey);
      }
    }

    if (duplicateActiveIds.length > 0) {
      await prisma.refreshToken.updateMany({
        where: { id: { in: duplicateActiveIds } },
        data: { revoked: true, revokedAt: now },
      });

      sessions = await prisma.refreshToken.findMany({
        orderBy: { createdAt: 'desc' },
      });
    }

    const [admins, activityLogs] = await Promise.all([
      prisma.admin.findMany({
        select: {
          id: true,
          username: true,
          email: true,
          isSuperAdmin: true,
          createdAt: true,
        },
      }),
      prisma.activityLog.findMany({
        where: {
          type: 'user',
          createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
        },
        select: {
          email: true,
          user: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const activeAdminSessionIds = new Set(
      sessions
        .filter((s) => !s.revoked && Boolean(s.adminId) && s.expiresAt > now)
        .map((s) => s.adminId as string)
    );

    const lastActivityByEmail = new Map<string, Date>();
    const lastActivityByUsername = new Map<string, Date>();
    for (const log of activityLogs) {
      if (log.email) {
        const key = log.email.trim().toLowerCase();
        if (!lastActivityByEmail.has(key)) {
          lastActivityByEmail.set(key, log.createdAt);
        }
      }

      if (log.user) {
        const key = log.user.trim().toLowerCase();
        if (!lastActivityByUsername.has(key)) {
          lastActivityByUsername.set(key, log.createdAt);
        }
      }
    }

    const out = sessions.map((s: any) => ({
      id: s.id,
      adminId: s.adminId,
      metadata: s.metadata ? parseMeta(s.metadata) : null,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      revoked: Boolean(s.revoked),
      isActive: !s.revoked && s.expiresAt > now,
    }));

    const adminPresence = admins.map((admin) => {
      const emailKey = admin.email.trim().toLowerCase();
      const usernameKey = admin.username.trim().toLowerCase();
      const lastActivityAt =
        lastActivityByEmail.get(emailKey) ||
        lastActivityByUsername.get(usernameKey) ||
        null;

      const currentlyOn = activeAdminSessionIds.has(admin.id);
      const activeLast24h = !currentlyOn && !!lastActivityAt && lastActivityAt >= last24h;
      const inactive48hPlus = !currentlyOn && (!lastActivityAt || lastActivityAt <= last48h);

      return {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        isSuperAdmin: admin.isSuperAdmin,
        currentlyOn,
        activeLast24h,
        inactive48hPlus,
        lastActivityAt: lastActivityAt ? lastActivityAt.toISOString() : null,
        lastActivityAgeMinutes: lastActivityAt
          ? Math.max(0, Math.floor((now.getTime() - lastActivityAt.getTime()) / (1000 * 60)))
          : null,
        createdAt: admin.createdAt.toISOString(),
      };
    });

    const buckets = {
      currentlyOn: adminPresence.filter((a) => a.currentlyOn),
      activeLast24h: adminPresence.filter((a) => a.activeLast24h),
      inactive48hPlus: adminPresence.filter((a) => a.inactive48hPlus),
    };

    return NextResponse.json({ sessions: out, adminPresence, buckets });
  } catch (err) {
    console.error('Sessions list error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = requireRole(request, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;

  try {
    // CSRF protection
    const ok = await validateCsrf(request);
    if (!ok) return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });

    const body = await request.json();
    const id = body?.id;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    await prisma.refreshToken.delete({ where: { id } }).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Sessions delete error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
