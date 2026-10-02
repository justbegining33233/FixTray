export type EnvCheckLike = {
  name: string;
  status: string;
  hint?: string;
};

/** The infrastructure line uses a bullet character. The HTML entity is text. */
export const RUNTIME_BULLET = '•';

export function runtimeStatusText(runtimeLabel: string, uptime: string): string {
  return `Runtime: ${runtimeLabel} ${RUNTIME_BULLET} Uptime: ${uptime}`;
}

/** Warning rows by name. A count with no name is not a warning the staff can act on. */
export function environmentWarnings(checks: EnvCheckLike[] | null | undefined): EnvCheckLike[] {
  if (!Array.isArray(checks)) return [];
  return checks.filter((check) => check.status === 'warning' && String(check.name || '').trim());
}
