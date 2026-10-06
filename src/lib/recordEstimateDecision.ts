import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { customerEstimateDecision, type SignatureInput } from '@/lib/estimateAuthorization';
import { estimateDeniedFlag, serializeAttentionFlag } from '@/lib/notificationFlags';

export async function recordEstimateDecision(input: {
  workOrderId: string;
  response: unknown;
  signature: SignatureInput;
  signerIp: string;
}) {
  const decision = customerEstimateDecision(input.response, input.signature);
  if (!decision.ok) return { ok: false as const, error: decision.error, status: 400 };

  const workOrder = await prisma.workOrder.findUnique({
    where: { id: input.workOrderId },
    select: {
      id: true,
      customerId: true,
      shopId: true,
      assignedTechId: true,
      status: true,
      estimatedCost: true,
      estimate: true,
      issueDescription: true,
    },
  });
  if (!workOrder) return { ok: false as const, error: 'Work order not found', status: 404 };
  if (workOrder.status !== 'estimate-submitted') {
    return { ok: false as const, error: 'No pending estimate to respond to', status: 400 };
  }

  const priorEstimate = workOrder.estimate && typeof workOrder.estimate === 'object'
    ? workOrder.estimate as Record<string, unknown>
    : {};
  const signedAt = new Date();
  await prisma.workOrder.update({
    where: { id: workOrder.id },
    data: {
      status: decision.woStatus,
      estimate: {
        ...priorEstimate,
        customerDecision: {
          response: decision.response,
          signerName: decision.signerName,
          signatureData: decision.signatureData,
          signedAt: signedAt.toISOString(),
        },
      },
    },
  });
  await prisma.statusHistory.create({
    data: {
      workOrderId: workOrder.id,
      fromStatus: workOrder.status,
      toStatus: decision.woStatus,
      reason: decision.response === 'accepted' ? 'Estimate accepted' : 'Estimate denied',
    },
  });

  if (decision.createAuthorization) {
    const summary = String(workOrder.issueDescription ?? '').slice(0, 1000) || 'Customer-signed estimate';
    const existing = await prisma.workAuthorization.findFirst({
      where: { workOrderId: workOrder.id },
      orderBy: { createdAt: 'desc' },
    });
    const authFields = {
      status: decision.authStatus,
      signatureData: decision.signatureData,
      signedAt,
      signerName: decision.signerName,
      signerIP: input.signerIp,
      estimateTotal: workOrder.estimatedCost ?? null,
      workSummary: summary,
    };
    if (existing) {
      await prisma.workAuthorization.update({ where: { id: existing.id }, data: authFields });
    } else {
      await prisma.workAuthorization.create({
        data: {
          shopId: workOrder.shopId,
          workOrderId: workOrder.id,
          customerId: workOrder.customerId ?? null,
          authToken: crypto.randomBytes(24).toString('hex'),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          ...authFields,
        },
      });
    }
  } else {
    await prisma.workAuthorization.deleteMany({
      where: { workOrderId: workOrder.id, status: 'pending' },
    });
  }

  if (workOrder.customerId) {
    if (decision.response === 'denied') {
      await prisma.notification.create({
        data: {
          customerId: workOrder.customerId,
          type: 'estimate',
          title: 'You denied this estimate',
          message: 'The quote is closed and no work authorization was created. The shop has been flagged to take a look.',
          workOrderId: workOrder.id,
          deliveryMethod: 'in-app',
        },
      });
      await prisma.notification.create({
        data: {
          customerId: workOrder.customerId,
          type: 'attention',
          title: 'Customer denied an estimate',
          message: 'Needs a look. This flag does not approve, deny, or move the job.',
          workOrderId: workOrder.id,
          deliveryMethod: 'in-app',
          metadata: serializeAttentionFlag(estimateDeniedFlag({
            shopId: workOrder.shopId,
            assignedTechId: workOrder.assignedTechId,
          })),
        },
      });
    } else {
      await prisma.notification.create({
        data: {
          customerId: workOrder.customerId,
          type: 'estimate',
          title: 'You accepted this estimate',
          message: 'Your signature is saved and a work authorization was created. The shop continues the job from the work order.',
          workOrderId: workOrder.id,
          deliveryMethod: 'in-app',
        },
      });
    }
  }

  return {
    ok: true as const,
    newStatus: decision.woStatus,
    authorizationCreated: decision.createAuthorization,
  };
}
