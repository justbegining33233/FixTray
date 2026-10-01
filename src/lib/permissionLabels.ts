const COMPOUND_LABELS: Record<string, string> = {
  workorders: 'Work orders',
  workorder: 'Work order',
  timeclock: 'Time clock',
  roadcalls: 'Road calls',
  roadcall: 'Road call',
};

function labelPart(part: string): string {
  const key = part.toLowerCase();
  if (COMPOUND_LABELS[key]) return COMPOUND_LABELS[key];
  const spaced = part.replace(/[-_]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

/** Human label for a permission key. Never a JSON dump of the permission record. */
export function formatPermissionLabel(permission: string): string {
  return permission.split('.').map(labelPart).join(' · ');
}
