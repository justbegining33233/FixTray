type OwnerAdminIdentity = {
  id?: string | null;
  username?: string | null;
};

function parseCsvEnv(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function getOwnerAdminIds(): string[] {
  return parseCsvEnv(process.env.OWNER_ADMIN_IDS);
}

function getOwnerAdminUsernames(): string[] {
  const configured = parseCsvEnv(process.env.OWNER_ADMIN_USERNAMES);
  if (configured.length > 0) return configured;
  return ['supadm1006'];
}

export function isOwnerAdmin(identity: OwnerAdminIdentity): boolean {
  const normalizedId = identity.id?.trim().toLowerCase();
  const normalizedUsername = identity.username?.trim().toLowerCase();

  if (normalizedId && getOwnerAdminIds().includes(normalizedId)) {
    return true;
  }

  if (normalizedUsername && getOwnerAdminUsernames().includes(normalizedUsername)) {
    return true;
  }

  return false;
}