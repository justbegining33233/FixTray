// Notification store — backed by the Prisma `notifications` table.
// Functions are async; falls back gracefully if Prisma is unavailable.
import { Notification } from '@/types/customer';
import { sendStatusUpdateSms } from '@/lib/smsService';
import { workOrderNotificationCopy } from './notificationCopy';
import { isCustomerVisibleNotification } from './customerNotifications';

function toDomainNotification(rec: any): Notification {
  return {
    id: rec.id,
    type: rec.type as Notification['type'],
    title: rec.title,
    message: rec.message,
    workOrderId: rec.workOrderId ?? undefined,
    read: rec.read,
    createdAt: new Date(rec.createdAt),
    deliveryMethod: rec.deliveryMethod
      ? rec.deliveryMethod.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [],
  };
}

export async function getNotifications(customerId?: string): Promise<Notification[]> {
  if (!customerId) return [];
  try {
    const prisma = (await import('@/lib/prisma')).default;
    const records = await prisma.notification.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return records.filter(isCustomerVisibleNotification).map(toDomainNotification);
  } catch {
    return [];
  }
}

export async function addNotification(
  customerId: string,
  notification: Omit<Notification, 'id' | 'createdAt'>,
): Promise<Notification> {
  try {
    const prisma = (await import('@/lib/prisma')).default;
    const deliveryStr = Array.isArray(notification.deliveryMethod)
      ? notification.deliveryMethod.join(',')
      : String(notification.deliveryMethod ?? 'in-app');
    const rec = await prisma.notification.create({
      data: {
        customerId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        workOrderId: notification.workOrderId ?? null,
        read: notification.read ?? false,
        deliveryMethod: deliveryStr,
      },
    });
    return toDomainNotification(rec);
  } catch {
    return { ...notification, id: `notif-${Date.now()}`, createdAt: new Date() };
  }
}

export async function markAsRead(customerId: string, notificationId: string): Promise<boolean> {
  try {
    const prisma = (await import('@/lib/prisma')).default;
    await prisma.notification.updateMany({
      where: { id: notificationId, customerId },
      data: { read: true, readAt: new Date() },
    });
    return true;
  } catch { return false; }
}

export async function markAllAsRead(customerId: string): Promise<void> {
  try {
    const prisma = (await import('@/lib/prisma')).default;
    await prisma.notification.updateMany({
      where: { customerId, read: false },
      data: { read: true, readAt: new Date() },
    });
  } catch { /* ignore */ }
}

export async function deleteNotification(customerId: string, notificationId: string): Promise<boolean> {
  try {
    const prisma = (await import('@/lib/prisma')).default;
    await prisma.notification.deleteMany({ where: { id: notificationId, customerId } });
    return true;
  } catch { return false; }
}

// Helper to create work order status notifications
export async function notifyStatusChange(
  customerId: string,
  workOrderId: string,
  oldStatus: string,
  newStatus: string,
  details?: { serviceType?: unknown; issueDescription?: unknown },
) {
  const messages: Record<string, string> = {
    'pending': 'Your work order has been received and is pending assignment.',
    'in-progress': 'Your technician has started working on your vehicle!',
    'waiting-for-payment': 'Work is complete! Please review and submit payment.',
    'closed': 'Your work order has been completed. Thank you!',
    'denied-estimate': 'Your estimate was not approved.',
  };
  const copy = workOrderNotificationCopy({
    id: workOrderId,
    serviceType: details?.serviceType,
    issueDescription: details?.issueDescription,
    status: newStatus,
    kind: 'status',
  });
  await addNotification(customerId, {
    type: 'status_change',
    title: copy.title,
    message: messages[newStatus] || copy.body || `Status changed from ${oldStatus} to ${newStatus}`,
    workOrderId,
    read: false,
    deliveryMethod: ['email', 'sms', 'push'],
  });

  // Send SMS to customer if they have a phone number on file
  try {
    const prisma = (await import('@/lib/prisma')).default;
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { phone: true },
    });
    if (customer?.phone) {
      sendStatusUpdateSms(customer.phone, workOrderId, newStatus).catch(() => {});
    }
  } catch {
    // SMS failure must never break the notification flow
  }
}
