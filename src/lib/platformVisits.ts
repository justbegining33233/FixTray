/** Website visits, shown beside Emails and limited to that same login. */
export const PLATFORM_VISITS_HREF = '/admin/visits';

export function isPlatformVisitsPath(pathname: string): boolean {
  const path = pathname.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  return path === PLATFORM_VISITS_HREF || path.startsWith(`${PLATFORM_VISITS_HREF}/`);
}
