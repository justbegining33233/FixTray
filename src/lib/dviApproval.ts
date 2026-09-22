export type DviApprovalStatus = 'pending' | 'approved' | 'rejected';

const NEXT_DUE = /\[\[next:([^\]]+)\]\]/;

export function dviApprovalStatus(row: {
  status?: string | null;
  customerApproved?: boolean | null;
}): DviApprovalStatus {
  const status = String(row.status || '').toLowerCase();
  if (row.customerApproved || status === 'approved' || status === 'passed') return 'approved';
  if (status === 'rejected' || status === 'declined' || status === 'failed') return 'rejected';
  return 'pending';
}

export function readNextInspectionDue(notes: string | null | undefined): string | undefined {
  const match = String(notes || '').match(NEXT_DUE);
  return match?.[1] || undefined;
}

export function notesWithoutNextDue(notes: string | null | undefined): string {
  return String(notes || '').replace(NEXT_DUE, '').trim();
}

export function writeInspectionNotes(input: {
  existing?: string | null;
  rejectionNote?: string | null;
  nextInspectionDue?: string | null;
}): string | null {
  const base = notesWithoutNextDue(input.existing);
  const rejection = String(input.rejectionNote || '').trim();
  const parts = [base, rejection].filter(Boolean);
  if (input.nextInspectionDue) parts.push(`[[next:${input.nextInspectionDue}]]`);
  const notes = parts.join('\n').trim();
  return notes || null;
}

export function vehicleLabel(vehicleDesc: string | null | undefined): { make: string; model: string; licensePlate: string } {
  const label = String(vehicleDesc || '').trim();
  return { make: label || 'Vehicle', model: '', licensePlate: '' };
}
