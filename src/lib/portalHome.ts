/** Role-aware dashboard targets used by shared create/job forms. */
export function portalDashboardHref(role?: string | null): string {
  switch (role) {
    case 'tech':
      return '/tech/home';
    case 'manager':
      return '/manager/home';
    case 'customer':
      return '/customer/dashboard';
    case 'admin':
    case 'superadmin':
      return '/admin/home';
    default:
      return '/shop/admin';
  }
}

export function techJobCreateHref(kind: 'inshop' | 'roadside', role?: string | null): string {
  if (role === 'tech') {
    return kind === 'roadside' ? '/tech/new-roadside-job' : '/tech/new-inshop-job';
  }
  return kind === 'roadside' ? '/workorders/roadside/new' : '/shop/new-inshop-job';
}
