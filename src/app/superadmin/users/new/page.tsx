import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { OWNER_ADD_USER_HREF } from '@/lib/ownerShell';

/** Older New-menu target. The create form lives on user management. */
export default function LegacyAddUserRedirect() {
  redirect(OWNER_ADD_USER_HREF as Route);
}
