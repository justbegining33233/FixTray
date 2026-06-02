// Breadcrumb Navigation Component
// Helps users understand their current location and navigate back easily

'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { FaHome, FaChevronRight } from 'react-icons/fa';

interface BreadcrumbItem {
  label: string;
  href: string;
  isActive?: boolean;
}

interface BreadcrumbNavigationProps {
  customItems?: BreadcrumbItem[];
  showHome?: boolean;
  className?: string;
}

export default function BreadcrumbNavigation({
  customItems,
  showHome = true,
  className = ''
}: BreadcrumbNavigationProps) {
  const pathname = usePathname();

  const generateBreadcrumbs = (path: string): BreadcrumbItem[] => {
    const segments = path.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [];

    if (showHome) {
      breadcrumbs.push({
        label: 'Home',
        href: '/',
        isActive: path === '/'
      });
    }

    let currentPath = '';

    segments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === segments.length - 1;

      // Format segment labels
      let label = formatSegmentLabel(segment, segments[index - 1]);

      // Special handling for dynamic routes
      if (segment.match(/^\[.*\]$/)) {
        label = 'Details';
      }

      breadcrumbs.push({
        label,
        href: currentPath,
        isActive: isLast
      });
    });

    return breadcrumbs;
  };

  const formatSegmentLabel = (segment: string, _previousSegment?: string): string => {
    // Handle common route patterns
    const labelMap: Record<string, string> = {
      // User roles
      'customer': 'Customer Portal',
      'tech': 'Technician Portal',
      'manager': 'Manager Portal',
      'admin': 'Admin Portal',
      'shop': 'Shop Portal',
      'superadmin': 'Super Admin',

      // Common pages
      'dashboard': 'Dashboard',
      'home': 'Home',
      'profile': 'Profile',
      'settings': 'Settings',
      'orders': 'Orders',
      'jobs': 'Jobs',
      'users': 'Users',
      'team': 'Team',
      'reports': 'Reports',
      'analytics': 'Analytics',
      'messages': 'Messages',
      'vehicles': 'Vehicles',
      'customers': 'Customers',
      'reviews': 'Reviews',
      'schedule': 'Schedule',
      'timeclock': 'Time Clock',
      'map': 'Live Map',
      'approvals': 'Approvals',
      'security': 'Security',
      'system': 'System',
      'database': 'Database',
      'infrastructure': 'Infrastructure',
      'deployments': 'Deployments',
      'revenue': 'Revenue',

      // Actions
      'new': 'New',
      'edit': 'Edit',
      'create': 'Create',
      'list': 'List',
      'view': 'View',

      // Dynamic segments (fallback)
      '[id]': 'Details'
    };

    // Check for exact matches
    if (labelMap[segment]) {
      return labelMap[segment];
    }

    // Handle compound words and camelCase
    const formatted = segment
      .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase to spaces
      .replace(/-/g, ' ') // hyphens to spaces
      .replace(/\b\w/g, l => l.toUpperCase()); // capitalize words

    return formatted;
  };

  const breadcrumbs = customItems || generateBreadcrumbs(pathname);

  if (breadcrumbs.length <= 1) {
    return null; // Don't show breadcrumbs if only home or single item
  }

  return (
    <nav className={`flex items-center space-x-2 text-sm ${className}`} aria-label="Breadcrumb">
      {breadcrumbs.map((item, index) => (
        <div key={item.href} className="flex items-center">
          {index > 0 && (
            <FaChevronRight className="w-3 h-3 text-gray-400 mx-2" />
          )}

          {item.isActive ? (
            <span className="text-gray-900 font-medium" aria-current="page">
              {item.label}
            </span>
          ) : (
            <Link
              href={item.href as Route}
              className="text-gray-600 hover:text-gray-900 transition-colors flex items-center space-x-1"
            >
              {index === 0 && showHome && <FaHome className="w-3 h-3" />}
              <span>{item.label}</span>
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}

// Role-specific breadcrumb generators
export const RoleBreadcrumbs = {
  customer: (pathname: string) => {
    const baseItems: BreadcrumbItem[] = [
      { label: 'Customer Portal', href: '/customer/dashboard' }
    ];

    if (pathname.includes('/orders') || pathname.includes('/workorders')) {
      baseItems.push({ label: 'My Orders', href: '/customer/workorders' });
      if (pathname.includes('/new')) {
        baseItems.push({ label: 'New Service Request', href: '/customer/appointments/new', isActive: true });
      } else if (pathname.includes('/[id]')) {
        baseItems.push({ label: 'Order Details', href: pathname, isActive: true });
      }
    } else if (pathname.includes('/vehicles')) {
      baseItems.push({ label: 'My Vehicles', href: '/customer/vehicles', isActive: true });
    } else if (pathname.includes('/messages')) {
      baseItems.push({ label: 'Messages', href: '/customer/messages', isActive: true });
    } else if (pathname.includes('/favorites')) {
      baseItems.push({ label: 'Favorites', href: '/customer/favorites', isActive: true });
    }

    return baseItems;
  },

  tech: (pathname: string) => {
    const baseItems: BreadcrumbItem[] = [
      { label: 'Technician Portal', href: '/tech/home' }
    ];

    if (pathname.includes('/jobs') || pathname.includes('/work-orders')) {
      baseItems.push({ label: 'My Jobs', href: '/tech/work-orders' });
      if (pathname.includes('/[id]')) {
        baseItems.push({ label: 'Job Details', href: pathname, isActive: true });
      }
    } else if (pathname.includes('/timeclock')) {
      baseItems.push({ label: 'Time Clock', href: '/tech/timeclock', isActive: true });
    } else if (pathname.includes('/share-location')) {
      baseItems.push({ label: 'Live Map', href: '/tech/share-location', isActive: true });
    } else if (pathname.includes('/messages')) {
      baseItems.push({ label: 'Messages', href: '/tech/messages', isActive: true });
    }

    return baseItems;
  },

  manager: (pathname: string) => {
    const baseItems: BreadcrumbItem[] = [
      { label: 'Manager Portal', href: '/manager/home' }
    ];

    if (pathname.includes('/team')) {
      baseItems.push({ label: 'Team Management', href: '/manager/team', isActive: true });
    } else if (pathname.includes('/jobs') || pathname.includes('/assignments')) {
      baseItems.push({ label: 'Job Monitoring', href: '/manager/assignments', isActive: true });
    } else if (pathname.includes('/reports')) {
      baseItems.push({ label: 'Reports', href: '/manager/reports', isActive: true });
    } else if (pathname.includes('/schedule')) {
      baseItems.push({ label: 'Team Schedule', href: '/manager/schedule', isActive: true });
    }

    return baseItems;
  },

  admin: (pathname: string) => {
    const baseItems: BreadcrumbItem[] = [
      { label: 'Admin Portal', href: '/admin/dashboard' }
    ];

    if (pathname.includes('/users')) {
      baseItems.push({ label: 'User Management', href: '/admin/user-management', isActive: true });
    } else if (pathname.includes('/security')) {
      baseItems.push({ label: 'Security Center', href: '/admin/security-settings', isActive: true });
    } else if (pathname.includes('/system')) {
      baseItems.push({ label: 'System Configuration', href: '/admin/system-settings', isActive: true });
    } else if (pathname.includes('/analytics')) {
      baseItems.push({ label: 'System Analytics', href: '/admin/platform-analytics', isActive: true });
    }

    return baseItems;
  },

  shop: (pathname: string) => {
    const baseItems: BreadcrumbItem[] = [
      { label: 'Shop Portal', href: '/shop/home' }
    ];

    if (pathname.includes('/customers')) {
      baseItems.push({ label: 'Customer Management', href: '/shop/customers', isActive: true });
    } else if (pathname.includes('/jobs')) {
      baseItems.push({ label: 'Service Requests', href: '/shop/home', isActive: true });
    } else if (pathname.includes('/reviews')) {
      baseItems.push({ label: 'Customer Reviews', href: '/shop/reviews', isActive: true });
    } else if (pathname.includes('/revenue')) {
      baseItems.push({ label: 'Revenue Reports', href: '/shop/analytics', isActive: true });
    }

    return baseItems;
  },

  superadmin: (pathname: string) => {
    const baseItems: BreadcrumbItem[] = [
      { label: 'Super Admin', href: '/superadmin/analytics' }
    ];

    if (pathname.includes('/infrastructure')) {
      baseItems.push({ label: 'Infrastructure', href: '/superadmin/infrastructure', isActive: true });
    } else if (pathname.includes('/deployments')) {
      baseItems.push({ label: 'Deployments', href: '/superadmin/deployments', isActive: true });
    } else if (pathname.includes('/analytics')) {
      baseItems.push({ label: 'Enterprise Analytics', href: '/superadmin/analytics', isActive: true });
    }

    return baseItems;
  }
};