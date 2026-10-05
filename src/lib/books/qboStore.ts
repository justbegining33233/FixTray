import prisma from '@/lib/prisma';
import { ensureProductionColumns } from '@/lib/ensureProductionColumns';
import { qbAccounts, type QbMap } from '@/lib/books/quickbooks';

const PROVIDER = 'quickbooks';

export interface QboConnection {
  connected: boolean;
  realmId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiry: Date | null;
  settings: Record<string, unknown>;
  map: QbMap;
  mapSaved: boolean;
  posted: Record<string, string>;
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
}

function parseSettings(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
  return {};
}

function postedMap(settings: Record<string, unknown>): Record<string, string> {
  const raw = settings.qboPosted;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const posted: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string' && value) posted[key] = value;
  }
  return posted;
}

export function mapFromSettings(settings: Record<string, unknown>): { map: QbMap; mapSaved: boolean } {
  const saved = settings.qbMapSaved === true;
  const raw = settings.qbMap;
  if (!saved || !raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { map: qbAccounts(null), mapSaved: false };
  }
  return { map: qbAccounts(raw as Record<string, unknown>), mapSaved: true };
}

export async function readQboConnection(shopId: string): Promise<QboConnection> {
  await ensureProductionColumns();
  const row = await prisma.integrationConfig.findUnique({
    where: { shopId_provider: { shopId, provider: PROVIDER } },
  });
  const settings = parseSettings(row?.settings);
  const { map, mapSaved } = mapFromSettings(settings);
  const realmId = row?.accountId?.trim() || null;
  return {
    connected: Boolean(row?.accessToken && realmId),
    realmId,
    accessToken: row?.accessToken || null,
    refreshToken: row?.refreshToken || null,
    tokenExpiry: row?.tokenExpiry || null,
    settings,
    map,
    mapSaved,
    posted: postedMap(settings),
    lastSyncAt: row?.lastSyncAt || null,
    lastSyncStatus: row?.lastSyncStatus || null,
  };
}

async function writeConnection(shopId: string, input: {
  settings: Record<string, unknown>;
  enabled?: boolean;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiry?: Date | null;
  accountId?: string | null;
  lastSyncAt?: Date | null;
  lastSyncStatus?: string | null;
}): Promise<void> {
  await ensureProductionColumns();
  const settings = JSON.stringify(input.settings);
  const data = {
    ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
    ...(input.accessToken !== undefined ? { accessToken: input.accessToken } : {}),
    ...(input.refreshToken !== undefined ? { refreshToken: input.refreshToken } : {}),
    ...(input.tokenExpiry !== undefined ? { tokenExpiry: input.tokenExpiry } : {}),
    ...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
    ...(input.lastSyncAt !== undefined ? { lastSyncAt: input.lastSyncAt } : {}),
    ...(input.lastSyncStatus !== undefined ? { lastSyncStatus: input.lastSyncStatus } : {}),
    settings,
  };
  const existing = await prisma.integrationConfig.findUnique({
    where: { shopId_provider: { shopId, provider: PROVIDER } },
    select: { id: true },
  });
  if (existing) {
    await prisma.integrationConfig.update({
      where: { shopId_provider: { shopId, provider: PROVIDER } },
      data,
    });
    return;
  }
  await prisma.integrationConfig.create({
    data: {
      shopId,
      provider: PROVIDER,
      enabled: input.enabled ?? false,
      accessToken: input.accessToken ?? null,
      refreshToken: input.refreshToken ?? null,
      tokenExpiry: input.tokenExpiry ?? null,
      accountId: input.accountId ?? null,
      lastSyncAt: input.lastSyncAt ?? null,
      lastSyncStatus: input.lastSyncStatus ?? null,
      settings,
    },
  });
}

export async function saveQboTokens(input: {
  shopId: string;
  realmId: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}): Promise<void> {
  const current = await readQboConnection(input.shopId);
  const settings = { ...current.settings };
  delete settings.clientId;
  delete settings.clientSecret;
  delete settings.realmId;
  await writeConnection(input.shopId, {
    settings,
    enabled: true,
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    tokenExpiry: new Date(Date.now() + Math.max(60, input.expiresIn - 60) * 1000),
    accountId: input.realmId,
  });
}

export async function saveQboAccountMap(shopId: string, map: QbMap): Promise<void> {
  const current = await readQboConnection(shopId);
  const settings: Record<string, unknown> = {
    ...current.settings,
    qbMap: map,
    qbMapSaved: true,
  };
  delete settings.clientId;
  delete settings.clientSecret;
  await writeConnection(shopId, { settings, enabled: current.connected ? true : undefined });
}

export async function saveQboSyncResult(shopId: string, input: {
  posted: Record<string, string>;
  status: string;
  syncedAt: Date;
}): Promise<void> {
  const current = await readQboConnection(shopId);
  const settings = {
    ...current.settings,
    qboPosted: { ...current.posted, ...input.posted },
  };
  await writeConnection(shopId, {
    settings,
    lastSyncAt: input.syncedAt,
    lastSyncStatus: input.status,
  });
}
