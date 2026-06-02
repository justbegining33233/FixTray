type SessionOwner =
  | { adminId: string; customerId?: never; shopId?: never; techId?: never }
  | { adminId?: never; customerId: string; shopId?: never; techId?: never }
  | { adminId?: never; customerId?: never; shopId: string; techId?: never }
  | { adminId?: never; customerId?: never; shopId?: never; techId: string };

type PrismaLike = {
  refreshToken: {
    updateMany: (args: {
      where: {
        revoked: boolean;
        expiresAt: { gt: Date };
        adminId?: string;
        metadata?: { contains: string };
      };
      data: { revoked: boolean; revokedAt: Date };
    }) => Promise<unknown>;
  };
};

function metadataNeedle(key: 'customerId' | 'shopId' | 'techId', id: string): string {
  return `"${key}":"${id}"`;
}

export async function enforceSingleActiveSession(prisma: PrismaLike, owner: SessionOwner): Promise<void> {
  const now = new Date();
  const revokeData = { revoked: true, revokedAt: now };

  if (typeof owner.adminId === 'string') {
    await prisma.refreshToken.updateMany({
      where: {
        adminId: owner.adminId,
        revoked: false,
        expiresAt: { gt: now },
      },
      data: revokeData,
    });
    return;
  }

  if (typeof owner.customerId === 'string') {
    const customerId = owner.customerId;
    await prisma.refreshToken.updateMany({
      where: {
        metadata: { contains: metadataNeedle('customerId', customerId) },
        revoked: false,
        expiresAt: { gt: now },
      },
      data: revokeData,
    });
    return;
  }

  if (typeof owner.shopId === 'string') {
    const shopId = owner.shopId;
    await prisma.refreshToken.updateMany({
      where: {
        metadata: { contains: metadataNeedle('shopId', shopId) },
        revoked: false,
        expiresAt: { gt: now },
      },
      data: revokeData,
    });
    return;
  }

  const techId = owner.techId;
  await prisma.refreshToken.updateMany({
    where: {
      metadata: { contains: metadataNeedle('techId', techId) },
      revoked: false,
      expiresAt: { gt: now },
    },
    data: revokeData,
  });
}