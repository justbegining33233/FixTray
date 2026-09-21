/** Human label for a permission key. Never a JSON dump of the permission record. */
export function formatPermissionLabel(permission: string): string {
  return permission
    .split('.')
    .map((part) => part.replace(/[-_]/g, ' ').replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()))
    .join(' · ');
}
