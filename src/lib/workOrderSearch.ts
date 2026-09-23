/**
 * Work-order ids are cuids. The UI shows them as WO- plus the last 8
 * characters (WO-YT5NU73K) and sometimes as WO- plus the first 8.
 * Search must match those labels, the raw id, and either letter case.
 */

const WO_LABEL = /^wo[-_\s#]*/i;

export function workOrderIdSearchToken(query: string): string {
  const trimmed = query.trim();
  const stripped = trimmed.replace(WO_LABEL, '').trim();
  return stripped || trimmed;
}

export function workOrderIdMatches(id: string, query: string): boolean {
  const haystack = id.trim().toLowerCase();
  if (!haystack) return false;
  const raw = query.trim().toLowerCase();
  const token = workOrderIdSearchToken(query).toLowerCase();
  if (token && haystack.includes(token)) return true;
  return Boolean(raw) && haystack.includes(raw);
}

type InsensitiveContains = { contains: string; mode: 'insensitive' };

function contains(value: string): InsensitiveContains {
  return { contains: value, mode: 'insensitive' };
}

/** Prisma filter for id suffix/prefix, WO- labels, description, and vehicle text. */
export function workOrderTextMatch(query: string): { OR: Array<Record<string, unknown>> } {
  const q = query.trim();
  const token = workOrderIdSearchToken(q);
  const ors: Array<Record<string, unknown>> = [
    { id: contains(token) },
    { issueDescription: contains(q) },
    { vehicleType: contains(q) },
  ];
  if (token.toLowerCase() !== q.toLowerCase()) {
    ors.push({ id: contains(q) });
    ors.push({ issueDescription: contains(token) });
    ors.push({ vehicleType: contains(token) });
  }
  return { OR: ors };
}

/**
 * Techs must still find work orders assigned to them when the token shop id
 * is missing or points at a different shop than the job.
 */
export function workOrderSearchScope(actor: {
  role: string;
  id: string;
  shopId?: string | null;
}): Record<string, unknown> | null {
  if (actor.role === 'tech') {
    const branches: Array<Record<string, unknown>> = [];
    if (actor.shopId) branches.push({ shopId: actor.shopId });
    if (actor.id) branches.push({ assignedTechId: actor.id });
    if (branches.length === 0) return null;
    return branches.length === 1 ? branches[0] : { OR: branches };
  }
  return null;
}
