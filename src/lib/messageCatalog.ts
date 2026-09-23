import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SAFE_CODE = /^[a-z]{2,3}$/;

let englishCache: Record<string, unknown> | null = null;

/** Read one catalog from disk. Missing or half-written files return null. */
export function readLocaleCatalog(locale: string): Record<string, unknown> | null {
  if (!SAFE_CODE.test(locale)) return null;
  const file = join(process.cwd(), 'messages', `${locale}.json`);
  try {
    if (!existsSync(file)) return null;
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function englishCatalog(): Record<string, unknown> {
  if (englishCache) return englishCache;
  englishCache = readLocaleCatalog('en') ?? {};
  return englishCache;
}
