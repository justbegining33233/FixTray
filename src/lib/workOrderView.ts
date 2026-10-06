const RELATION_KEYS = ['customer', 'vehicle', 'assignedTo', 'shop', 'messages'] as const;
const ID_KEYS = ['customerId', 'vehicleId', 'assignedTechId'] as const;

/**
 * A closeout or payment response is the work-order row without relations.
 * Keep the customer, vehicle, and tech already on the page.
 */
export function mergeWorkOrderView<T extends Record<string, unknown>>(
  previous: T | null | undefined,
  update: Record<string, unknown> | null | undefined,
): T | Record<string, unknown> | null | undefined {
  if (!update) return previous;
  if (!previous) return update;
  const next: Record<string, unknown> = { ...previous, ...update };
  for (const key of RELATION_KEYS) {
    if (update[key] == null && previous[key] != null) next[key] = previous[key];
  }
  for (const key of ID_KEYS) {
    if ((update[key] == null || update[key] === '') && previous[key] != null) next[key] = previous[key];
  }
  return next as T;
}
