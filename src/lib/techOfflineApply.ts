import {
  isSealedWorkOrder,
  roleMayApply,
  sealedEditMessage,
  sortGpsPoints,
  stampTimes,
  type GpsPoint,
} from './offlineSafety';
import {
  isCloudinaryUrl,
  mergeByClientId,
  reviewStatusChoice,
  statusDecision,
  validClientKey,
  type SyncResult,
} from './techOfflineSync';

export type OfflineAuth = {
  id: string;
  role: string;
  shopId?: string;
};

type JsonRow = { clientId?: string; [key: string]: unknown };

type WorkOrderRow = {
  id: string;
  shopId: string;
  customerId?: string | null;
  assignedTechId: string | null;
  status: string;
  paymentStatus?: string | null;
  techLabor: unknown;
  partsUsed: unknown;
  workPhotos: unknown;
  completion: unknown;
  updatedAt?: Date | string;
};

type ReceiptRow = {
  id: string;
  idempotencyKey: string;
  techId: string;
  workOrderId?: string | null;
  kind: string;
  status: string;
  result: SyncResult;
};

export type OfflineDb = {
  tech: {
    findUnique(args: { where: { id: string } }): Promise<{ id: string; shopId: string } | null>;
    update?(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  };
  syncReceipt: {
    findUnique(args: { where: { idempotencyKey: string } }): Promise<ReceiptRow | null>;
    create(args: { data: ReceiptRow & { deviceAt?: Date | null } }): Promise<ReceiptRow>;
  };
  message?: {
    findUnique(args: { where: { clientMutationId: string } }): Promise<Record<string, unknown> | null>;
    create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
  };
  customerMessage?: {
    findUnique(args: { where: { clientMutationId: string } }): Promise<Record<string, unknown> | null>;
    create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
  };
  locationPing?: {
    findUnique(args: { where: { clientMutationId: string } }): Promise<Record<string, unknown> | null>;
    create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
  };
  techTracking?: {
    upsert(args: { where: { workOrderId: string }; create: Record<string, unknown>; update: Record<string, unknown> }): Promise<unknown>;
  };
  workOrder: {
    findUnique(args: { where: { id: string } }): Promise<WorkOrderRow | null>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<WorkOrderRow>;
  };
  statusHistory: { create(args: { data: Record<string, unknown> }): Promise<unknown> };
  timeEntry: {
    findFirst(args: { where: Record<string, unknown> }): Promise<Record<string, unknown> | null>;
    findUnique(args: { where: { clientMutationId: string } }): Promise<Record<string, unknown> | null>;
    create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<Record<string, unknown>>;
  };
  photo: {
    findUnique(args: { where: { clientMutationId: string } }): Promise<Record<string, unknown> | null>;
    create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
  };
  $transaction<T>(fn: (tx: OfflineDb) => Promise<T>): Promise<T>;
};

type Op = Record<string, unknown>;

function result(op: Op, status: SyncResult['status'], extra: Partial<SyncResult> = {}): SyncResult {
  return {
    idempotencyKey: String(op.idempotencyKey || ''),
    kind: String(op.kind || ''),
    status,
    workOrderId: typeof op.workOrderId === 'string' ? op.workOrderId : undefined,
    ...extra,
  };
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
}

export async function applyTechOfflineOp(db: OfflineDb, auth: OfflineAuth, op: Op): Promise<SyncResult> {
  const permission = roleMayApply(auth.role, String(op.kind || ''));
  if (!permission.ok) return result(op, 'rejected', { message: permission.message });
  if (!validClientKey(op.idempotencyKey)) {
    return result(op, 'rejected', { message: 'Missing idempotency key.' });
  }

  const prior = await db.syncReceipt.findUnique({ where: { idempotencyKey: op.idempotencyKey } });
  if (prior) {
    if (prior.techId !== auth.id) return result(op, 'rejected', { message: 'Forbidden.' });
    return { ...prior.result, status: prior.result.status === 'applied' ? 'duplicate' : prior.result.status };
  }

  const tech = auth.role === 'tech' || auth.role === 'manager'
    ? await db.tech.findUnique({ where: { id: auth.id } })
    : { id: auth.id, shopId: auth.shopId || auth.id };
  if (!tech) return result(op, 'rejected', { message: 'Account not found.' });

  const applied = await db.$transaction(async (tx) => {
    const again = await tx.syncReceipt.findUnique({ where: { idempotencyKey: String(op.idempotencyKey) } });
    if (again) {
      if (again.techId !== auth.id) return result(op, 'rejected', { message: 'Forbidden.' });
      return { ...again.result, status: again.result.status === 'applied' ? 'duplicate' as const : again.result.status };
    }
    const outcome = await applyOnce(tx, auth, tech, op);
    await tx.syncReceipt.create({
      data: {
        id: `rcpt_${op.idempotencyKey}`,
        idempotencyKey: String(op.idempotencyKey),
        techId: auth.id,
        workOrderId: typeof op.workOrderId === 'string' ? op.workOrderId : null,
        kind: String(op.kind || ''),
        status: outcome.status,
        result: outcome,
        deviceAt: op.deviceAt ? new Date(String(op.deviceAt)) : null,
      },
    });
    return outcome;
  });
  return applied;
}

function canTouch(auth: OfflineAuth, order: WorkOrderRow, shopId: string): boolean {
  if (auth.role === 'superadmin') return true;
  if (auth.role === 'customer') return !!order.customerId && order.customerId === auth.id;
  if (auth.role === 'shop') return order.shopId === auth.id || (!!auth.shopId && order.shopId === auth.shopId);
  if (auth.role === 'manager') return order.shopId === shopId || (!!auth.shopId && order.shopId === auth.shopId);
  return order.assignedTechId === auth.id && order.shopId === shopId;
}

async function applyOnce(db: OfflineDb, auth: OfflineAuth, tech: { id: string; shopId: string }, op: Op): Promise<SyncResult> {
  const kind = String(op.kind || '');
  if (kind === 'gps') return applyGps(db, auth, tech, op);
  if (kind === 'clock-in' || kind === 'clock-out') return applyClock(db, auth, tech, op);

  if (typeof op.workOrderId !== 'string' || !op.workOrderId) {
    return result(op, 'rejected', { message: 'Work order is required.' });
  }
  const order = await db.workOrder.findUnique({ where: { id: op.workOrderId } });
  if (!order) return result(op, 'rejected', { message: 'Work order not found.' });
  if (!canTouch(auth, order, tech.shopId)) {
    return result(op, 'rejected', { message: 'This record is outside your account.' });
  }
  if (isSealedWorkOrder(order.status, order.paymentStatus)) {
    return result(op, 'conflict', { message: sealedEditMessage(order.status), serverStatus: order.status });
  }

  if (kind === 'status') return applyStatus(db, order, op);
  if (kind === 'labor' || kind === 'part' || kind === 'note') return applyLine(db, order, op);
  if (kind === 'photo') return applyPhoto(db, auth, order, op);
  if (kind === 'message') return applyMessage(db, auth, order, op);
  return result(op, 'rejected', { message: 'Unknown offline action.' });
}

async function applyStatus(db: OfflineDb, order: WorkOrderRow, op: Op): Promise<SyncResult> {
  const next = String(op.status || '');
  const choice = reviewStatusChoice(next);
  if (!choice.ok) return result(op, 'rejected', { message: choice.message, serverStatus: order.status });
  const decision = statusDecision(order.status, String(op.baseStatus || ''), next);
  if (decision === 'conflict') {
    return result(op, 'conflict', {
      message: `The shop already set this job to ${order.status}. Your other offline work is kept.`,
      serverStatus: order.status,
    });
  }
  if (decision === 'apply') {
    await db.workOrder.update({
      where: { id: order.id },
      data: { status: next },
    });
    await db.statusHistory.create({
      data: {
        workOrderId: order.id,
        fromStatus: order.status,
        toStatus: next,
        reason: 'Offline sync',
        changedById: null,
      },
    });
  }
  return result(op, 'applied', { serverStatus: decision === 'apply' ? next : order.status });
}

async function applyLine(db: OfflineDb, order: WorkOrderRow, op: Op): Promise<SyncResult> {
  if (!validClientKey(op.clientId)) return result(op, 'rejected', { message: 'Missing client id.' });
  const clientId = op.clientId;
  const stamp = stampTimes(op.deviceAt);
  if (op.kind === 'labor') {
    const item: JsonRow = {
      clientId,
      description: String(op.description || '').slice(0, 500),
      hours: Number(op.hours) || 0,
      rate: Number(op.rate) || 0,
      type: 'labor',
      addedAt: stamp.effectiveAt,
      deviceAt: stamp.deviceAt,
      receivedAt: stamp.receivedAt,
      clockAdjusted: stamp.clockAdjusted,
    };
    const merged = mergeByClientId(order.techLabor, item);
    if (merged.added) {
      await db.workOrder.update({ where: { id: order.id }, data: { techLabor: merged.items } });
    }
    return result(op, 'applied');
  }
  if (op.kind === 'part') {
    const item: JsonRow = {
      clientId,
      name: String(op.name || op.description || '').slice(0, 500),
      partNumber: String(op.partNumber || '').slice(0, 80),
      quantity: Number(op.quantity) || 1,
      unitPrice: Number(op.unitPrice) || 0,
      addedAt: stamp.effectiveAt,
      deviceAt: stamp.deviceAt,
      receivedAt: stamp.receivedAt,
    };
    const merged = mergeByClientId(order.partsUsed, item);
    if (merged.added) {
      await db.workOrder.update({ where: { id: order.id }, data: { partsUsed: merged.items } });
    }
    return result(op, 'applied');
  }
  const completion = asObject(order.completion);
  const item: JsonRow = {
    clientId,
    body: String(op.body || '').slice(0, 2000),
    createdAt: stamp.effectiveAt,
    deviceAt: stamp.deviceAt,
    receivedAt: stamp.receivedAt,
  };
  const merged = mergeByClientId(completion.offlineNotes, item);
  if (merged.added) {
    await db.workOrder.update({
      where: { id: order.id },
      data: { completion: { ...completion, offlineNotes: merged.items } },
    });
  }
  return result(op, 'applied');
}

async function applyPhoto(db: OfflineDb, auth: OfflineAuth, order: WorkOrderRow, op: Op): Promise<SyncResult> {
  if (!validClientKey(op.clientId)) return result(op, 'rejected', { message: 'Missing client id.' });
  if (typeof op.url !== 'string' || !isCloudinaryUrl(op.url)) {
    return result(op, 'rejected', { message: 'Photo must be uploaded before it can be attached.' });
  }
  const existing = await db.photo.findUnique({ where: { clientMutationId: op.clientId } });
  const photo = {
    clientId: op.clientId,
    url: op.url,
    type: 'photo',
    caption: String(op.caption || '').slice(0, 500),
    uploadedAt: new Date().toISOString(),
    uploadedBy: auth.role,
  };
  const merged = mergeByClientId(order.workPhotos, photo);
  if (!existing) {
    await db.photo.create({
      data: {
        url: op.url,
        caption: photo.caption,
        workOrderId: order.id,
        uploadedBy: auth.id,
        clientMutationId: op.clientId,
      },
    });
  }
  if (merged.added) {
    await db.workOrder.update({ where: { id: order.id }, data: { workPhotos: merged.items } });
  }
  return result(op, 'applied');
}

async function applyClock(db: OfflineDb, auth: OfflineAuth, tech: { id: string; shopId: string }, op: Op): Promise<SyncResult> {
  if (!validClientKey(op.clientId)) return result(op, 'rejected', { message: 'Missing client id.' });
  if (op.kind === 'clock-in') {
    const existing = await db.timeEntry.findUnique({ where: { clientMutationId: String(op.clientId) } });
    if (existing) return result(op, 'applied');
    const open = await db.timeEntry.findFirst({ where: { techId: auth.id, clockOut: null } });
    if (open) {
      return result(op, 'conflict', { message: 'You are already clocked in on the server. This clock-in was kept locally.' });
    }
    const stamp = stampTimes(op.deviceAt || op.at);
    const note = op.notes ? String(op.notes).slice(0, 500) : '';
    await db.timeEntry.create({
      data: {
        techId: auth.id,
        shopId: tech.shopId,
        clockIn: new Date(stamp.effectiveAt),
        notes: stamp.clockAdjusted
          ? `${note} Device clock was off; clock-in uses server time. Device said ${stamp.deviceAt}.`.trim()
          : (note || null),
        workOrderId: typeof op.workOrderId === 'string' ? op.workOrderId : null,
        clientMutationId: op.clientId,
      },
    });
    return result(op, 'applied');
  }
  const clockInClientId = String(op.clockInClientId || op.clientId);
  const entry = await db.timeEntry.findUnique({ where: { clientMutationId: clockInClientId } })
    || await db.timeEntry.findFirst({ where: { techId: auth.id, clockOut: null } });
  if (!entry || typeof entry.id !== 'string') {
    return result(op, 'conflict', { message: 'No open clock entry to close. The clock-out is saved on this device.' });
  }
  if (entry.clockOut) return result(op, 'applied');
  const stamp = stampTimes(op.deviceAt || op.at);
  await db.timeEntry.update({
    where: { id: entry.id },
    data: {
      clockOut: new Date(stamp.effectiveAt),
      notes: op.notes ? String(op.notes).slice(0, 500) : entry.notes,
    },
  });
  return result(op, 'applied', { message: stamp.clockAdjusted ? 'Device clock was off. Server time was used.' : undefined });
}

async function applyMessage(db: OfflineDb, auth: OfflineAuth, order: WorkOrderRow, op: Op): Promise<SyncResult> {
  if (!validClientKey(op.clientId)) return result(op, 'rejected', { message: 'Missing client id.' });
  if (!db.message) return result(op, 'rejected', { message: 'Messages are not available.' });
  const existing = await db.message.findUnique({ where: { clientMutationId: String(op.clientId) } });
  if (existing) return result(op, 'applied');
  const stamp = stampTimes(op.deviceAt);
  const body = String(op.body || '').slice(0, 5000);
  if (!body && typeof op.url !== 'string') return result(op, 'rejected', { message: 'Message is empty.' });
  const attachmentUrl = typeof op.url === 'string' && isCloudinaryUrl(op.url) ? op.url : null;
  if (typeof op.url === 'string' && op.url && !attachmentUrl) {
    return result(op, 'rejected', { message: 'Photo must be uploaded before it can be attached.' });
  }
  await db.message.create({
    data: {
      workOrderId: order.id,
      sender: auth.role,
      senderName: String(op.senderName || auth.role).slice(0, 120),
      body: body || 'Photo',
      attachmentUrl,
      attachmentType: attachmentUrl ? 'image' : null,
      clientMutationId: op.clientId,
      createdAt: new Date(stamp.effectiveAt),
    },
  });
  if (auth.role === 'customer' && db.customerMessage) {
    const prior = await db.customerMessage.findUnique({ where: { clientMutationId: String(op.clientId) } });
    if (!prior) {
      await db.customerMessage.create({
        data: {
          customerId: auth.id,
          workOrderId: order.id,
          from: 'customer',
          content: body || 'Photo',
          attachmentUrl,
          clientMutationId: op.clientId,
          sentAt: new Date(stamp.effectiveAt),
        },
      });
    }
  }
  return result(op, 'applied', { message: stamp.clockAdjusted ? 'Device clock was off. Server time was stored.' : undefined });
}

async function applyGps(db: OfflineDb, auth: OfflineAuth, tech: { id: string; shopId: string }, op: Op): Promise<SyncResult> {
  if (!db.locationPing) return result(op, 'rejected', { message: 'Location storage is not available.' });
  const rawPoints = Array.isArray(op.points) ? op.points : [op];
  const points = sortGpsPoints(rawPoints.map((point) => {
    const row = (point && typeof point === 'object' ? point : {}) as GpsPoint & Op;
    return {
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      accuracy: Number(row.accuracy) || null,
      deviceAt: (typeof row.deviceAt === 'string' ? row.deviceAt : null) || (typeof row.at === 'string' ? row.at : null),
      clientId: String(row.clientId || op.clientId || ''),
      workOrderId: typeof row.workOrderId === 'string' ? row.workOrderId : '',
    };
  })).filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
  if (!points.length) return result(op, 'rejected', { message: 'Location point is required.' });

  let latest: { latitude: number; longitude: number; deviceAt: string; workOrderId?: string } | null = null;
  for (const point of points) {
    if (!validClientKey(point.clientId)) return result(op, 'rejected', { message: 'Missing client id.' });
    const workOrderId = (point.workOrderId || (typeof op.workOrderId === 'string' ? op.workOrderId : ''));
    if (workOrderId) {
      const order = await db.workOrder.findUnique({ where: { id: workOrderId } });
      if (!order || !canTouch(auth, order, tech.shopId)) {
        return result(op, 'rejected', { message: 'This job is not assigned to you.' });
      }
    }
    const existing = await db.locationPing.findUnique({ where: { clientMutationId: String(point.clientId) } });
    const stamp = stampTimes(point.deviceAt);
    if (!existing) {
      await db.locationPing.create({
        data: {
          techId: auth.id,
          workOrderId: workOrderId || null,
          latitude: point.latitude,
          longitude: point.longitude,
          accuracy: Number(point.accuracy) || null,
          deviceAt: new Date(stamp.deviceAt),
          receivedAt: new Date(stamp.receivedAt),
          clockAdjusted: stamp.clockAdjusted,
          clientMutationId: point.clientId,
        },
      });
    }
    latest = { latitude: point.latitude, longitude: point.longitude, deviceAt: stamp.effectiveAt, workOrderId: workOrderId || undefined };
  }
  if (latest && db.tech.update) {
    await db.tech.update({
      where: { id: auth.id },
      data: { latitude: latest.latitude, longitude: latest.longitude, lastLocationUpdate: new Date(latest.deviceAt) },
    });
  }
  if (latest?.workOrderId && db.techTracking) {
    await db.techTracking.upsert({
      where: { workOrderId: latest.workOrderId },
      create: { workOrderId: latest.workOrderId, latitude: latest.latitude, longitude: latest.longitude },
      update: { latitude: latest.latitude, longitude: latest.longitude },
    });
  }
  return result(op, 'applied');
}
