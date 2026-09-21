import { describe, it, expect } from '@jest/globals';
import { workOrderUpdateSchema } from '../src/lib/validationSchemas';
import {
  authorizationCreatedOnEstimateSubmit,
  buildEstimateSave,
  customerEstimateDecision,
  isVisibleWorkAuthorization,
  manualAuthorizationCreateAllowed,
  MANUAL_AUTHORIZATION_BLOCKED_MESSAGE,
} from '../src/lib/estimateAuthorization';
import { closeoutTransition } from '../src/lib/workOrderCloseout';

const signature = {
  signerName: 'Ada Customer',
  signatureData: `data:image/png;base64,${'a'.repeat(120)}`,
};

describe('estimate authorization sequencing', () => {
  it('does not create a work authorization when an estimate is submitted', () => {
    expect(authorizationCreatedOnEstimateSubmit()).toBeNull();
  });

  it('hides unsigned pending authorizations from the shop and manager lists', () => {
    expect(isVisibleWorkAuthorization('pending')).toBe(false);
    expect(isVisibleWorkAuthorization('declined')).toBe(false);
    expect(isVisibleWorkAuthorization('signed')).toBe(true);
  });

  it('blocks staff from creating an authorization without a customer signature', () => {
    expect(manualAuthorizationCreateAllowed()).toBe(false);
    expect(MANUAL_AUTHORIZATION_BLOCKED_MESSAGE).toMatch(/signature/i);
  });

  it('rejects accept and deny when there is no signature', () => {
    expect(customerEstimateDecision('accepted', { signerName: 'Ada' }).ok).toBe(false);
    expect(customerEstimateDecision('denied', {}).ok).toBe(false);
    expect(customerEstimateDecision('accepted', { signerName: 'A', signatureData: signature.signatureData }).ok).toBe(false);
  });

  it('creates a signed authorization only when the customer accepts and signs', () => {
    const decision = customerEstimateDecision('accepted', signature);
    expect(decision).toMatchObject({
      ok: true,
      response: 'accepted',
      woStatus: 'in-progress',
      createAuthorization: true,
      authStatus: 'signed',
    });
  });

  it('closes a denied quote and does not create an authorization', () => {
    const decision = customerEstimateDecision('denied', signature);
    expect(decision).toMatchObject({
      ok: true,
      response: 'denied',
      woStatus: 'denied-estimate',
      createAuthorization: false,
    });
  });
});

describe('parts and labor estimate lines', () => {
  it('saves part and labor lines and keeps kind through the work-order update schema', () => {
    const payload = buildEstimateSave([
      { description: 'Oil filter', quantity: 1, unitPrice: 8, kind: 'part', partNumber: 'OF-1' },
      { description: 'Diagnostic labor', quantity: 1, unitPrice: 40, kind: 'labor' },
    ], 0, 'Audit');

    expect(payload.partsUsed).toEqual([
      { name: 'Oil filter', quantity: 1, unitPrice: 8, sku: 'OF-1' },
    ]);
    expect(payload.techLabor).toEqual([
      { description: 'Diagnostic labor', hours: 1, rate: 40 },
    ]);
    expect(payload.estimatedCost).toBe(48);

    const parsed = workOrderUpdateSchema.parse(payload);
    expect(parsed.estimate?.lineItems?.[0]).toMatchObject({ description: 'Oil filter', kind: 'part', partNumber: 'OF-1' });
    expect(parsed.estimate?.lineItems?.[1]).toMatchObject({ description: 'Diagnostic labor', kind: 'labor' });
  });
});

describe('work order closeout', () => {
  const quoted = { estimatedCost: 1.08, paymentStatus: 'unpaid' };

  it('does not invoice an estimate that is still waiting on the customer', () => {
    const result = closeoutTransition({ ...quoted, status: 'estimate-submitted' }, 'invoice');
    expect(result.ok).toBe(false);
  });

  it('does not invoice a denied quote', () => {
    const result = closeoutTransition({ ...quoted, status: 'denied-estimate' }, 'invoice');
    expect(result.ok).toBe(false);
  });

  it('requests payment on the authorized job without marking it complete', () => {
    const invoiced = closeoutTransition({ ...quoted, status: 'in-progress' }, 'invoice');
    expect(invoiced).toMatchObject({ ok: true, status: 'waiting-for-payment', paymentStatus: 'unpaid', amount: 1.08 });

    const paid = closeoutTransition({ ...quoted, status: 'waiting-for-payment' }, 'paid');
    expect(paid).toMatchObject({ ok: true, status: 'waiting-for-payment', paymentStatus: 'paid' });
  });

  it('completes the job only after it is paid', () => {
    expect(closeoutTransition({ ...quoted, status: 'waiting-for-payment', paymentStatus: 'unpaid' }, 'complete').ok).toBe(false);
    expect(closeoutTransition({ ...quoted, status: 'waiting-for-payment', paymentStatus: 'paid' }, 'complete')).toMatchObject({
      ok: true,
      status: 'completed',
      paymentStatus: 'paid',
    });
  });
});
