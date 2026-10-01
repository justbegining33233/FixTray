import { describe, expect, it } from '@jest/globals';
import { isUnreadForViewer, participantOrClauses } from '../src/lib/directMessageAccess';
import {
  isAtOrBelowReorderPoint,
  lowStockAskDraft,
  lowStockAskSubject,
  nextLowStockAsk,
  parseLowStockAskSubject,
} from '../src/lib/lowStockReorderAsk';

const oil = { itemId: 'oil', name: 'Oil filter', quantity: 1, reorderPoint: 3 };

describe('low-stock reorder ask', () => {
  it('asks once, naming the item, and does not ask again on the next check', () => {
    const first = nextLowStockAsk({ ...oil, notice: 'none' });
    expect(first.action).toBe('ask');
    if (first.action !== 'ask') return;
    expect(first.body).toContain('Oil filter');
    expect(first.body).toContain('Do you want to order more?');
    expect(first.body).toContain('1');
    expect(first.body).toContain('3');

    const again = nextLowStockAsk({ ...oil, notice: 'open' });
    expect(again).toEqual({ action: 'skip' });
    expect(parseLowStockAskSubject(first.subject, 'oil')).toBe('open');
  });

  it('asks again only after the quantity has been above the reorder point', () => {
    const recovered = nextLowStockAsk({ ...oil, quantity: 4, notice: 'open' });
    expect(recovered).toEqual({ action: 'close', subject: lowStockAskSubject('oil', 'closed') });

    const stillHealthy = nextLowStockAsk({ ...oil, quantity: 4, notice: 'closed' });
    expect(stillHealthy).toEqual({ action: 'skip' });

    const droppedAgain = nextLowStockAsk({ ...oil, quantity: 2, notice: 'closed' });
    expect(droppedAgain.action).toBe('ask');
  });

  it('treats the reorder point itself as low and ignores items with no reorder point', () => {
    expect(isAtOrBelowReorderPoint({ quantity: 3, reorderPoint: 3 })).toBe(true);
    expect(nextLowStockAsk({ ...oil, quantity: 3, notice: 'none' }).action).toBe('ask');
    expect(isAtOrBelowReorderPoint({ quantity: 0, reorderPoint: null })).toBe(false);
    expect(nextLowStockAsk({ ...oil, quantity: 0, reorderPoint: null, notice: 'none' })).toEqual({ action: 'skip' });
    expect(nextLowStockAsk({ ...oil, quantity: 8, reorderPoint: 2, notice: 'none' })).toEqual({ action: 'skip' });
  });

  it('delivers the ask on the shop mailbox managers already read', () => {
    const decision = nextLowStockAsk({ ...oil, notice: 'none' });
    if (decision.action !== 'ask') throw new Error('expected an ask');
    const draft = lowStockAskDraft({
      shopId: 'shop-1',
      shopName: 'Audit Test Shop Jose',
      body: decision.body,
      subject: decision.subject,
      threadId: decision.threadId,
    });
    const manager = { id: 'mgr-1', role: 'manager', shopId: 'shop-1' };
    expect(draft.receiverId).toBe('shop-1');
    expect(draft.receiverRole).toBe('shop');
    expect(draft.isRead).toBe(false);
    expect(participantOrClauses(manager)).toEqual(expect.arrayContaining([
      { receiverId: 'shop-1', receiverRole: 'shop' },
    ]));
    expect(isUnreadForViewer(draft, manager)).toBe(true);
    expect(isUnreadForViewer(draft, { id: 'cust-1', role: 'customer' })).toBe(false);
  });
});
