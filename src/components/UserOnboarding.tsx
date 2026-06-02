// User Onboarding Component
// Helps new users understand the application and reduces navigation confusion

'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  FaTimes,
  FaChevronRight,
  FaChevronLeft,
  FaCheck,
  FaLightbulb,
  FaMapMarkerAlt,
  FaBell,
  FaUser
} from 'react-icons/fa';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  target?: string; // CSS selector for highlighting
  action?: string; // What user should do
}

interface UserOnboardingProps {
  userRole: 'customer' | 'tech' | 'manager' | 'admin' | 'shop' | 'superadmin';
  onComplete: () => void;
  onSkip: () => void;
}

export default function UserOnboarding({ userRole, onComplete, onSkip }: UserOnboardingProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const getOnboardingSteps = (role: string): OnboardingStep[] => {
    const commonSteps: OnboardingStep[] = [
      {
        id: 'welcome',
        title: `Welcome to FixTray, ${user?.name || 'User'}!`,
        description: 'Let\'s take a quick tour to help you get started with your account.',
        icon: <FaLightbulb className="w-6 h-6 text-yellow-500" />,
        action: 'Click Next to continue'
      }
    ];

    const roleSpecificSteps: Record<string, OnboardingStep[]> = {
      customer: [
        {
          id: 'navigation',
          title: 'Easy Navigation',
          description: 'Use the top navigation to access your dashboard, orders, vehicles, and messages.',
          icon: <FaMapMarkerAlt className="w-6 h-6 text-red-500" />,
          target: 'nav',
          action: 'Explore the menu items'
        },
        {
          id: 'orders',
          title: 'Track Your Orders',
          description: 'View and manage all your service requests in one place.',
          icon: <FaCheck className="w-6 h-6 text-green-500" />,
          target: '[href="/customer/workorders"]',
          action: 'Click "My Orders" to see your service history'
        },
        {
          id: 'new-order',
          title: 'Request Services',
          description: 'Need help? Create a new service request with just a few clicks.',
          icon: <FaCheck className="w-6 h-6 text-blue-500" />,
          target: '[href="/customer/appointments/new"]',
          action: 'Try creating a new service request'
        },
        {
          id: 'notifications',
          title: 'Stay Updated',
          description: 'Check notifications for updates on your orders and messages.',
          icon: <FaBell className="w-6 h-6 text-purple-500" />,
          target: 'button[aria-label*="notification"]',
          action: 'Click the bell icon to see notifications'
        }
      ],
      tech: [
        {
          id: 'dashboard',
          title: 'Your Tech Dashboard',
          description: 'Monitor your active jobs, time clock, and daily schedule.',
          icon: <FaMapMarkerAlt className="w-6 h-6 text-blue-500" />,
          target: '[href="/tech/home"]',
          action: 'Review your current assignments'
        },
        {
          id: 'time-clock',
          title: 'Time Tracking',
          description: 'Clock in/out and track your work hours automatically.',
          icon: <FaCheck className="w-6 h-6 text-green-500" />,
          target: '[href="/tech/timeclock"]',
          action: 'Check your current clock status'
        },
        {
          id: 'jobs',
          title: 'Manage Jobs',
          description: 'View job details, update status, and communicate with customers.',
          icon: <FaCheck className="w-6 h-6 text-orange-500" />,
          target: '[href="/tech/home"]',
          action: 'Browse your active service calls'
        },
        {
          id: 'navigation',
          title: 'Quick Access',
          description: 'Use the navigation to quickly access maps, messages, and your profile.',
          icon: <FaBell className="w-6 h-6 text-purple-500" />,
          target: 'nav',
          action: 'Explore all available features'
        }
      ],
      manager: [
        {
          id: 'overview',
          title: 'Team Management',
          description: 'Monitor your team\'s performance and manage daily operations.',
          icon: <FaMapMarkerAlt className="w-6 h-6 text-purple-500" />,
          target: '[href="/manager/dashboard"]',
          action: 'Review team metrics and alerts'
        },
        {
          id: 'team',
          title: 'Manage Technicians',
          description: 'Assign jobs, track performance, and handle team communications.',
          icon: <FaUser className="w-6 h-6 text-blue-500" />,
          target: '[href="/manager/team"]',
          action: 'Check your team\'s current status'
        },
        {
          id: 'jobs',
          title: 'Job Oversight',
          description: 'Monitor all service calls and ensure timely completion.',
          icon: <FaCheck className="w-6 h-6 text-green-500" />,
          target: '[href="/manager/assignments"]',
          action: 'Review active and pending jobs'
        },
        {
          id: 'reports',
          title: 'Performance Reports',
          description: 'Access detailed analytics and generate performance reports.',
          icon: <FaCheck className="w-6 h-6 text-orange-500" />,
          target: '[href="/manager/reports"]',
          action: 'Explore available reports'
        }
      ],
      admin: [
        {
          id: 'system',
          title: 'System Administration',
          description: 'Monitor system health, manage users, and configure settings.',
          icon: <FaMapMarkerAlt className="w-6 h-6 text-orange-500" />,
          target: '[href="/admin/dashboard"]',
          action: 'Check system status and alerts'
        },
        {
          id: 'users',
          title: 'User Management',
          description: 'Create, edit, and manage all user accounts and permissions.',
          icon: <FaUser className="w-6 h-6 text-blue-500" />,
          target: '[href="/admin/user-management"]',
          action: 'Review user accounts and roles'
        },
        {
          id: 'security',
          title: 'Security Center',
          description: 'Monitor security events and manage access controls.',
          icon: <FaCheck className="w-6 h-6 text-red-500" />,
          target: '[href="/admin/security-settings"]',
          action: 'Check security status'
        },
        {
          id: 'analytics',
          title: 'System Analytics',
          description: 'View detailed system metrics and performance data.',
          icon: <FaCheck className="w-6 h-6 text-green-500" />,
          target: '[href="/admin/platform-analytics"]',
          action: 'Explore system analytics'
        }
      ],
      shop: [
        {
          id: 'business',
          title: 'Your Shop Dashboard',
          description: 'Monitor your business performance and manage customer relationships.',
          icon: <FaMapMarkerAlt className="w-6 h-6 text-green-500" />,
          target: '[href="/shop/home"]',
          action: 'Review your business metrics'
        },
        {
          id: 'customers',
          title: 'Customer Management',
          description: 'Manage customer information and service history.',
          icon: <FaUser className="w-6 h-6 text-blue-500" />,
          target: '[href="/shop/customers"]',
          action: 'Browse your customer base'
        },
        {
          id: 'jobs',
          title: 'Service Requests',
          description: 'Handle incoming service requests and manage your workflow.',
          icon: <FaCheck className="w-6 h-6 text-orange-500" />,
          target: '[href="/workorders/list"]',
          action: 'Check pending service requests'
        },
        {
          id: 'reviews',
          title: 'Customer Feedback',
          description: 'Monitor reviews and maintain your reputation.',
          icon: <FaCheck className="w-6 h-6 text-yellow-500" />,
          target: '[href="/shop/reviews"]',
          action: 'Read recent customer reviews'
        }
      ],
      superadmin: [
        {
          id: 'enterprise',
          title: 'Enterprise Control',
          description: 'Manage all shops and oversee the entire platform.',
          icon: <FaMapMarkerAlt className="w-6 h-6 text-indigo-500" />,
          target: '[href="/admin/home"]',
          action: 'Review enterprise-wide metrics'
        },
        {
          id: 'infrastructure',
          title: 'Infrastructure Monitoring',
          description: 'Monitor system health across all deployments.',
          icon: <FaCheck className="w-6 h-6 text-green-500" />,
          target: '[href="/superadmin/infrastructure"]',
          action: 'Review system infrastructure'
        },
        {
          id: 'deployments',
          title: 'Release Management',
          description: 'Manage software deployments and updates.',
          icon: <FaCheck className="w-6 h-6 text-purple-500" />,
          target: '[href="/superadmin/deployments"]',
          action: 'Check deployment status'
        }
      ]
    };

    return [...commonSteps, ...(roleSpecificSteps[role] || [])];
  };

  const steps = getOnboardingSteps(userRole);
  const currentStepData = steps[currentStep];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    setIsVisible(false);
    onComplete();
  };

  const handleSkip = () => {
    setIsVisible(false);
    onSkip();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto" style={{background:"rgba(10,16,32,0.95)",border:"1px solid rgba(255,255,255,0.08)"}}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[rgba(255,255,255,0.08)]">
          <div className="flex items-center space-x-3">
            {currentStepData.icon}
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{currentStepData.title}</h2>
              <div className="text-sm text-gray-500">
                Step {currentStep + 1} of {steps.length}
              </div>
            </div>
          </div>
          <button
            onClick={handleSkip}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 mb-6">{currentStepData.description}</p>

          {currentStepData.action && (
            <div className="border rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-3">
                <FaLightbulb className="w-5 h-5 text-blue-500 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-blue-900">What to do next:</div>
                  <div className="text-sm text-blue-700">{currentStepData.action}</div>
                </div>
              </div>
            </div>
          )}

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-xs text-gray-500 mb-2">
              <span>Progress</span>
              <span>{Math.round(((currentStep + 1) / steps.length) * 100)}%</span>
            </div>
            <div className="w-full rounded-full h-2" style={{background:'rgba(255,255,255,0.1)'}}>
              <div
                className="h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%`, background: '#e5332a' }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <button
            onClick={prevStep}
            disabled={currentStep === 0}
            className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <FaChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <div className="flex space-x-2">
            <button
              onClick={handleSkip}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              Skip Tour
            </button>
            <button
              onClick={nextStep}
              className="flex items-center space-x-2 text-white px-4 py-2 rounded-lg transition-colors"
              style={{background:'#e5332a'}}
            >
              <span>{currentStep === steps.length - 1 ? 'Get Started' : 'Next'}</span>
              <FaChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}