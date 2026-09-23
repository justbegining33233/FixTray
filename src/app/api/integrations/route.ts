import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest, type AuthUser } from '@/lib/auth';
import { integrationWriteFromBody, normalizeIntegrationConfig } from '@/lib/integrationConfigShape';

function shopIdFromAuth(auth: AuthUser): string | undefined {
  return auth.role === 'shop' ? auth.id : auth.shopId;
}

// GET/POST integrations for a shop
export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const shopId = shopIdFromAuth(auth);
  if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 400 });
  const configs = await prisma.integrationConfig.findMany({ where: { shopId } });
  return NextResponse.json(configs.map((row) => normalizeIntegrationConfig(row)));
}

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const shopId = shopIdFromAuth(auth);
  if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 400 });
  const body = await req.json();
  const provider = typeof body?.provider === 'string' ? body.provider.trim() : '';
  if (!provider) return NextResponse.json({ error: 'Provider is required' }, { status: 400 });

  if (provider === 'stripe') {
    return NextResponse.json(
      { error: 'Stripe payouts use Connect. Start onboarding from shop integrations — do not paste secret keys.' },
      { status: 400 },
    );
  }

  const write = integrationWriteFromBody(body);
  const config = await prisma.integrationConfig.upsert({
    where: { shopId_provider: { shopId, provider } },
    update: {
      enabled: write.enabled,
      ...(write.settings !== undefined ? { settings: write.settings } : {}),
      ...(write.accountId !== undefined ? { accountId: write.accountId } : {}),
    },
    create: {
      shopId,
      provider,
      enabled: write.enabled,
      settings: write.settings ?? null,
      accountId: write.accountId ?? null,
    },
  });
  return NextResponse.json(normalizeIntegrationConfig(config), { status: 201 });
}
