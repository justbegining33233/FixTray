/** Known manager lists an urgent-alert tile can open. Kept as path literals so Next typed routes accept the href. */
export type ManagerAlertRoute =
  | '/manager/assignments'
  | '/manager/dashboard'
  | '/manager/inventory';

/** Where a manager home urgent-alert tile should go. Every known alert has a real list. */
export function managerAlertHref(alertId: string): ManagerAlertRoute {
  switch (alertId) {
    case 'unassigned-jobs':
      return '/manager/assignments';
    case 'overdue-jobs':
      return '/manager/dashboard';
    case 'pending-requests':
    case 'low-inventory':
      return '/manager/inventory';
    default:
      return '/manager/dashboard';
  }
}
