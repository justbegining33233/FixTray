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
  assignedTechId: string | null;
  status: string;
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
  tech: { findUnique(args: { where: { id: string } }): Promise<{ id: string; shopId: string } | null> };
  syncReceipt: {
    findUnique(args: { where: { idempotencyKey: string } }): Promise<ReceiptRow | null>;
    create(args: { data: ReceiptRow }): Promise<ReceiptRow>;
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
  if (auth.role !== 'tech' && auth.role !== 'manager') {
    return result(op, 'rejected', { message: 'Technicians only.' });
  }
  if (!validClientKey(op.idempotencyKey)) {
    return result(op, 'rejected', { message: 'Missing idempotency key.' });
  }

  const prior = await db.syncReceipt.findUnique({ where: { idempotencyKey: op.idempotencyKey } });
  if (prior) {
    if (prior.techId !== auth.id) return result(op, 'rejected', { message: 'Forbidden.' });
    return { ...prior.result, status: prior.result.status === 'applied' ? 'duplicate' : prior.result.status };
  }

  const tech = await db.tech.findUnique({ where: { id: auth.id } });
  if (!tech) return result(op, 'rejected', { message: 'Tech not found.' });

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
      },
    });
    return outcome;
  });
  return applied;
}

async function applyOnce(db: OfflineDb, auth: OfflineAuth, tech: { id: string; shopId: string }, op: Op): Promise<SyncResult> {
  const kind = String(op.kind || '');
  if (kind === 'clock-in' || kind === 'clock-out') return applyClock(db, auth, tech, op);

  if (typeof op.workOrderId !== 'string' || !op.workOrderId) {
    return result(op, 'rejected', { message: 'Work order is required.' });
  }
  const order = await db.workOrder.findUnique({ where: { id: op.workOrderId } });
  if (!order) return result(op, 'rejected', { message: 'Work order not found.' });
  if (order.assignedTechId !== auth.id || order.shopId !== tech.shopId) {
    return result(op, 'rejected', { message: 'This job is not assigned to you.' });
  }

  if (kind === 'status') return applyStatus(db, order, op);
  if (kind === 'labor' || kind === 'part' || kind === 'note') return applyLine(db, order, op);
  if (kind === 'photo') return applyPhoto(db, auth, order, op);
  if (kind === 'payment' || kind === 'estimate' || kind === 'upload') {
    return result(op, 'rejected', { message: 'That action needs a connection.' });
  }
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
  if (op.kind === 'labor') {
    const item: JsonRow = {
      clientId,
      description: String(op.description || '').slice(0, 500),
      hours: Number(op.hours) || 0,
      rate: Number(op.rate) || 0,
      type: 'labor',
      addedAt: new Date().toISOString(),
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
      addedAt: new Date().toISOString(),
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
    createdAt: new Date().toISOString(),
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
    await db.timeEntry.create({
      data: {
        techId: auth.id,
        shopId: tech.shopId,
        clockIn: new Date(String(op.at || new Date().toISOString())),
        notes: op.notes ? String(op.notes).slice(0, 500) : null,
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
  await db.timeEntry.update({
    where: { id: entry.id },
    data: {
      clockOut: new Date(String(op.at || new Date().toISOString())),
      notes: op.notes ? String(op.notes).slice(0, 500) : entry.notes,
    },
  });
  return result(op, 'applied');
}
