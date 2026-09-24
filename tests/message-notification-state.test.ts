import { describe, expect, it } from '@jest/globals';
import {
  counterpartyForViewer,
  isUnreadForViewer,
  markReadReceiverIds,
  messageIsOwn,
  participantOrClauses,
  threadAccessWhere,
  unreadWhere,
} from '../src/lib/directMessageAccess';
import {
  chatMessageContent,
  isChatImageUrl,
  messageListPreview,
  resolveChatAttachment,
} from '../src/lib/messageAttachment';
import { mergeThreadMessages, toThreadMessage } from '../src/lib/messageThread';
import {
  parseMessageNotificationId,
  preferenceAllows,
  readDismissedWorkOrderIds,
  recentAlertWorkOrders,
  rememberDismissedWorkOrderIds,
  showsSyntheticWorkOrderAlerts,
  storedWorkOrderId,
  visibleInboxItems,
  workOrderNotificationId,
} from '../src/lib/notificationInbox';
import { workOrderUpdateSchema } from '../src/lib/validationSchemas';
import {
  hasWorkOrderFieldUpdates,
  legacyMessagesToStore,
  workOrderDirectMessage,
  workOrderMessageSubject,
  workOrderSeenWhere,
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
    expect(unreadWhere(manager)).toEqual({
      OR: [
        { receiverId: 'mgr-1', receiverRole: 'manager', isRead: false },
        { receiverId: 'shop-1', receiverRole: 'shop', isRead: false },
      ],
    });
    expect(unreadWhere({ id: 'cust-1', role: 'customer' })).toEqual({
      OR: [{ receiverId: 'cust-1', receiverRole: 'customer', isRead: false }],
    });
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
    const image = 'https://res.cloudinary.com/demo/image/upload/v1/sample.png';
    const photo = toThreadMessage({
      id: 'msg-photo',
      sender: 'shop',
      body: '',
      attachmentUrl: image,
      attachmentType: 'image',
      createdAt: '2026-09-24T16:00:00.000Z',
    });
    expect(photo?.attachmentUrl).toBe(image);
    expect(photo?.body).toBe('');
    expect(mergeThreadMessages([], [photo!])).toHaveLength(1);
  });
});

