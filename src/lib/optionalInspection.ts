/**
 * A digital vehicle inspection is optional and is offered before the tech
 * works the job. Skipping stores status "skipped". Doing it stores "done"
 * plus the tech's comment and pictures. Neither status is a pass or a fail,
 * and neither one changes the work order.
 */

import { buildEstimateSave, type QuoteLineInput } from './estimateAuthorization';
import { isChatImageUrl, resolveChatAttachment } from './messageAttachment';
import { shortWorkOrderLabel } from './notificationCopy';
import { workOrderDirectMessage, type DirectMessageInsert } from './workOrderMessagePersist';
import { workOrderIdMatches, workOrderIdSearchToken } from './workOrderSearch';

export const SKIPPED_INSPECTION_STATUS = 'skipped';
export const DONE_INSPECTION_STATUS = 'done';
export const FINDING_CONDITION = 'noted';

export type InspectionWrite = 'skip' | 'done' | 'leave' | 'template';

type WorkOrderRef = {
  vehicleType?: string | null;
  vehicle?: { year?: number | string | null; make?: string | null; model?: string | null } | null;
};

export function isSkipInspectionRequest(body: { skip?: unknown; status?: unknown }): boolean {
  if (body.skip === true || body.skip === 'true' || body.skip === 1 || body.skip === '1') return true;
  return String(body.status || '').trim().toLowerCase() === SKIPPED_INSPECTION_STATUS;
}

/** Match a typed WO- label or a raw id to one work order. Never keep the label as the id. */
export function resolveAttachedWorkOrderId(query: string | null | undefined, ids: string[]): string | null {
  const raw = String(query ?? '').trim();
  if (!raw) return null;
  const exact = ids.find((id) => id === raw);
  if (exact) return exact;
  const wanted = raw.toLowerCase();
  const byLabel = ids.filter((id) => shortWorkOrderLabel(id).toLowerCase() === wanted);
  if (byLabel.length === 1) return byLabel[0];
  const token = workOrderIdSearchToken(raw).toLowerCase();
  const bySuffix = ids.filter((id) => token.length > 0 && id.toLowerCase().endsWith(token));
  if (bySuffix.length === 1) return bySuffix[0];
  const matches = ids.filter((id) => workOrderIdMatches(id, raw));
  if (matches.length === 1) return matches[0];
  return null;
}

export function vehicleText(input: WorkOrderRef | null | undefined): string {
  const vehicle = input?.vehicle;
  const fromVehicle = [vehicle?.year, vehicle?.make, vehicle?.model]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ');
  if (fromVehicle) return fromVehicle;
  return String(input?.vehicleType || '').trim();
}

/**
 * Skip never overwrites an inspection the tech already did.
 * Doing the inspection after a skip replaces that skip.
 * A shop template with no comment and no pictures stays the old in-progress form.
 */
export function nextInspectionWrite(input: {
  intent: 'skip' | 'perform' | 'template';
  existingStatus?: string | null;
}): InspectionWrite {
  const existing = String(input.existingStatus || '').toLowerCase();
  if (input.intent === 'template') return 'template';
  if (input.intent === 'skip') {
    if (!existing || existing === 'in-progress') return 'skip';
    return 'leave';
  }
  return 'done';
}

export function inspectionStatusForWrite(write: 'skip' | 'done'): string {
  return write === 'skip' ? SKIPPED_INSPECTION_STATUS : DONE_INSPECTION_STATUS;
}

/** Skip does not change the job and does not record a pass or a fail. */
export function skipBlocksJob(): boolean {
  return false;
}

export function shopInspectionLabel(status: string | null | undefined): string {
  const value = String(status || '').toLowerCase();
  if (value === SKIPPED_INSPECTION_STATUS) return 'Skipped';
  if (value === DONE_INSPECTION_STATUS) return 'Done';
  if (value === 'sent') return 'Sent';
  if (value === 'approved') return 'Approved';
  if (!value || value === 'in-progress') return 'In progress';
  return value;
}

/** List status for /api/inspections. Skipped and done are not passed or failed. */
export function dviInspectionListStatus(status: string | null | undefined): string {
  const value = String(status || '').toLowerCase();
  if (value === SKIPPED_INSPECTION_STATUS) return 'skipped';
  if (value === DONE_INSPECTION_STATUS) return 'done';
  if (value === 'approved' || value === 'passed') return 'passed';
  if (value === 'declined' || value === 'failed' || value === 'rejected') return 'failed';
  return 'pending';
}

