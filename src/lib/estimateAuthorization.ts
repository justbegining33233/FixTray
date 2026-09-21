/**
 * Quote → customer signature → work authorization.
 * A work authorization exists only after the customer accepts and signs.
 * Submitting an estimate, or denying it, does not create one.
 */

export type EstimateLineKind = 'part' | 'labor' | 'misc';

export interface QuoteLineInput {
  description?: string;
  quantity?: number;
  unitPrice?: number;
  total?: number;
  kind?: string;
  partNumber?: string;
}

export interface NormalizedQuoteLine {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  kind: EstimateLineKind;
  partNumber?: string;
}

export const SIGNED_AUTHORIZATION_STATUS = 'signed';

export const MANUAL_AUTHORIZATION_BLOCKED_MESSAGE =
  'Work authorizations are created only after the customer accepts the estimate and signs. Creating one without that signature is not allowed.';

const MIN_SIGNATURE_LENGTH = 80;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function normalizeKind(kind: string | undefined): EstimateLineKind {
  if (kind === 'part' || kind === 'labor' || kind === 'misc') return kind;
  return 'labor';
}

export function normalizeQuoteLines(lines: QuoteLineInput[]): NormalizedQuoteLine[] {
  return lines.map((line) => {
    const quantity = Number(line.quantity);
    const unitPrice = Number(line.unitPrice);
    const safeQty = Number.isFinite(quantity) && quantity >= 0 ? quantity : 0;
    const safePrice = Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0;
    const partNumber = String(line.partNumber || '').trim();
    return {
      description: String(line.description || '').trim(),
      quantity: safeQty,
      unitPrice: safePrice,
      total: round2(safeQty * safePrice),
      kind: normalizeKind(line.kind),
      ...(partNumber ? { partNumber } : {}),
    };
  });
}

export function buildEstimateSave(lines: QuoteLineInput[], taxRate = 0, notes = '') {
  const normalized = normalizeQuoteLines(lines);
  const subtotal = round2(normalized.reduce((sum, line) => sum + line.total, 0));
  const rate = Number.isFinite(Number(taxRate)) && Number(taxRate) > 0 ? Number(taxRate) : 0;
  const tax = round2(subtotal * (rate / 100));
  const total = round2(subtotal + tax);

  return {
    estimatedCost: total,
    estimate: {
      lineItems: normalized,
      subtotal,
      taxRate: rate,
      tax,
      total,
      notes,
    },
    techLabor: normalized
      .filter((line) => line.kind === 'labor')
      .map((line) => ({
        description: line.description || 'Labor',
        hours: line.quantity,
        rate: line.unitPrice,
      })),
    partsUsed: normalized
      .filter((line) => line.kind === 'part')
      .map((line) => ({
        name: line.description || 'Part',
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        ...(line.partNumber ? { sku: line.partNumber } : {}),
      })),
  };
}

/** Shop/manager lists show signed authorizations. A pending row is not a real authorization. */
export function isVisibleWorkAuthorization(status: string | null | undefined): boolean {
  return String(status || '').toLowerCase() === SIGNED_AUTHORIZATION_STATUS;
}

/** Staff cannot create an authorization that skips the customer signature. */
export function manualAuthorizationCreateAllowed(): false {
  return false;
}

/** Submitting a quote never inserts a work authorization. */
export function authorizationCreatedOnEstimateSubmit(): null {
  return null;
}

export interface SignatureInput {
  signatureData?: unknown;
  signerName?: unknown;
}

export type SignatureResult =
  | { ok: true; signatureData: string; signerName: string }
  | { ok: false; error: string };

export function validateCustomerSignature(input: SignatureInput): SignatureResult {
  const signerName = typeof input.signerName === 'string' ? input.signerName.trim() : '';
  const signatureData = typeof input.signatureData === 'string' ? input.signatureData.trim() : '';

  if (signerName.length < 2 || signerName.length > 200) {
    return { ok: false, error: 'Enter your full name to sign.' };
  }

  if (!signatureData.startsWith('data:image/') || signatureData.length < MIN_SIGNATURE_LENGTH) {
    return { ok: false, error: 'A signature is required. Verbal approval is not a work authorization.' };
  }

  return { ok: true, signatureData, signerName };
}

export type CustomerDecision =
  | {
      ok: true;
      response: 'accepted';
      woStatus: 'in-progress';
      createAuthorization: true;
      authStatus: 'signed';
      signatureData: string;
      signerName: string;
    }
  | {
      ok: true;
      response: 'denied';
      woStatus: 'denied-estimate';
      createAuthorization: false;
      signatureData: string;
      signerName: string;
    }
  | { ok: false; error: string };

export function customerEstimateDecision(response: unknown, input: SignatureInput): CustomerDecision {
  if (response !== 'accepted' && response !== 'denied') {
    return { ok: false, error: 'Invalid response. Must be "accepted" or "denied".' };
  }

  const signature = validateCustomerSignature(input);
  if (!signature.ok) return signature;

  if (response === 'denied') {
    return {
      ok: true,
      response: 'denied',
      woStatus: 'denied-estimate',
      createAuthorization: false,
      signatureData: signature.signatureData,
      signerName: signature.signerName,
    };
  }

  return {
    ok: true,
    response: 'accepted',
    woStatus: 'in-progress',
    createAuthorization: true,
    authStatus: 'signed',
    signatureData: signature.signatureData,
    signerName: signature.signerName,
  };
}
