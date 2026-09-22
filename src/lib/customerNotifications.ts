/** Shop inventory alerts are not customer messages, even if an old job wrote them onto a customer row. */
export function isCustomerVisibleNotification(notification: {
  type?: string | null;
  title?: string | null;
}): boolean {
  const type = String(notification.type || '').toLowerCase();
  const title = String(notification.title || '').toLowerCase();
  if (type.includes('low_stock') || type.includes('inventory')) return false;
  if (title.includes('low stock')) return false;
  return true;
}