describe('chat image attachments', () => {
  const image = 'https://res.cloudinary.com/demo/image/upload/v1/leak.webp';

  it('accepts a Cloudinary image with an optional caption', () => {
    expect(isChatImageUrl(image)).toBe(true);
    expect(isChatImageUrl('http://res.cloudinary.com/demo/image/upload/v1/leak.webp')).toBe(false);
    expect(isChatImageUrl('https://example.com/leak.webp')).toBe(false);
    expect(isChatImageUrl('https://notcloudinary.com/image/upload/leak.webp')).toBe(false);
    expect(resolveChatAttachment({ body: 'See this', attachmentUrl: image })).toEqual({
      ok: true,
      value: { body: 'See this', attachmentUrl: image, attachmentType: 'image' },
    });
    expect(resolveChatAttachment({ body: '', attachmentUrl: image }).ok).toBe(true);
    expect(resolveChatAttachment({ body: '   ', attachmentUrl: null })).toEqual({
      ok: false,
      error: 'Message body is required',
    });
    expect(resolveChatAttachment({ body: 'nope', attachmentUrl: 'https://example.com/a.jpg' })).toEqual({
      ok: false,
      error: 'Only HTTPS Cloudinary image URLs are allowed',
    });
  });

  it('keeps several pictures and still points the inbox at the first image', () => {
    const second = 'https://res.cloudinary.com/demo/image/upload/v1/other.gif';
    const resolved = resolveChatAttachment({ body: 'Two angles', attachmentUrls: [image, second] });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.value.attachmentUrl).toBe(image);
    expect(chatMessageContent(resolved.value).text).toBe('Two angles');
    expect(chatMessageContent(resolved.value).media.map((item) => item.url)).toEqual([image, second]);
    expect(messageListPreview(resolved.value.body, resolved.value.attachmentUrl)).toBe('Two angles');
    expect(messageListPreview('', image)).toBe('Photo');
  });

  it('still draws an older shop message that stored the picture inside the body', () => {
    const legacy = JSON.stringify({ t: 'Before the repair', m: [image] });
    const content = chatMessageContent({ body: legacy });
    expect(content).toEqual({ text: 'Before the repair', media: [{ url: image, kind: 'image' }] });
    const normalized = resolveChatAttachment({ body: legacy });
    expect(normalized).toEqual({
      ok: true,
      value: { body: 'Before the repair', attachmentUrl: image, attachmentType: 'image' },
    });
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
    expect(workOrderMessageSubject('cuid1234L89V2XSJ')).toBe('WO-L89V2XSJ');
  });

  it('mirrors a picture into the shop inbox with the caption', () => {
    const image = 'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg';
    const mirror = workOrderDirectMessage({
      workOrderId: 'cuid1234L89V2XSJ',
      shopId: 'shop-1',
      shopName: 'Audit Test Shop',
      customerId: 'cust-1',
      customerName: 'FixTray Audit',
      senderRole: 'shop',
      senderId: 'shop-1',
      senderName: 'Audit Test Shop',
      body: 'Here is the leak',
      attachmentUrl: image,
      attachmentType: 'image',
    });
    expect(mirror).toMatchObject({
      senderRole: 'shop',
      receiverRole: 'customer',
      receiverId: 'cust-1',
      body: 'Here is the leak',
      attachmentUrl: image,
      attachmentType: 'image',
      subject: 'WO-L89V2XSJ',
    });
    expect(workOrderDirectMessage({
      workOrderId: 'cuid1234L89V2XSJ',
      shopId: 'shop-1',
      customerId: 'cust-1',
      senderRole: 'customer',
      senderId: 'cust-1',
      senderName: 'FixTray Audit',
      body: '',
      attachmentUrl: image,
    })).toMatchObject({ body: '', attachmentUrl: image, receiverRole: 'shop' });
    expect(workOrderDirectMessage({
      workOrderId: 'cuid1234L89V2XSJ',
      shopId: 'shop-1',
      customerId: 'cust-1',
      senderRole: 'customer',
      senderId: 'cust-1',
      senderName: 'FixTray Audit',
      body: '',
      attachmentUrl: 'https://example.com/leak.jpg',
    })).toBeNull();
  });

  it('marks only this work-order subject seen for the person who opened the chat', () => {
    const workOrder = { id: 'cuid1234L89V2XSJ', customerId: 'cust-1', shopId: 'shop-1' };
    expect(workOrderSeenWhere({
      viewer: { id: 'mgr-1', role: 'manager', shopId: 'shop-1' },
      workOrder,
    })).toMatchObject({
      subject: 'WO-L89V2XSJ',
      receiverId: 'shop-1',
      receiverRole: 'shop',
      senderId: 'cust-1',
      senderRole: 'customer',
    });
    expect(workOrderSeenWhere({
      viewer: { id: 'cust-1', role: 'customer' },
      workOrder,
    })).toMatchObject({
      subject: 'WO-L89V2XSJ',
      receiverId: 'cust-1',
      senderRole: 'shop',
    });
    expect(workOrderSeenWhere({
      viewer: { id: 'other', role: 'customer' },
      workOrder,
    })).toBeNull();
    expect(workOrderSeenWhere({
      viewer: { id: 'admin-1', role: 'admin' },
      workOrder,
    })).toBeNull();
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

  it('gives tech the same recent work-order alerts as shop and manager', () => {
    expect(showsSyntheticWorkOrderAlerts('tech')).toBe(true);
    expect(showsSyntheticWorkOrderAlerts('shop')).toBe(true);
    expect(showsSyntheticWorkOrderAlerts('manager')).toBe(true);
    expect(showsSyntheticWorkOrderAlerts('admin')).toBe(false);
    expect(showsSyntheticWorkOrderAlerts('customer')).toBe(false);
    const now = Date.parse('2026-09-24T12:00:00.000Z');
    const recent = recentAlertWorkOrders([
      { id: 'old', createdAt: '2026-09-22T12:00:00.000Z' },
      { id: 'a', createdAt: '2026-09-24T11:00:00.000Z' },
      { id: 'b', createdAt: '2026-09-24T10:00:00.000Z' },
      { id: 'c', createdAt: '2026-09-24T09:00:00.000Z' },
      { id: 'd', createdAt: '2026-09-24T08:00:00.000Z' },
    ], now);
    expect(recent.map((order) => order.id)).toEqual(['a', 'b', 'c']);
    expect(storedWorkOrderId('wo-cuid1234L89V2XSJ')).toBe('cuid1234L89V2XSJ');
    expect(storedWorkOrderId('not safe')).toBeNull();
  });
});
