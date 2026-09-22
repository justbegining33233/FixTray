/** Audit text for a user update. Omit fields the request did not send. */
export function describeUserUpdate(input: {
  userType: string;
  role?: unknown;
  status?: unknown;
}): string {
  const parts = [`Type: ${input.userType}`];
  if (typeof input.role === 'string' && input.role.trim()) parts.push(`Role: ${input.role.trim()}`);
  if (typeof input.status === 'string' && input.status.trim()) parts.push(`Status: ${input.status.trim()}`);
  return parts.join(', ');
}

/** Drop placeholder role/status text already stored on older audit rows. */
export function presentAuditDetails(details: unknown): string {
  if (typeof details !== 'string') return '';
  return details
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !/^(Role|Status):\s*(undefined|null)?$/i.test(part))
    .join(', ');
}
