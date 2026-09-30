import { isStaffAttentionMetadata } from './notificationFlags';

/** Shop inventory alerts and staff attention flags are not customer messages. */
export function isCustomerVisibleNotification(notification: {
  type?: string | null;
  title?: string | null;
  metadata?: string | null;
}): boolean {
  const type = String(notification.type || '').toLowerCase();
  const title = String(notification.title || '').toLowerCase();
  if (type.includes('low_stock') || type.includes('inventory')) return false;
  if (title.includes('low stock')) return false;
  if (type === 'attention' || isStaffAttentionMetadata(notification.metadata)) return false;
  return true;
}
