import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  canAddLinesFromFindings,
  checklistItemsToStore,
  dviInspectionListStatus,
  estimateAfterAddedLine,
  inspectionCustomerMessage,
  inspectionStatusForWrite,
  nextInspectionWrite,
  resolveAttachedWorkOrderId,
  shopInspectionLabel,
  skipBlocksJob,
} from '../src/lib/optionalInspection';

const workOrderId = 'clxyz123r780nguq';

describe('optional inspection', () => {
  it('attaches WO-R780NGUQ to the work order id and does not keep the label', () => {
    expect(resolveAttachedWorkOrderId('WO-R780NGUQ', [workOrderId, 'clother000000000'])).toBe(workOrderId);
    expect(resolveAttachedWorkOrderId(workOrderId, [workOrderId])).toBe(workOrderId);
    expect(resolveAttachedWorkOrderId('WO-R780NGUQ', ['clother000000000'])).toBeNull();
    expect(resolveAttachedWorkOrderId('WO-R780NGUQ', [])).toBeNull();
  });

  it('lets the tech skip without a pass, a fail, or a hold on the job', () => {
    expect(nextInspectionWrite({ intent: 'skip', existingStatus: null })).toBe('skip');
    expect(inspectionStatusForWrite('skip')).toBe('skipped');
    expect(inspectionStatusForWrite('done')).toBe('done');
    expect(skipBlocksJob()).toBe(false);
    expect(nextInspectionWrite({ intent: 'skip', existingStatus: 'in-progress' })).toBe('skip');
    expect(nextInspectionWrite({ intent: 'skip', existingStatus: 'done' })).toBe('leave');
    expect(nextInspectionWrite({ intent: 'skip', existingStatus: 'skipped' })).toBe('leave');
    expect(nextInspectionWrite({ intent: 'perform', existingStatus: 'skipped' })).toBe('done');
    expect(shopInspectionLabel('skipped')).toBe('Skipped');
    expect(shopInspectionLabel('done')).toBe('Done');
    expect(dviInspectionListStatus('skipped')).toBe('skipped');
    expect(dviInspectionListStatus('done')).toBe('done');
    expect(dviInspectionListStatus('skipped')).not.toBe('passed');
    expect(dviInspectionListStatus('skipped')).not.toBe('failed');
    expect(dviInspectionListStatus('done')).not.toBe('passed');
    expect(dviInspectionListStatus('done')).not.toBe('failed');
    expect(canAddLinesFromFindings('done')).toBe(true);
    expect(canAddLinesFromFindings('skipped')).toBe(false);
  });

  it('does not store an untouched all-green checklist as a pass', () => {
    expect(checklistItemsToStore([
      { category: 'Brakes', itemName: 'Front Brake Pads', condition: 'green', notes: '' },
      { category: 'Brakes', itemName: 'Rear Brake Pads', condition: 'yellow', notes: 'Thin' },
    ])).toEqual([
      { category: 'Brakes', itemName: 'Rear Brake Pads', condition: 'yellow', notes: 'Thin' },
    ]);
  });

  it('posts the comment and pictures on the job customer thread', () => {
    const result = inspectionCustomerMessage({
      workOrderId,
      shopId: 'shop-1',
      shopName: 'Audit Test Shop Jose',
      customerId: 'cust-1',
      customerName: 'Sam Customer',
      senderId: 'tech-1',
      senderName: 'Alex Tech',
      comment: 'Front pads are thin.',
      pictureUrls: ['https://res.cloudinary.com/demo/image/upload/v1/pads.jpg'],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.post.body).toContain('Front pads are thin.');
    expect(result.post.attachmentUrl).toContain('cloudinary.com');
    expect(result.post.mirror?.subject).toBe('WO-R780NGUQ');
    expect(result.post.mirror?.receiverId).toBe('cust-1');
    expect(result.post.mirror?.receiverRole).toBe('customer');
    expect(result.post.mirror?.shopId).toBe('shop-1');
    expect(result.post.body.toLowerCase()).not.toContain('pass');
    expect(result.post.body.toLowerCase()).not.toContain('fail');
  });

  it('adds a labor line from the findings without dropping existing lines or setting a fee', () => {
    const saved = estimateAfterAddedLine(
      {
        lineItems: [{ description: 'Oil filter', quantity: 1, unitPrice: 12, kind: 'part' }],
        taxRate: 0,
        notes: 'keep me',
        customerDecision: { accepted: true },
      },
      { description: 'Brake labor', quantity: 1.5, unitPrice: 80, kind: 'labor' },
    );
    expect(saved.estimate.lineItems).toHaveLength(2);
    expect(saved.partsUsed.map((part) => part.name)).toEqual(['Oil filter']);
    expect(saved.techLabor.map((line) => line.description)).toEqual(['Brake labor']);
    expect(saved.estimate.notes).toBe('keep me');
    expect(saved.estimate.customerDecision).toEqual({ accepted: true });
    expect(saved).not.toHaveProperty('serviceFee');
    expect(JSON.stringify(saved)).not.toContain('"serviceFee"');
  });

  it('does not update the work order when an inspection is saved', () => {
    const source = readFileSync(join(__dirname, '../src/app/api/dvi/route.ts'), 'utf8');
    expect(source).not.toContain('workOrder.update');
    expect(source).not.toContain("'passed'");
    expect(source).not.toContain("'failed'");
  });
});
