export type AppointmentDraft = {
  visitType?: 'in-shop' | 'road-call' | null;
  appointmentDate?: string;
  appointmentTime?: string;
  selectedVehicleId?: string;
  vehicleMake?: string;
  vehicleModel?: string;
};

export function hasAppointmentVehicle(draft: AppointmentDraft): boolean {
  if (draft.selectedVehicleId?.trim()) return true;
  return Boolean(draft.vehicleMake?.trim() && draft.vehicleModel?.trim());
}

/** Reject calendar dates before local today (YYYY-MM-DD). */
export function isAppointmentDateInPast(date: string, now = new Date()): boolean {
  if (!date) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return true;
  const selected = new Date(year, month - 1, day);
  return selected.getTime() < today.getTime();
}

export function canSubmitAppointment(draft: AppointmentDraft, now = new Date()): { ok: boolean; reason?: string } {
  if (draft.visitType === 'in-shop') {
    if (!draft.appointmentDate || !draft.appointmentTime) {
      return { ok: false, reason: 'Choose a date and time for in-shop service.' };
    }
    if (isAppointmentDateInPast(draft.appointmentDate, now)) {
      return { ok: false, reason: 'Appointment date cannot be in the past.' };
    }
  }
  if (!hasAppointmentVehicle(draft)) {
    return { ok: false, reason: 'Select a saved vehicle or enter make and model.' };
  }
  return { ok: true };
}

export function normalizeDateRange(start: string, end: string): { start: string; end: string; reversed: boolean } {
  if (start && end && start > end) return { start: end, end: start, reversed: true };
  return { start, end, reversed: false };
}

export function isScheduledDateInPast(iso: string, now = new Date()): boolean {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return true;
  return parsed.getTime() < now.getTime() - 60_000;
}

/**
 * VIS-019: open appointments stay `scheduled` / `confirmed` until their start
 * time is 15 minutes in the past, then they become `overdue`.
 * Completed, cancelled, and no-show rows are left alone. Overdue is not a
 * guess that the visit happened — the shop or customer still closes it out.
 */
export const APPOINTMENT_OPEN_STATUSES = ['scheduled', 'confirmed'] as const;
export const APPOINTMENT_OVERDUE_GRACE_MS = 15 * 60 * 1000;

export function normalizeAppointmentStatus(status: unknown): string {
  return String(status || '').trim().toLowerCase();
}

export function isAppointmentOverdue(
  status: unknown,
  scheduledDate: Date | string,
  now = new Date()
): boolean {
  const normalized = normalizeAppointmentStatus(status);
  if (!(APPOINTMENT_OPEN_STATUSES as readonly string[]).includes(normalized)) return false;
  const when = scheduledDate instanceof Date ? scheduledDate : new Date(scheduledDate);
  if (Number.isNaN(when.getTime())) return false;
  return when.getTime() < now.getTime() - APPOINTMENT_OVERDUE_GRACE_MS;
}

/** Upcoming means still open and not yet past the overdue grace window. */
export function isUpcomingAppointment(
  status: unknown,
  scheduledDate: Date | string,
  now = new Date()
): boolean {
  const normalized = normalizeAppointmentStatus(status);
  if (!(APPOINTMENT_OPEN_STATUSES as readonly string[]).includes(normalized)) return false;
  return !isAppointmentOverdue(status, scheduledDate, now);
}
