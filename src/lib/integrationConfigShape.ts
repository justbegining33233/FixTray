/**
 * Integration rows store `enabled` and JSON `settings`.
 * The shop UI historically sent and read `isEnabled` and a settings object,
 * so every card stayed Disabled and Connect stayed unavailable.
 */

export interface IntegrationConfigView {
  id?: string;
  provider: string;
  isEnabled: boolean;
  enabled: boolean;
  settings: Record<string, string>;
  lastSync?: string;
  accountId?: string | null;
}

export function parseIntegrationSettings(settings: unknown): Record<string, string> {
  let value = settings;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      value = JSON.parse(trimmed);
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'string') out[key] = raw;
    else if (typeof raw === 'number' || typeof raw === 'boolean') out[key] = String(raw);
  }
  return out;
}

export function integrationSettingsForStorage(settings: unknown): string | null {
  if (settings == null) return null;
  if (typeof settings === 'string') {
    const trimmed = settings.trim();
    if (!trimmed) return null;
    try {
      return JSON.stringify(parseIntegrationSettings(JSON.parse(trimmed)));
    } catch {
      return trimmed;
    }
  }
  return JSON.stringify(parseIntegrationSettings(settings));
}

export function integrationEnabledFromBody(body: { enabled?: unknown; isEnabled?: unknown }): boolean {
  if (typeof body.enabled === 'boolean') return body.enabled;
  if (typeof body.isEnabled === 'boolean') return body.isEnabled;
  return false;
}

export function integrationWriteFromBody(body: {
  enabled?: unknown;
  isEnabled?: unknown;
  settings?: unknown;
  accountId?: unknown;
}): { enabled: boolean; settings?: string | null; accountId?: string | null } {
  const write: { enabled: boolean; settings?: string | null; accountId?: string | null } = {
    enabled: integrationEnabledFromBody(body),
  };
  if ('settings' in body) write.settings = integrationSettingsForStorage(body.settings);
  if ('accountId' in body) write.accountId = body.accountId == null ? null : String(body.accountId);
  return write;
}

export function normalizeIntegrationConfig(row: {
  id?: string;
  provider?: string;
  enabled?: boolean | null;
  isEnabled?: boolean | null;
  settings?: unknown;
  lastSync?: string | Date | null;
  lastSyncAt?: string | Date | null;
  accountId?: string | null;
}): IntegrationConfigView {
  const isEnabled = row.isEnabled === true || row.enabled === true;
  const sync = row.lastSync ?? row.lastSyncAt ?? undefined;
  const lastSync = sync instanceof Date ? sync.toISOString() : typeof sync === 'string' && sync ? sync : undefined;
  return {
    ...(row.id ? { id: row.id } : {}),
    provider: row.provider || '',
    isEnabled,
    enabled: isEnabled,
    settings: row.provider === 'stripe' ? {} : parseIntegrationSettings(row.settings),
    ...(lastSync ? { lastSync } : {}),
    accountId: row.provider === 'stripe' ? null : (row.accountId ?? null),
  };
}
