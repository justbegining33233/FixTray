import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

/** Shop-plan columns stay in the database but are no longer written. */
const TENANT_PLAN_FIELDS = new Set([
  'plan',
  'planStatus',
  'planStartDate',
  'planRenewalDate',
  'maxUsers',
  'maxWorkOrders',
]);

function withoutPlanFields(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([key]) => !TENANT_PLAN_FIELDS.has(key))
  );
}

export async function getAllTenants() {
  return prisma.tenant.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function getTenantById(id: string) {
  return prisma.tenant.findUnique({ where: { id } });
}

export async function getTenantBySubdomain(subdomain: string) {
  return prisma.tenant.findUnique({ where: { subdomain } });
}

export async function createTenant(data: {
  companyName: string;
  subdomain: string;
  contactEmail: string;
  contactPhone: string;
  logo?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  timezone?: string;
  currency?: string;
}) {
  return prisma.tenant.create({
    data: withoutPlanFields(data) as Prisma.TenantUncheckedCreateInput,
  });
}

export async function updateTenant(id: string, updates: Record<string, unknown>) {
  return prisma.tenant.update({
    where: { id },
    data: withoutPlanFields(updates) as Prisma.TenantUpdateInput,
  });
}

export async function deleteTenant(id: string) {
  await prisma.tenant.delete({ where: { id } });
  return true;
}
