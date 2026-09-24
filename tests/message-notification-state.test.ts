import { describe, expect, it } from '@jest/globals';
import {
  counterpartyForViewer,
  isUnreadForViewer,
  markReadReceiverIds,
  messageIsOwn,
  participantOrClauses,
  threadAccessWhere,
} from '../src/lib/directMessageAccess';
import { mergeThreadMessages, toThreadMessage } from '../src/lib/messageThread';
import {
  parseMessageNotificationId,
  preferenceAllows,
  readDismissedWorkOrderIds,
  rememberDismissedWorkOrderIds,
  visibleInboxItems,
  workOrderNotificationId,
} from '../src/lib/notificationInbox';
import { workOrderUpdateSchema } from '../src/lib/validationSchemas';
import {
  hasWorkOrderFieldUpdates,
  legacyMessagesToStore,
  workOrderDirectMessage,
} from '../src/lib/workOrderMessagePersist';

describe('shop mailbox message visibility', () => {
  const customerToShop = {
    senderId: 'cust-1',
    senderRole: 'customer',
    senderName: 'Ada Customer',
    receiverId: 'shop-1',
    receiverRole: 'shop',
    receiverName: 'Main Shop',
    isRead: false,
  };

  it('shows a customer message on the shop thread for managers and techs', () => {
    const manager = { id: 'mgr-1', role: 'manager', shopId: 'shop-1' };
    expect(counterpartyForViewer(customerToShop, manager)).toEqual({
      otherId: 'cust-1',
      otherRole: 'customer',
      otherName: 'Ada Customer',
    });
    expect(isUnreadForViewer(customerToShop, manager)).toBe(true);
    expect(participantOrClauses(manager)).toEqual(expect.arrayContaining([
      { receiverId: 'shop-1', receiverRole: 'shop' },
    ]));
    expect(markReadReceiverIds(manager)).toEqual(['mgr-1', 'shop-1']);
    expect(threadAccessWhere(manager, 'cust-1', 'customer').OR.length).toBeGreaterThan(1);
  });

  it('stops counting a shop-mailbox message after it is read', () => {
    const shop = { id: 'shop-1', role: 'shop', shopId: 'shop-1' };
    expect(isUnreadForViewer({ ...customerToShop, isRead: true }, shop)).toBe(false);
    expect(messageIsOwn({ senderId: 'shop-1', senderRole: 'shop' }, { id: 'mgr-1', shopId: 'shop-1' })).toBe(true);
    expect(messageIsOwn({ senderId: 'cust-1', senderRole: 'customer' }, { id: 'mgr-1', shopId: 'shop-1' })).toBe(false);
  });
});

describe('work order thread reconcile', () => {
  it('rejects the old messages blob on work order update', () => {
    expect(workOrderUpdateSchema.safeParse({ messages: [{ body: 'hello' }] }).success).toBe(false);
  });

  it('keeps the saved server row and does not duplicate it', () => {
    const saved = toThreadMessage({
      id: 'msg-1',
      sender: 'customer',
      senderName: 'Ada',
      body: 'The truck will not start',
      createdAt: '2026-09-24T12:00:00.000Z',
    });
    expect(saved).not.toBeNull();
    const merged = mergeThreadMessages([], [saved!]);
    expect(mergeThreadMessages(merged, [saved!])).toHaveLength(1);
    expect(toThreadMessage({ sender: 'customer', body: 'no id' })).toBeNull();
  });
});

describe('work order chat persistence', () => {
  it('stores the customer line the live chat PUT was dropping', () => {
    const text = 'AUDIT msg-persist 20260924-a';
    const stored = legacyMessagesToStore([], [{
      id: '1710000000000',
      sender: 'customer',
      senderName: 'FixTray Audit',
      body: text,
      timestamp: '2026-09-24T12:22:55.000Z',
    }], 'customer');
    expect(stored).toEqual([{ sender: 'customer', senderName: 'FixTray Audit', body: text }]);
    expect(legacyMessagesToStore(
      [{ sender: 'customer', body: text }],
      [{ sender: 'customer', senderName: 'FixTray Audit', body: text }],
      'customer',
    )).toEqual([]);
    expect(hasWorkOrderFieldUpdates({})).toBe(false);
  });

  it('mirrors that line into the shop inbox', () => {
    const mirror = workOrderDirectMessage({
      workOrderId: 'cuid1234L89V2XSJ',
      shopId: 'shop-1',
      shopName: 'Audit Test Shop',
      customerId: 'cust-1',
      customerName: 'FixTray Audit',
      senderRole: 'customer',
      senderId: 'cust-1',
      senderName: 'FixTray Audit',
      body: 'AUDIT msg-persist 20260924-a',
    });
    expect(mirror).toMatchObject({
      senderRole: 'customer',
      receiverId: 'shop-1',
      receiverRole: 'shop',
      body: 'AUDIT msg-persist 20260924-a',
      subject: 'WO-L89V2XSJ',
    });
  });
});

describe('notification inbox clear-on-seen', () => {
  it('parses message notification ids that contain hyphens', () => {
    expect(parseMessageNotificationId('msg-customer-7c1e0b2a-9f3d-4a11-8c2e-111111111111')).toEqual({
      contactRole: 'customer',
      contactId: '7c1e0b2a-9f3d-4a11-8c2e-111111111111',
    });
    expect(parseMessageNotificationId('wo-abc')).toBeNull();
  });

  it('drops seen work orders and honors the work-order preference key', () => {
    const items = [
      { id: 'msg-customer-1', type: 'messages', read: false },
      { id: 'wo-99', type: 'workorders', read: false },
      { id: 'old', type: 'messages', read: true },
    ];
    expect(preferenceAllows('workorders', { workOrders: false })).toBe(false);
    const visible = visibleInboxItems(items, {
      prefs: { messages: true, workOrders: true },
      dismissedWorkOrderIds: new Set(['wo-99']),
    });
    expect(visible.map((item) => item.id)).toEqual(['msg-customer-1']);
  });

  it('drops a seen work order when the bell rebuilds it as unread', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
    };
    const seenId = workOrderNotificationId('cuid1234L89V2XSJ');
    rememberDismissedWorkOrderIds(storage, [seenId]);
    const rebuilt = visibleInboxItems([
      {
        id: seenId,
        type: 'workorders',
        read: false,
        title: 'New work order WO-L89V2XSJ: Appointment: Engine Diagnostics',
      },
      { id: 'msg-customer-1', type: 'messages', read: false },
    ], {
      prefs: { messages: true, workOrders: true },
      dismissedWorkOrderIds: readDismissedWorkOrderIds(storage),
    });
    expect(rebuilt.map((item) => item.id)).toEqual(['msg-customer-1']);
  });

  it('remembers dismissed work-order notifications only', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
    };
    const saved = rememberDismissedWorkOrderIds(storage, ['wo-1', 'msg-customer-1']);
    expect(saved.has('wo-1')).toBe(true);
    expect(saved.has('msg-customer-1')).toBe(false);
    expect(readDismissedWorkOrderIds(storage).has('wo-1')).toBe(true);
  });
});