export function isOptionalInspectionRecord(status: string | null | undefined): boolean {
  const value = String(status || '').toLowerCase();
  return value === SKIPPED_INSPECTION_STATUS || value === DONE_INSPECTION_STATUS;
}

export function canAddLinesFromFindings(status: string | null | undefined): boolean {
  return String(status || '').toLowerCase() === DONE_INSPECTION_STATUS;
}

type ChecklistItem = {
  category?: string;
  itemName?: string;
  condition?: string;
  notes?: string;
  estimatedCost?: number | null;
};

/** Keep only items the tech actually marked. Untouched green rows are not a pass. */
export function checklistItemsToStore(items: ChecklistItem[]): ChecklistItem[] {
  return items.filter((item) => {
    const condition = String(item.condition || 'green').toLowerCase();
    const notes = String(item.notes || '').trim();
    return condition !== 'green' || notes.length > 0;
  });
}

export function pictureUrlsFromBody(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const urls: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const url = item.trim();
    if (!isChatImageUrl(url) || urls.includes(url)) continue;
    urls.push(url);
  }
  return urls;
}

export function picturesOnInspection(items: Array<{ photos?: string | null; condition?: string | null }>): string[] {
  const urls: string[] = [];
  for (const item of items) {
    const raw = String(item.photos || '').trim();
    if (!raw) continue;
    let parsed: unknown = null;
    if (raw.startsWith('[')) {
      try { parsed = JSON.parse(raw); } catch { parsed = null; }
    }
    const candidates = Array.isArray(parsed) ? parsed : [raw];
    for (const candidate of candidates) {
      if (typeof candidate !== 'string' || !isChatImageUrl(candidate) || urls.includes(candidate)) continue;
      urls.push(candidate);
    }
  }
  return urls;
}

export type InspectionCustomerPost = {
  body: string;
  attachmentUrl: string | null;
  attachmentType: string | null;
  mirror: DirectMessageInsert | null;
};

/** Comment and pictures for the work order's existing customer thread. */
export function inspectionCustomerMessage(input: {
  workOrderId: string;
  shopId: string;
  shopName?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  senderId: string;
  senderName: string;
  comment: string;
  pictureUrls: string[];
}): { ok: true; post: InspectionCustomerPost } | { ok: false; error: string } {
  const pictures = pictureUrlsFromBody(input.pictureUrls);
  const resolved = resolveChatAttachment({
    body: input.comment,
    attachmentUrls: pictures,
  });
  if (!resolved.ok) return { ok: false, error: resolved.error };
  const mirror = workOrderDirectMessage({
    workOrderId: input.workOrderId,
    shopId: input.shopId,
    shopName: input.shopName,
    customerId: input.customerId,
    customerName: input.customerName,
    senderRole: 'tech',
    senderId: input.senderId,
    senderName: input.senderName,
    body: resolved.value.body,
    attachmentUrl: resolved.value.attachmentUrl,
    attachmentType: resolved.value.attachmentType,
  });
  return {
    ok: true,
    post: {
      body: resolved.value.body,
      attachmentUrl: resolved.value.attachmentUrl,
      attachmentType: resolved.value.attachmentType,
      mirror,
    },
  };
}

export function quoteLinesFromEstimate(estimate: unknown): QuoteLineInput[] {
  if (!estimate || typeof estimate !== 'object') return [];
  const items = (estimate as { lineItems?: unknown }).lineItems;
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    const line = item as QuoteLineInput;
    return {
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      kind: line.kind,
      partNumber: line.partNumber,
    };
  });
}

/** Append a part or labor line onto the job's existing estimate. Does not set a service fee. */
export function estimateAfterAddedLine(estimate: unknown, line: QuoteLineInput) {
  const record = estimate && typeof estimate === 'object' ? estimate as Record<string, unknown> : {};
  const taxRate = Number(record.taxRate);
  const notes = typeof record.notes === 'string' ? record.notes : '';
  const saved = buildEstimateSave(
    [...quoteLinesFromEstimate(record), line],
    Number.isFinite(taxRate) && taxRate > 0 ? taxRate : 0,
    notes,
  );
  return {
    ...saved,
    estimate: {
      ...saved.estimate,
      ...(record.customerDecision !== undefined ? { customerDecision: record.customerDecision } : {}),
    },
  };
}
