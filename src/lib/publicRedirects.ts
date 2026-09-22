/** Dead marketing and admin aliases. Destinations are pages that already exist. */
export const PUBLIC_AND_ADMIN_REDIRECTS: Array<{ source: string; destination: string; permanent: false }> = [
  { source: '/admin/manage-users', destination: '/admin/user-management', permanent: false },
  { source: '/capabilities', destination: '/features', permanent: false },
  { source: '/help', destination: '/contact', permanent: false },
  { source: '/help-center', destination: '/contact', permanent: false },
  { source: '/docs', destination: '/features', permanent: false },
  { source: '/blog', destination: '/features', permanent: false },
  { source: '/demo', destination: '/contact', permanent: false },
  { source: '/register/shop', destination: '/auth/register/shop', permanent: false },
];
