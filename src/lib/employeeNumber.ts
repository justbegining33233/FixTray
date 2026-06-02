import type { PrismaClient } from '@prisma/client';

const FIXTRAY_EMPLOYEE_MAX = 1000;
const NON_FIXTRAY_EMPLOYEE_MIN = 1001;
const EMPLOYEE_NUMBER_MAX = 999999;

function parseConfiguredFixTrayShopIds(): Set<string> {
  const raw = String(process.env.FIXTRAY_INTERNAL_SHOP_IDS || '').trim();
  if (!raw) return new Set();

  return new Set(
    raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

function toEmployeeNumberInt(value: string): number | null {
  const digitsOnly = String(value || '').trim().replace(/\D/g, '');
  if (!digitsOnly) return null;

  const parsed = Number.parseInt(digitsOnly, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  return parsed;
}

function randomIntInclusive(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function normalizeEmployeeNumber(value: string): string {
  const parsed = toEmployeeNumberInt(value);
  return parsed ? String(parsed) : '';
}

export async function isFixTrayShopId(prisma: PrismaClient, shopId: string): Promise<boolean> {
  if (!shopId) return false;

  const configured = parseConfiguredFixTrayShopIds();
  if (configured.has(shopId)) return true;

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { username: true, email: true, shopName: true },
  });

  if (!shop) return false;

  const username = String(shop.username || '').trim().toLowerCase();
  const email = String(shop.email || '').trim().toLowerCase();
  const shopName = String(shop.shopName || '').trim().toLowerCase();

  return username === 'fixtray' || email.endsWith('@fixtray.app') || shopName === 'fixtray';
}

export function employeeNumberInAllowedRange(employeeNumber: string, isFixTrayEmployee: boolean): boolean {
  const parsed = toEmployeeNumberInt(employeeNumber);
  if (!parsed) return false;

  if (parsed > EMPLOYEE_NUMBER_MAX) return false;

  if (isFixTrayEmployee) {
    return parsed >= 1 && parsed <= EMPLOYEE_NUMBER_MAX;
  }

  return parsed >= NON_FIXTRAY_EMPLOYEE_MIN && parsed <= EMPLOYEE_NUMBER_MAX;
}

export async function generateUniqueEmployeeNumber(prisma: PrismaClient, isFixTrayEmployee: boolean): Promise<string> {
  if (isFixTrayEmployee) {
    const existing = await prisma.tech.findMany({
      where: { employeeNumber: { not: null } },
      select: { employeeNumber: true },
    });

    const used = new Set<number>();
    for (const row of existing) {
      const parsed = toEmployeeNumberInt(row.employeeNumber || '');
      if (parsed && parsed >= 1 && parsed <= FIXTRAY_EMPLOYEE_MAX) {
        used.add(parsed);
      }
    }

    for (let candidate = 1; candidate <= FIXTRAY_EMPLOYEE_MAX; candidate += 1) {
      if (!used.has(candidate)) {
        return String(candidate);
      }
    }

    // After first 1000 are consumed, overflow into the shared upper range.
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const candidate = String(randomIntInclusive(NON_FIXTRAY_EMPLOYEE_MIN, EMPLOYEE_NUMBER_MAX));
      const exists = await prisma.tech.findUnique({
        where: { employeeNumber: candidate },
        select: { id: true },
      });

      if (!exists) return candidate;
    }

    throw new Error('Unable to allocate overflow employee number for FixTray range');
  }

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const candidate = String(randomIntInclusive(NON_FIXTRAY_EMPLOYEE_MIN, EMPLOYEE_NUMBER_MAX));
    const exists = await prisma.tech.findUnique({
      where: { employeeNumber: candidate },
      select: { id: true },
    });

    if (!exists) return candidate;
  }

  throw new Error('Unable to allocate employee number in non-FixTray range');
}
