import prisma from '@/lib/prisma';

function normalizeServiceName(value: string): string {
  return value.trim().toLowerCase();
}

export function extractServiceNames(value: unknown): string[] {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return [];
}

export async function findUnconfiguredShopServices(shopId: string, requestedServices: string[]) {
  const requestedUnique = Array.from(
    new Set(
      requestedServices
        .map((service) => service.trim())
        .filter((service) => service.length > 0)
    )
  );

  if (requestedUnique.length === 0) {
    return {
      hasConfiguredServices: true,
      invalidServices: [] as string[],
    };
  }

  const configuredServices = await prisma.shopService.findMany({
    where: { shopId },
    select: { serviceName: true },
  });

  if (configuredServices.length === 0) {
    return {
      hasConfiguredServices: false,
      invalidServices: requestedUnique,
    };
  }

  const configuredSet = new Set(
    configuredServices
      .map((service) => normalizeServiceName(service.serviceName))
      .filter((name) => name.length > 0)
  );

  const invalidServices = requestedUnique.filter(
    (service) => !configuredSet.has(normalizeServiceName(service))
  );

  return {
    hasConfiguredServices: true,
    invalidServices,
  };
}
