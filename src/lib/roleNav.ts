/**
 * Role-correct targets for shell links that otherwise 403.
 * Shop keeps its own pages. A manager using the shop calendar shell
 * (Switch View / New / footer) is sent to manager-owned surfaces.
 */

export const SHOP_JOBS_HREF = '/shop/jobs';

const MANAGER_SHELL_HREFS: Record<string, string> = {
  '/shop/home': '/manager/dashboard',
  '/shop/jobs': '/manager/assignments',
  '/shop/estimates': '/manager/estimates',
  '/shop/dvi': '/manager/inspections',
  '/shop/work-authorizations': '/manager/work-authorizations',
  '/shop/customer-messages': '/manager/messages',
  '/shop/analytics': '/manager/reports',
  '/shop/admin': '/manager/home',
  '/tech/new-roadside-job': '/shop/new-roadside-job',
};

export function shellHrefForRole(href: string, role?: string | null): string {
  const queryIndex = href.indexOf('?');
  const path = queryIndex === -1 ? href : href.slice(0, queryIndex);
  const query = queryIndex === -1 ? '' : href.slice(queryIndex);

  if (role === 'manager') {
    const mapped = MANAGER_SHELL_HREFS[path];
    if (mapped) return `${mapped}${query}`;
  }

  if (role !== 'tech' && path === '/tech/new-roadside-job') {
    return `/shop/new-roadside-job${query}`;
  }

  return href;
}
