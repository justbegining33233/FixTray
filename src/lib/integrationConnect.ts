export function canConnectIntegration(isEnabled: boolean): boolean {
  return isEnabled === true;
}

export function integrationFieldsComplete(
  fields: Array<{ k: string }>,
  values: Record<string, string | undefined>,
): boolean {
  return fields.every((field) => (values[field.k] || '').trim().length > 0);
}
