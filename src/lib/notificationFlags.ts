/**
 * A flag marks that something happened and a person should look.
 * Acknowledging a flag never approves, denies, or advances a work order.
 */

export const ATTENTION_FLAG_LABEL = 'Needs a look';

export type AttentionEvent = 'estimate-denied';

export interface AttentionFlag {
  flagged: true;
  audience: 'staff';
  event: AttentionEvent;
  flagLabel: string;
  shopId: string;
  assignedTechId: string | null;
  acknowledged: boolean;
  acknowledgedAt?: string;
}

export interface FlagViewer {
  id: string;
  role: string;
  shopId?: string | null;
}

const FLAG_KEYS = ['flagged', 'audience', 'event', 'flagLabel', 'shopId', 'assignedTechId', 'acknowledged', 'acknowledgedAt'] as const;

export function staffShopId(viewer: FlagViewer): string | null {
  if (viewer.role === 'shop') return viewer.id || null;
  if (viewer.role === 'manager' || viewer.role === 'tech') return viewer.shopId || null;
  return null;
}

/** Customer denied the estimate. The flag is a marker only. */
export function estimateDeniedFlag(input: { shopId: string; assignedTechId?: string | null }): AttentionFlag {
  return {
    flagged: true,
    audience: 'staff',
    event: 'estimate-denied',
    flagLabel: ATTENTION_FLAG_LABEL,
    shopId: input.shopId,
    assignedTechId: input.assignedTechId || null,
    acknowledged: false,
  };
}

export function serializeAttentionFlag(flag: AttentionFlag): string {
  return JSON.stringify(flag);
}

export function parseAttentionFlag(metadata: unknown): AttentionFlag | null {
  if (typeof metadata !== 'string' || !metadata.trim()) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(metadata);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const rec = parsed as Record<string, unknown>;
  if (rec.flagged !== true) return null;
  if (rec.audience !== 'staff') return null;
  if (rec.event !== 'estimate-denied') return null;
  if (typeof rec.shopId !== 'string' || !rec.shopId) return null;
  const assigned = rec.assignedTechId;
  if (assigned != null && typeof assigned !== 'string') return null;
  return {
    flagged: true,
    audience: 'staff',
    event: 'estimate-denied',
    flagLabel: typeof rec.flagLabel === 'string' && rec.flagLabel ? rec.flagLabel : ATTENTION_FLAG_LABEL,
    shopId: rec.shopId,
    assignedTechId: typeof assigned === 'string' ? assigned : null,
    acknowledged: rec.acknowledged === true,
    ...(typeof rec.acknowledgedAt === 'string' ? { acknowledgedAt: rec.acknowledgedAt } : {}),
  };
}

/**
 * Shop and manager see every open flag for their shop.
 * The assigned technician sees the flag for their job.
 * An unassigned denial stays with the shop and manager until a person assigns it.
 */
export function flagVisibleTo(flag: AttentionFlag, viewer: FlagViewer): boolean {
  if (!flag.flagged || flag.acknowledged) return false;
  const shopId = staffShopId(viewer);
  if (!shopId || flag.shopId !== shopId) return false;
  if (viewer.role === 'shop' || viewer.role === 'manager') return true;
  if (viewer.role === 'tech') return Boolean(flag.assignedTechId) && flag.assignedTechId === viewer.id;
  return false;
}

export function isStaffAttentionMetadata(metadata: unknown): boolean {
  return typeof metadata === 'string' && metadata.includes('"audience":"staff"');
}

/**
 * Mark the flag as looked at. workOrderUpdate is always null so a caller
 * cannot treat acknowledgement as a status change.
 */
export function acknowledgeAttentionFlag(metadata: string, at = new Date()): {
  metadata: string;
  read: true;
  workOrderUpdate: null;
} | null {
  const flag = parseAttentionFlag(metadata);
  if (!flag) return null;
  const next: AttentionFlag = {
    ...flag,
    acknowledged: true,
    acknowledgedAt: at.toISOString(),
  };
  const serialized = serializeAttentionFlag(next);
  const parsed = JSON.parse(serialized) as Record<string, unknown>;
  for (const key of Object.keys(parsed)) {
    if (!FLAG_KEYS.includes(key as typeof FLAG_KEYS[number])) {
      delete parsed[key];
    }
  }
  return {
    metadata: JSON.stringify(parsed),
    read: true,
    workOrderUpdate: null,
  };
}
