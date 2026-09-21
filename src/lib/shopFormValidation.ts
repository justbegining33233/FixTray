export type FormCheck = { ok: true } | { ok: false; error: string };

function text(value: unknown): string {
  return String(value ?? '').trim();
}

export function validateEnvironmentalFee(body: {
  name?: unknown;
  amount?: unknown;
  feeAmount?: unknown;
}): FormCheck {
  const name = text(body.name);
  const amount = Number(body.amount ?? body.feeAmount);
  if (!name) return { ok: false, error: 'Name is required.' };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Amount must be greater than $0.' };
  return { ok: true };
}

export function environmentalFeeAmount(body: { amount?: unknown; feeAmount?: unknown }): number {
  return Number(body.amount ?? body.feeAmount);
}

export function validateLoanerVehicle(body: { make?: unknown; model?: unknown; year?: unknown }, now = new Date()): FormCheck {
  const make = text(body.make);
  const model = text(body.model);
  const year = Number(body.year);
  const maxYear = now.getFullYear() + 1;
  if (!make || !model) return { ok: false, error: 'Make and model are required.' };
  if (!Number.isInteger(year) || year < 1900 || year > maxYear) {
    return { ok: false, error: 'Enter a valid vehicle year.' };
  }
  return { ok: true };
}

export function validateFleetAccount(body: {
  companyName?: unknown;
  contactName?: unknown;
  contactEmail?: unknown;
}): FormCheck {
  const companyName = text(body.companyName);
  const contactName = text(body.contactName);
  const contactEmail = text(body.contactEmail);
  if (!companyName) return { ok: false, error: 'Company name is required.' };
  if (!contactName) return { ok: false, error: 'Contact name is required.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return { ok: false, error: 'A valid contact email is required.' };
  }
  return { ok: true };
}

export function validateDviCreate(body: { vehicleDesc?: unknown; workOrderId?: unknown }): FormCheck {
  if (!text(body.vehicleDesc) && !text(body.workOrderId)) {
    return { ok: false, error: 'Enter a vehicle or choose a work order.' };
  }
  return { ok: true };
}

export function validateInspectionRecord(body: {
  vehicleDesc?: unknown;
  vin?: unknown;
  workOrderId?: unknown;
  inspectionType?: unknown;
  result?: unknown;
}): FormCheck {
  if (!text(body.vehicleDesc) && !text(body.vin) && !text(body.workOrderId)) {
    return { ok: false, error: 'Enter a vehicle, VIN, or work order before recording an inspection.' };
  }
  if (!text(body.inspectionType) || !text(body.result)) {
    return { ok: false, error: 'Inspection type and result are required.' };
  }
  return { ok: true };
}

export function validateWorkOrderTemplate(body: { name?: unknown; serviceType?: unknown }): FormCheck {
  if (!text(body.name) || !text(body.serviceType)) {
    return { ok: false, error: 'Name and service type are required.' };
  }
  return { ok: true };
}

export function validateRecurringSchedule(body: {
  customerId?: unknown;
  title?: unknown;
  issueDescription?: unknown;
  frequency?: unknown;
}): FormCheck {
  if (!text(body.customerId) || !text(body.title) || !text(body.issueDescription) || !text(body.frequency)) {
    return { ok: false, error: 'Customer, title, description, and frequency are required.' };
  }
  return { ok: true };
}

export function validateReferralCreate(body: { referredName?: unknown; rewardValue?: unknown }): FormCheck {
  if (!text(body.referredName)) return { ok: false, error: 'Referred customer name is required.' };
  if (body.rewardValue !== undefined && body.rewardValue !== null && text(body.rewardValue) !== '') {
    const reward = Number(body.rewardValue);
    if (!Number.isFinite(reward) || reward < 0) {
      return { ok: false, error: 'Reward value must be zero or greater.' };
    }
  }
  return { ok: true };
}

export function validateInventoryRequest(body: {
  itemName?: unknown;
  quantity?: unknown;
  reason?: unknown;
}): FormCheck {
  const itemName = text(body.itemName);
  const reason = text(body.reason);
  const quantity = Number(body.quantity);
  if (!itemName) return { ok: false, error: 'Item is required.' };
  if (!Number.isFinite(quantity) || quantity < 1) return { ok: false, error: 'Quantity must be at least 1.' };
  if (!reason) return { ok: false, error: 'Reason is required.' };
  return { ok: true };
}

type PoLine = {
  itemName?: unknown;
  description?: unknown;
  quantity?: unknown;
  qty?: unknown;
  unitCost?: unknown;
};

export function validatePurchaseOrder(body: { vendor?: unknown; items?: PoLine[] | unknown }): FormCheck {
  if (!text(body.vendor)) return { ok: false, error: 'Vendor is required.' };
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return { ok: false, error: 'At least one line item is required.' };
  }
  for (const item of body.items) {
    const name = text(item?.itemName ?? item?.description);
    const quantity = Number(item?.quantity ?? item?.qty);
    const unitCost = Number(item?.unitCost);
    if (!name) return { ok: false, error: 'Each line needs a description.' };
    if (!Number.isFinite(quantity) || quantity < 1) return { ok: false, error: 'Each line needs a quantity of at least 1.' };
    if (!Number.isFinite(unitCost) || unitCost <= 0) return { ok: false, error: 'Each line needs a unit cost greater than $0.' };
  }
  return { ok: true };
}

export function validatePaymentLink(body: {
  amount?: unknown;
  description?: unknown;
  customerName?: unknown;
  customerId?: unknown;
}): FormCheck {
  const amount = Number(body.amount);
  if (!text(body.customerName) && !text(body.customerId)) {
    return { ok: false, error: 'Customer is required.' };
  }
  if (!text(body.description)) return { ok: false, error: 'Description is required.' };
  if (!Number.isFinite(amount) || amount < 0.01) return { ok: false, error: 'Amount must be at least $0.01.' };
  return { ok: true };
}
