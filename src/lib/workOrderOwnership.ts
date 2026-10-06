/**
 * A work order can only be tied to this shop's tech, this shop's customer,
 * and that customer's vehicle.
 */

export function workOrderLinkAllowed(input: {
  shopId: string;
  customerId: string;
  nextCustomerId?: string | null;
  nextVehicleId?: string | null;
  nextTechId?: string | null;
  customer?: { id: string; shopIds: string[] } | null;
  vehicle?: { id: string; customerId: string } | null;
  tech?: { id: string; shopId: string } | null;
}): { ok: true } | { ok: false; error: string } {
  const customerId = input.nextCustomerId || input.customerId;
  if (input.nextCustomerId) {
    if (!input.customer || input.customer.id !== input.nextCustomerId) {
      return { ok: false, error: 'That customer is not on this shop' };
    }
    if (!input.customer.shopIds.includes(input.shopId)) {
      return { ok: false, error: 'That customer is not on this shop' };
    }
  }
  if (input.nextVehicleId) {
    if (!input.vehicle || input.vehicle.id !== input.nextVehicleId) {
      return { ok: false, error: 'That vehicle is not on this job' };
    }
    if (input.vehicle.customerId !== customerId) {
      return { ok: false, error: 'That vehicle belongs to a different customer' };
    }
  }
  if (input.nextTechId) {
    if (!input.tech || input.tech.id !== input.nextTechId || input.tech.shopId !== input.shopId) {
      return { ok: false, error: 'That tech is not on this shop' };
    }
  }
  return { ok: true };
}
