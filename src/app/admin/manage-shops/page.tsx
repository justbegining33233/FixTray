import { redirect } from 'next/navigation';
import type { Route } from 'next';
import ManageShopsClient from './ManageShopsClient';
import { manageShopsIdRedirect } from '@/lib/ownerShell';

/**
 * A shop id on this URL opens shop details. The list is only the no-id view.
 */
export default async function ManageShopsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.id) ? params.id[0] : params.id;
  const destination = manageShopsIdRedirect(raw);
  if (destination) redirect(destination as Route);
  return <ManageShopsClient />;
}
