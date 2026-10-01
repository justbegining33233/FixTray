import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth';
import crypto from 'crypto';
import { validateDviCreate } from '@/lib/shopFormValidation';
import { resolveAccountLocale, stampOutgoingTranslation } from '@/lib/chatTranslationStore';
import {
  checklistItemsToStore,
  DONE_INSPECTION_STATUS,
  FINDING_CONDITION,
  inspectionCustomerMessage,
  inspectionStatusForWrite,
  isSkipInspectionRequest,
  nextInspectionWrite,
  pictureUrlsFromBody,
  resolveAttachedWorkOrderId,
  vehicleText,
} from '@/lib/optionalInspection';
import { workOrderIdSearchToken } from '@/lib/workOrderSearch';

type ChecklistBody = {
  category?: string;
  itemName?: string;
  condition?: string;
  notes?: string;
  estimatedCost?: number | null;
};

function itemRows(items: ChecklistBody[], pictureUrls: string[], comment: string) {
  const rows = checklistItemsToStore(items).map((item) => ({
    category: item.category || 'Inspection',
    itemName: item.itemName || 'Item',
    condition: item.condition || 'green',
    notes: item.notes || null,
    estimatedCost: item.estimatedCost ? Number(item.estimatedCost) : null,
  }));
  if (pictureUrls.length > 0 || comment) {
    rows.unshift({
      category: 'Findings',
      itemName: 'Pictures and notes',
      condition: FINDING_CONDITION,
      notes: comment || null,
      estimatedCost: null,
      photos: pictureUrls.length > 0 ? JSON.stringify(pictureUrls) : null,
    } as (typeof rows)[number] & { photos?: string | null });
  }
  return rows;
}

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const shopId = auth.role === 'shop' ? auth.id : (auth as { shopId?: string }).shopId;
  if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 400 });

  const inspections = await prisma.dVIInspection.findMany({
    where: { shopId },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(inspections);
}

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const shopId = auth.role === 'shop' ? auth.id : (auth as { shopId?: string }).shopId;
  if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const check = validateDviCreate(body);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const typedWorkOrderId = String(body.workOrderId || '').trim();
  let workOrderId: string | null = null;
  let matchedVehicle = '';
  if (typedWorkOrderId) {
    const token = workOrderIdSearchToken(typedWorkOrderId);
    const candidates = await prisma.workOrder.findMany({
      where: {
        shopId,
        OR: [
          { id: typedWorkOrderId },
          ...(token ? [{ id: { endsWith: token, mode: 'insensitive' as const } }] : []),
        ],
      },
      select: {
        id: true,
        vehicleType: true,
        vehicle: { select: { year: true, make: true, model: true } },
      },
      take: 20,
    });
    workOrderId = resolveAttachedWorkOrderId(typedWorkOrderId, candidates.map((row: { id: string }) => row.id));
    if (!workOrderId) {
      return NextResponse.json({ error: 'That work order was not found for this shop.' }, { status: 400 });
    }
    const match = candidates.find((row: { id: string; vehicleType?: string | null; vehicle?: { year?: number | string | null; make?: string | null; model?: string | null } | null }) => row.id === workOrderId);
    matchedVehicle = vehicleText(match);
  }

  const comment = typeof body.comment === 'string' ? body.comment.trim() : '';
  const pictureUrls = pictureUrlsFromBody(body.photoUrls ?? body.pictureUrls);
  const skip = isSkipInspectionRequest(body);
  const performing = !skip && (body.recordFindings === true || comment.length > 0 || pictureUrls.length > 0);
  if (performing && !comment && pictureUrls.length === 0) {
    return NextResponse.json({ error: 'Add a comment or a picture, or skip the inspection.' }, { status: 400 });
  }

  const existing = workOrderId
    ? await prisma.dVIInspection.findFirst({
      where: { shopId, workOrderId },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    })
    : null;

  const write = nextInspectionWrite({
    intent: skip ? 'skip' : performing ? 'perform' : 'template',
    existingStatus: existing?.status,
  });
  if (write === 'leave' && existing) return NextResponse.json(existing);

  const vehicleDesc = String(body.vehicleDesc || '').trim() || matchedVehicle || null;
  const mileage = body.mileage ? Number(body.mileage) : null;
  const notes = skip ? null : (comment || (typeof body.notes === 'string' ? body.notes : null));
  const items = skip || !performing
    ? (skip ? [] : (Array.isArray(body.items) ? body.items : []))
    : itemRows(Array.isArray(body.items) ? body.items : [], pictureUrls, comment);

  const status = write === 'skip'
    ? inspectionStatusForWrite('skip')
    : write === 'done'
      ? inspectionStatusForWrite('done')
      : 'in-progress';

  const inspection = existing && (write === 'done' || write === 'skip')
    ? await prisma.dVIInspection.update({
      where: { id: existing.id },
      data: {
        status,
        vehicleDesc,
        mileage,
        notes,
        techId: auth.role === 'tech' ? auth.id : existing.techId,
        items: {
          deleteMany: {},
          create: items.map((item: ChecklistBody & { photos?: string | null }) => ({
            category: item.category || 'Inspection',
            itemName: item.itemName || 'Item',
            condition: item.condition || 'green',
            notes: item.notes || null,
            estimatedCost: item.estimatedCost ? Number(item.estimatedCost) : null,
            photos: item.photos || null,
          })),
        },
      },
      include: { items: true },
    })
    : await prisma.dVIInspection.create({
      data: {
        shopId,
        workOrderId,
        techId: auth.role === 'tech' ? auth.id : body.techId || null,
        customerId: body.customerId || null,
        vehicleDesc,
        mileage,
        notes,
        approvalToken: crypto.randomBytes(20).toString('hex'),
        status,
        items: {
          create: (write === 'template' ? (body.items || []) : items).map((item: ChecklistBody & { photos?: string | null }) => ({
            category: item.category || 'Inspection',
            itemName: item.itemName || 'Item',
            condition: item.condition || 'green',
            notes: item.notes || null,
            estimatedCost: item.estimatedCost ? Number(item.estimatedCost) : null,
            photos: item.photos || null,
          })),
        },
      },
      include: { items: true },
    });

  if (status === DONE_INSPECTION_STATUS && workOrderId && (comment || pictureUrls.length > 0)) {
    const workOrder = await prisma.workOrder.findFirst({
      where: { id: workOrderId, shopId },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true } },
        shop: { select: { id: true, shopName: true } },
      },
    });
    let senderName = auth.role === 'shop' ? (workOrder?.shop?.shopName || 'Shop') : 'Tech';
    if ((auth.role === 'tech' || auth.role === 'manager') && auth.id) {
      const tech = await prisma.tech.findUnique({
        where: { id: auth.id },
        select: { firstName: true, lastName: true },
      });
      if (tech) senderName = `${tech.firstName || ''} ${tech.lastName || ''}`.trim() || senderName;
    }
    const customerName = workOrder?.customer
      ? `${workOrder.customer.firstName || ''} ${workOrder.customer.lastName || ''}`.trim()
      : 'Customer';
    const posted = inspectionCustomerMessage({
      workOrderId,
      shopId,
      shopName: workOrder?.shop?.shopName,
      customerId: workOrder?.customerId,
      customerName,
      senderId: auth.id,
      senderName,
      comment,
      pictureUrls,
    });
    if (!posted.ok) return NextResponse.json({ error: posted.error, inspection }, { status: 400 });
    const sourceLocale = await resolveAccountLocale(req, auth);
    const message = await prisma.message.create({
      data: {
        workOrderId,
        sender: auth.role,
        senderName,
        body: posted.post.body,
        sourceLocale,
        attachmentUrl: posted.post.attachmentUrl,
        attachmentType: posted.post.attachmentType,
      },
    });
    let mirrorId: string | null = null;
    if (posted.post.mirror) {
      const mirrored = await prisma.directMessage.create({
        data: { ...posted.post.mirror, sourceLocale },
      });
      mirrorId = mirrored.id;
    }
    const audiences = [
      ...(workOrder?.customerId ? [{ role: 'customer', id: workOrder.customerId }] : []),
      { role: 'shop', id: shopId },
    ];
    await stampOutgoingTranslation({
      body: posted.post.body,
      sourceLocale,
      audiences,
      persist: async (fields) => {
        await prisma.message.update({ where: { id: message.id }, data: fields });
        if (mirrorId) await prisma.directMessage.update({ where: { id: mirrorId }, data: fields });
      },
    });
  }

  return NextResponse.json(inspection, { status: existing && write !== 'template' ? 200 : 201 });
}
