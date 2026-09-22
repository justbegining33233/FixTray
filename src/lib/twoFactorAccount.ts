export const ACCOUNT_TWO_FACTOR_ROLES = ['shop', 'manager', 'tech'] as const;

type TwoFactorRow = {
  id: string;
  email?: string | null;
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
};

type TwoFactorTable = {
  findUnique(args: { where: { id: string }; select: Record<string, boolean> }): Promise<unknown>;
  update(args: { where: { id: string }; data: { twoFactorEnabled?: boolean; twoFactorSecret?: string | null } }): Promise<unknown>;
};

type TwoFactorClient = {
  shop: TwoFactorTable;
  tech: TwoFactorTable;
};

function tableFor(role: string): 'shop' | 'tech' | null {
  if (role === 'shop') return 'shop';
  if (role === 'manager' || role === 'tech') return 'tech';
  return null;
}

export async function readTwoFactorAccount(
  prisma: TwoFactorClient,
  auth: { id: string; role: string },
): Promise<TwoFactorRow | null> {
  const table = tableFor(auth.role);
  if (!table) return null;
  const row = await prisma[table].findUnique({
    where: { id: auth.id },
    select: { id: true, email: true, twoFactorEnabled: true, twoFactorSecret: true },
  });
  return (row as TwoFactorRow | null) ?? null;
}

export async function writeTwoFactorAccount(
  prisma: TwoFactorClient,
  auth: { id: string; role: string },
  data: { twoFactorEnabled?: boolean; twoFactorSecret?: string | null },
) {
  const table = tableFor(auth.role);
  if (!table) return null;
  return prisma[table].update({ where: { id: auth.id }, data });
}
