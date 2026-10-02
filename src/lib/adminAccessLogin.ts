/**
 * Admin Access (/admin/login) signs the platform owner into /admin/home.
 * Usernames stay case-sensitive: the lookup string is trimmed and not folded.
 */

export const ADMIN_HOME_PATH = '/admin/home';

export function adminLoginUsername(username: unknown): string {
  return typeof username === 'string' ? username.trim() : '';
}

export interface AdminAccessPayload {
  token?: string | null;
  accessToken?: string | null;
  id?: string | null;
  username?: string | null;
  isSuperAdmin?: boolean | null;
  isOwner?: boolean | null;
  admin?: {
    id?: string | null;
    username?: string | null;
    isSuperAdmin?: boolean | null;
    isOwner?: boolean | null;
  } | null;
}

export interface AdminAccessSession {
  token: string;
  role: 'admin';
  name: string;
  id: string;
  isSuperAdmin: boolean;
  isOwner: boolean;
  destination: typeof ADMIN_HOME_PATH;
}

/** Session the Admin Access form stores before it opens /admin/home. */
export function adminAccessSession(payload: AdminAccessPayload): AdminAccessSession | null {
  const token = String(payload.token || payload.accessToken || '').trim();
  const id = String(payload.admin?.id || payload.id || '').trim();
  const name = adminLoginUsername(payload.admin?.username || payload.username);
  if (!token || !id || !name) return null;
  return {
    token,
    role: 'admin',
    name,
    id,
    isSuperAdmin: Boolean(payload.admin?.isSuperAdmin ?? payload.isSuperAdmin),
    isOwner: Boolean(payload.admin?.isOwner ?? payload.isOwner),
    destination: ADMIN_HOME_PATH,
  };
}
