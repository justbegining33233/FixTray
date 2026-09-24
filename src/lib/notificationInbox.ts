/** Bell inbox: which items are still unseen, and how a click maps back to a thread. */

const MESSAGE_ROLES = ['superadmin', 'customer', 'manager', 'shop', 'tech', 'admin'] as const;

export type InboxPrefs = {
  messages?: boolean;
  workOrders?: boolean;
  system?: boolean;
};

export function workOrderNotificationId(workOrderId: string): string {
  return workOrderId.startsWith('wo-') ? workOrderId : `wo-${workOrderId}`;
}

/** Shop, manager, and tech share the same pending-work-order bell items. */
export function showsSyntheticWorkOrderAlerts(role: string): boolean {
  return role === 'shop' || role === 'manager' || role === 'tech';
}

export function isWithinHours(
  createdAt: string | Date | null | undefined,
  hours: number,
  now = Date.now(),
): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  const ageHours = (now - created) / (1000 * 60 * 60);
  return ageHours >= 0 && ageHours < hours;
}

export function recentAlertWorkOrders<T extends { createdAt?: string | Date | null }>(
  orders: T[],
  now = Date.now(),
): T[] {
  return orders.filter((order) => isWithinHours(order.createdAt, 24, now)).slice(0, 3);
}

/** `wo-` id used in the bell. Null when the raw id is empty or unsafe to store. */
export function canonicalWorkOrderAlertId(id: string): string | null {
  const raw = id.startsWith('wo-') ? id.slice(3) : id;
  if (!raw || raw.length > 80 || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  return `wo-${raw}`;
}

export function storedWorkOrderId(alertId: string): string | null {
  const canonical = canonicalWorkOrderAlertId(alertId);
  return canonical ? canonical.slice(3) : null;
}

export function parseMessageNotificationId(id: string): { contactRole: string; contactId: string } | null {
  if (!id.startsWith('msg-')) return null;
  const rest = id.slice(4);
  for (const role of MESSAGE_ROLES) {
    const prefix = `${role}-`;
    if (rest.startsWith(prefix)) {
      const contactId = rest.slice(prefix.length);
      if (contactId) return { contactRole: role, contactId };
    }
  }
  return null;
}

export function preferenceAllows(type: string | undefined, prefs: InboxPrefs): boolean {
  if (!type) return true;
  if (type === 'messages') return prefs.messages !== false;
  if (type === 'workorders' || type === 'workOrders') return prefs.workOrders !== false;
  if (type === 'system') return prefs.system !== false;
  return true;
}

export function visibleInboxItems<T extends { id: string; type?: string; read?: boolean }>(
  items: T[],
  options: {
    prefs: InboxPrefs;
    dismissedWorkOrderIds?: ReadonlySet<string>;
    pendingIds?: ReadonlySet<string>;
  },
): T[] {
  const dismissed = options.dismissedWorkOrderIds;
  const pending = options.pendingIds;
  return items.filter((item) => {
    if (item.read) return false;
    if (pending?.has(item.id)) return false;
    if (item.type === 'workorders' && dismissed?.has(item.id)) return false;
    return preferenceAllows(item.type, options.prefs);
  });
}

const DISMISS_KEY = 'fixtray.dismissedWorkOrderNotifications';
const DISMISS_CAP = 200;

export function readDismissedWorkOrderIds(storage: Pick<Storage, 'getItem'> | null): Set<string> {
  if (!storage) return new Set();
  try {
    const raw = storage.getItem(DISMISS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id) => typeof id === 'string' && id.startsWith('wo-')));
  } catch {
    return new Set();
  }
}

export function rememberDismissedWorkOrderIds(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null,
  ids: string[],
): Set<string> {
  const next = readDismissedWorkOrderIds(storage);
  for (const id of ids) {
    if (id.startsWith('wo-')) next.add(id);
  }
  if (storage) {
    const capped = Array.from(next).slice(-DISMISS_CAP);
    storage.setItem(DISMISS_KEY, JSON.stringify(capped));
    return new Set(capped);
  }
  return next;
}
