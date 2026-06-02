// Dashboard Welcome Component
// Provides role-specific guidance and quick actions to reduce user confusion

'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useAuth } from '@/contexts/AuthContext';
import {
  FaArrowRight,
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
  FaLightbulb,
  FaStar,
  FaUsers,
  FaClipboardList,
  FaChartBar,
  FaCog
} from 'react-icons/fa';

interface DashboardWelcomeProps {
  userRole: 'customer' | 'tech' | 'manager' | 'admin' | 'shop' | 'superadmin';
  userName?: string;
  stats?: {
    activeJobs?: number;
    pendingApprovals?: number;
    unreadMessages?: number;
    urgentAlerts?: number;
  };
}

export default function DashboardWelcome({
  userRole,
  userName,
  stats = {}
}: DashboardWelcomeProps) {
  const { user } = useAuth();
  const [dismissedActions, setDismissedActions] = useState<string[]>([]);

  const getRoleConfig = (role: string) => {
    const configs = {
      customer: {
        greeting: `Welcome back, ${userName || user?.name || 'Customer'}!`,
        subtitle: 'Manage your vehicles and service requests',
        quickActions: [
          {
            title: 'New Service Request',
            description: 'Need help with your vehicle?',
            href: '/customer/appointments/new',
            icon: <FaClipboardList className="w-5 h-5" />,
            color: 'bg-red-500 hover:bg-red-600',
            priority: 'high' as const
          },
          {
            title: 'View My Orders',
            description: 'Check status of your requests',
            href: '/customer/workorders',
            icon: <FaClock className="w-5 h-5" />,
            color: 'bg-[#e5332a]',
            priority: 'high' as const
          },
          {
            title: 'Manage Vehicles',
            description: 'Add or update your vehicles',
            href: '/customer/vehicles',
            icon: <FaCheckCircle className="w-5 h-5" />,
            color: 'bg-green-500 hover:bg-green-600',
            priority: 'medium' as const
          }
        ]
      },
      tech: {
        greeting: `Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, ${userName || user?.name || 'Technician'}!`,
        subtitle: 'Ready to tackle your service calls?',
        quickActions: [
          {
            title: 'Clock In/Out',
            description: 'Start or end your shift',
            href: '/tech/timeclock',
            icon: <FaClock className="w-5 h-5" />,
            color: 'bg-green-500 hover:bg-green-600',
            priority: 'high' as const
          },
          {
            title: 'View My Jobs',
            description: `You have ${stats.activeJobs || 0} active jobs`,
            href: '/tech/work-orders',
            icon: <FaClipboardList className="w-5 h-5" />,
            color: 'bg-[#e5332a]',
            priority: 'high' as const
          },
          {
            title: 'Navigate to Jobs',
            description: 'Get directions to your next call',
            href: '/tech/share-location',
            icon: <FaCheckCircle className="w-5 h-5" />,
            color: 'bg-purple-500 hover:bg-purple-600',
            priority: 'medium' as const
          }
        ]
      },
      manager: {
        greeting: `Hello, ${userName || user?.name || 'Manager'}!`,
        subtitle: 'Monitor your team and operations',
        quickActions: [
          {
            title: 'Team Overview',
            description: 'Check technician status and assignments',
            href: '/manager/team',
            icon: <FaUsers className="w-5 h-5" />,
            color: 'bg-purple-500 hover:bg-purple-600',
            priority: 'high' as const
          },
          {
            title: 'Monitor Jobs',
            description: 'Track all active service calls',
            href: '/manager/assignments',
            icon: <FaClipboardList className="w-5 h-5" />,
            color: 'bg-[#e5332a]',
            priority: 'high' as const
          },
          {
            title: 'View Reports',
            description: 'Access performance analytics',
            href: '/manager/reports',
            icon: <FaChartBar className="w-5 h-5" />,
            color: 'bg-green-500 hover:bg-green-600',
            priority: 'medium' as const
          }
        ]
      },
      admin: {
        greeting: `Welcome, ${userName || user?.name || 'Administrator'}!`,
        subtitle: 'System administration and monitoring',
        quickActions: [
          {
            title: 'System Status',
            description: 'Check system health and alerts',
            href: '/admin/dashboard',
            icon: <FaExclamationTriangle className="w-5 h-5" />,
            color: 'bg-orange-500 hover:bg-orange-600',
            priority: 'high' as const
          },
          {
            title: 'Manage Users',
            description: 'Create and edit user accounts',
            href: '/admin/user-management',
            icon: <FaUsers className="w-5 h-5" />,
            color: 'bg-[#e5332a]',
            priority: 'high' as const
          },
          {
            title: 'Security Center',
            description: 'Monitor security and access',
            href: '/admin/security-settings',
            icon: <FaCheckCircle className="w-5 h-5" />,
            color: 'bg-red-500 hover:bg-red-600',
            priority: 'medium' as const
          }
        ]
      },
      shop: {
        greeting: `Good day, ${userName || user?.name || 'Shop Owner'}!`,
        subtitle: 'Manage your business and customer relationships',
        quickActions: [
          {
            title: 'Business Overview',
            description: 'Check your shop\'s performance',
            href: '/shop/home',
            icon: <FaChartBar className="w-5 h-5" />,
            color: 'bg-green-500 hover:bg-green-600',
            priority: 'high' as const
          },
          {
            title: 'Service Requests',
            description: 'Handle incoming customer requests',
            href: '/shop/home',
            icon: <FaClipboardList className="w-5 h-5" />,
            color: 'bg-[#e5332a]',
            priority: 'high' as const
          },
          {
            title: 'Customer Reviews',
            description: 'Read and respond to feedback',
            href: '/shop/reviews',
            icon: <FaStar className="w-5 h-5" />,
            color: 'bg-yellow-500 hover:bg-yellow-600',
            priority: 'medium' as const
          }
        ]
      },
      superadmin: {
        greeting: `Greetings, ${userName || user?.name || 'Super Admin'}!`,
        subtitle: 'Enterprise platform management',
        quickActions: [
          {
            title: 'Enterprise Overview',
            description: 'Monitor all shops and systems',
            href: '/superadmin/analytics',
            icon: <FaChartBar className="w-5 h-5" />,
            color: 'bg-indigo-500 hover:bg-indigo-600',
            priority: 'high' as const
          },
          {
            title: 'System Infrastructure',
            description: 'Monitor platform health',
            href: '/superadmin/infrastructure',
            icon: <FaCog className="w-5 h-5" />,
            color: 'bg-orange-500 hover:bg-orange-600',
            priority: 'medium' as const
          }
        ]
      }
    };

    return configs[role as keyof typeof configs] || configs.customer;
  };

  const config = getRoleConfig(userRole);
  const visibleActions = config.quickActions.filter(action => !dismissedActions.includes(action.title));

  const dismissAction = (actionTitle: string) => {
    setDismissedActions(prev => [...prev, actionTitle]);
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 mb-6 border border-blue-100">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            {config.greeting}
          </h1>
          <p className="text-gray-600">
            {config.subtitle}
          </p>
        </div>
        <div className="hidden sm:block">
          <FaLightbulb className="w-8 h-8 text-blue-500" />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleActions.map((action) => (
          <Link
            key={action.title}
            href={action.href as Route}
            className="group relative rounded-xl p-4 border transition-all duration-200" style={{background:'rgba(10,16,32,0.68)',border:'1px solid rgba(255,255,255,0.08)'}}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`p-2 rounded-lg ${action.color.replace('hover:', '')} text-white`}>
                {action.icon}
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  dismissAction(action.title);
                }}
                className="opacity-0 group-hover:opacity-100 text-[#64748b] hover:text-[#94a3b8] transition-opacity"
              >
                ×
              </button>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">
              {action.title}
            </h3>
            <p className="text-sm text-[#94a3b8] mb-3">
              {action.description}
            </p>
            <div className="flex items-center text-sm font-medium text-[#e5332a] group-hover:opacity-80">
              <span>Get started</span>
              <FaArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        ))}
      </div>

      {/* Tips Section */}
      <div className="mt-6 pt-6 border-t border-blue-200">
        <div className="flex items-start space-x-3">
          <FaLightbulb className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">Quick Tips</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              {userRole === 'customer' && (
                <>
                  <li>• Use the navigation menu to quickly access your orders and vehicles</li>
                  <li>• Check notifications for updates on your service requests</li>
                  <li>• Add multiple vehicles to streamline future service requests</li>
                </>
              )}
              {userRole === 'tech' && (
                <>
                  <li>• Clock in/out to track your work hours automatically</li>
                  <li>• Use the map feature to navigate efficiently between jobs</li>
                  <li>• Update job status to keep customers informed</li>
                </>
              )}
              {userRole === 'manager' && (
                <>
                  <li>• Monitor team performance through the dashboard metrics</li>
                  <li>• Review pending approvals to keep operations running smoothly</li>
                  <li>• Use reports to identify areas for improvement</li>
                </>
              )}
              {userRole === 'admin' && (
                <>
                  <li>• Monitor system alerts to ensure platform stability</li>
                  <li>• Regularly review user accounts and permissions</li>
                  <li>• Check security logs for any unusual activity</li>
                </>
              )}
              {userRole === 'shop' && (
                <>
                  <li>• Respond promptly to customer reviews to build reputation</li>
                  <li>• Monitor revenue trends to optimize your business</li>
                  <li>• Keep your shop profile updated with current information</li>
                </>
              )}
              {userRole === 'superadmin' && (
                <>
                  <li>• Monitor shop health across all business instances</li>
                  <li>• Review deployment status before major updates</li>
                  <li>• Check enterprise-wide analytics for platform insights</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}