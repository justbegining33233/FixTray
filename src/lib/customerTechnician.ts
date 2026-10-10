export type NamedStaff = {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  role?: string | null;
  clockIn?: string | Date | null;
};

function staffName(person: NamedStaff): string {
  return [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
}

/**
 * The customer sees the assigned technician. A manager who clocked onto the
 * job is not shown as the technician when a tech is also on the job, and a
 * manager-only assignment is not labeled as the technician.
 */
export function customerFacingTechnician(input: {
  assigned?: NamedStaff | null;
  punches?: NamedStaff[] | null;
}): NamedStaff | null {
  const punches = [...(input.punches || [])]
    .filter((person) => String(person.role || '').trim().toLowerCase() === 'tech' && staffName(person))
    .sort((a, b) => new Date(b.clockIn || 0).getTime() - new Date(a.clockIn || 0).getTime());
  if (punches[0]) return punches[0];
  const assignedRole = String(input.assigned?.role || '').trim().toLowerCase();
  if (input.assigned && staffName(input.assigned) && assignedRole === 'tech') return input.assigned;
  return null;
}
