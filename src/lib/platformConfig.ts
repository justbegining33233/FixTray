import prisma from './prisma';
import { ensureProductionColumns } from './ensureProductionColumns';
import { normalizeLocale, type AppLocale } from './locale';

type PlatformConfigRow = Awaited<ReturnType<typeof prisma.platformConfig.findUnique>>;

let cache: { at: number; value: PlatformConfigRow } | null = null;
const TTL_MS = 30_000;

export function invalidatePlatformConfigCache() {
  cache = null;
}

export async function getPlatformConfig(): Promise<PlatformConfigRow> {
  if (!process.env.DATABASE_URL) return null;
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;

  try {
    await ensureProductionColumns();
    const value = await prisma.platformConfig.findUnique({ where: { id: 'global' } });
    cache = { at: Date.now(), value };
    return value;
  } catch (error) {
    console.error(
      'Failed to read platform config:',
      error instanceof Error ? error.message : 'unknown error',
    );
    return cache?.value ?? null;
  }
}

export async function readPlatformDefaultLocale(): Promise<AppLocale> {
  const config = await getPlatformConfig();
  return normalizeLocale(config?.defaultLanguage);
}
