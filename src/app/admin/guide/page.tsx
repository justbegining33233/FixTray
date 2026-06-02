'use client';

import { useState, ReactNode } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaArrowRight, FaBell, FaCar, FaCaretDown, FaClock, FaCloud, FaCreditCard, FaCrown, FaEnvelope, FaHardHat, FaInfoCircle, FaMicroscope, FaMobileAlt, FaPencilAlt, FaUserTie, FaWrench } from 'react-icons/fa';

interface Feature {
  name: string;
  description: string;
  status: 'ready' | 'partial' | 'setup-required' | 'not-implemented';
  route?: string;
  notes?: string;
  apiEndpoint?: string;
}

interface FeatureCategory {
  name: string;
  icon: ReactNode;
  description: string;
  features: Feature[];
}

export default function AppGuidePage() {
  const { user, isLoading } = useRequireAuth(['admin']);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const categories: FeatureCategory[] = [
    // ---------------------------------------------
    // AUTHENTICATION & SECURITY
    // ---------------------------------------------
    {
      name: 'Authentication & Security',
      icon: '',
      description: 'User login, registration, and security features  -  all roles',
      features: [
        { name: 'User Login', description: 'Email/password authentication for all user types', status: 'ready', route: '/login', apiEndpoint: '/api/auth/login' },
        { name: 'User Registration', description: 'New user signup with email verification', status: 'ready', route: '/register', apiEndpoint: '/api/auth/register' },
        { name: 'Shop Registration', description: 'Multi-step shop owner registration', status: 'ready', route: '/register/shop', apiEndpoint: '/api/shops/register' },
        { name: 'Customer Registration', description: 'Customer account creation', status: 'ready', route: '/register/customer', apiEndpoint: '/api/customers/register' },
        { name: 'Password Reset', description: 'Forgot password flow with email', status: 'ready', route: '/forgot-password', apiEndpoint: '/api/auth/forgot-password' },
        { name: 'JWT Authentication', description: 'Secure token-based auth', status: 'ready', notes: 'Tokens stored in localStorage' },
        { name: 'CSRF Protection', description: 'Cross-site request forgery prevention', status: 'ready', apiEndpoint: '/api/auth/csrf' },
        { name: 'Rate Limiting', description: 'Brute force protection on login', status: 'ready', notes: 'Built into auth endpoints' },
        { name: 'Session Management', description: 'View and revoke active sessions', status: 'ready', apiEndpoint: '/api/auth/sessions' },
        { name: 'Two-Factor Auth (2FA)', description: 'Additional login security', status: 'ready', route: '/shop/settings/two-factor', apiEndpoint: '/api/auth/2fa/status', notes: 'OTP-based 2FA; generate code via /api/auth/2fa/setup <FaArrowRight style={{marginRight:4}} /> verify with /api/auth/2fa/verify -> disable with /api/auth/2fa/disable' },
      ]
    },
    {
      name: 'Admin Panel - Core',
      icon: <FaCrown style={{marginRight:4}} />,
      description: 'Platform administration and management',
      features: [
        { name: 'Admin Dashboard', description: 'Overview of platform stats', status: 'ready', route: '/admin/home' },
        { name: 'Pending Shop Approvals', description: 'Review and approve new shops', status: 'ready', route: '/admin/pending-shops', apiEndpoint: '/api/shops/pending' },
        { name: 'Manage All Shops', description: 'View and manage approved shops', status: 'ready', route: '/admin/accepted-shops', apiEndpoint: '/api/shops/accepted' },
        { name: 'User Management', description: 'View all users, roles, permissions', status: 'ready', route: '/admin/user-management', apiEndpoint: '/api/admin/users' },
        { name: 'Platform Analytics', description: 'Usage stats and metrics', status: 'ready', route: '/admin/platform-analytics', apiEndpoint: '/api/admin/analytics' },
        { name: 'Activity Logs', description: 'Track user and system activity', status: 'ready', route: '/admin/activity-logs', apiEndpoint: '/api/admin/activity-logs' },
        { name: 'Financial Reports', description: 'Revenue and billing reports', status: 'ready', apiEndpoint: '/api/admin/financial-reports' },
        { name: 'System Settings', description: 'Configure platform settings', status: 'ready', route: '/admin/system-settings', apiEndpoint: '/api/admin/settings' },
      ]
    },
    {
      name: 'Admin Panel - Advanced',
      icon: '',
      description: 'Advanced admin tools and management',
      features: [
        { name: 'Command Center', description: 'Real-time platform monitoring', status: 'ready', route: '/admin/command-center', apiEndpoint: '/api/admin/command-center' },
        { name: 'Email Templates', description: 'Manage system email templates', status: 'ready', route: '/admin/email-templates', apiEndpoint: '/api/admin/email-templates' },
        { name: 'Security Settings', description: 'Configure security policies', status: 'ready', route: '/admin/security-settings', apiEndpoint: '/api/admin/security' },
        { name: 'Backup & Restore', description: 'Database backup management', status: 'ready', route: '/admin/backup-restore', apiEndpoint: '/api/admin/backup' },
        { name: 'Revenue Analytics', description: 'Detailed revenue reporting', status: 'ready', route: '/admin/revenue', apiEndpoint: '/api/admin/revenue' },
        { name: 'Session Management', description: 'Monitor active user sessions', status: 'ready', route: '/admin/sessions', apiEndpoint: '/api/auth/sessions' },
        { name: 'Shop Details', description: 'Detailed shop information and management', status: 'ready', route: '/admin/shop-details/[id]', apiEndpoint: '/api/admin/shops/[id]' },
        { name: 'Manage Customers', description: 'Platform-wide customer management', status: 'ready', route: '/admin/manage-customers', apiEndpoint: '/api/admin/customers' },
      ]
    },
    {
      name: 'Shop Admin Control Center',
      icon: '',
      description: 'Full-featured shop admin panel  -  payroll, budget, team, employee profiles',
      features: [
        { name: 'Shop Admin Dashboard', description: 'Central control center with payroll budget, team clock status, and business overview', status: 'ready', route: '/shop/admin' },
        { name: 'Payroll Center', description: '7-tab payroll system: summaries, employee breakdown, time entries, rate management, overrides, budget tracking, and export', status: 'ready', route: '/shop/payroll', apiEndpoint: '/api/shop/payroll' },
        { name: 'Employee Profiles', description: 'Individual employee detail pages with hours, pay, and performance', status: 'ready', route: '/shop/admin/employee/[id]', apiEndpoint: '/api/shop/team' },
        { name: 'Budget Tracking', description: 'Weekly and monthly payroll budget vs actual spend', status: 'ready', route: '/shop/admin', apiEndpoint: '/api/shop/payroll' },
        { name: 'Admin Settings', description: 'Shop admin configuration panel', status: 'ready', route: '/shop/admin/settings' },
        { name: 'Parts & Labor Management', description: 'Manage parts pricing, labor rates, and markups', status: 'ready', route: '/shop/services', apiEndpoint: '/api/shops/settings' },
        { name: 'Customer Messages (Shop View)', description: 'Manage all customer conversations from the shop side', status: 'ready', route: '/shop/customer-messages', apiEndpoint: '/api/shop/messages' },
        { name: 'Schedule Settings', description: 'Configure shop schedule and availability', status: 'ready', route: '/shop/settings/schedule' },
      ]
    },
    {
      name: 'Shop Management - Core',
      icon: '',
      description: 'Shop owner features and settings',
      features: [
        { name: 'Shop Dashboard', description: 'Shop overview and stats', status: 'ready', route: '/shop/home' },
        { name: 'Shop Profile', description: 'Edit shop info, hours, logo', status: 'ready', route: '/shop/settings', apiEndpoint: '/api/shop/profile' },
        { name: 'Service Catalog', description: 'Manage services offered', status: 'ready', route: '/shop/services', apiEndpoint: '/api/shops/services' },
        { name: 'Labor Rates', description: 'Set hourly labor rates', status: 'ready', route: '/shop/services', apiEndpoint: '/api/shops/labor-rates' },
        { name: 'Team Management', description: 'Add/manage technicians', status: 'ready', route: '/shop/manage-team', apiEndpoint: '/api/shop/team' },
        { name: 'Manager Role', description: 'Assign manager permissions', status: 'ready', apiEndpoint: '/api/manager/dashboard' },
        { name: 'Work Assignments', description: 'Assign jobs to technicians', status: 'ready', apiEndpoint: '/api/manager/assignments' },
        { name: 'Shop Settings', description: 'Configure shop preferences', status: 'ready', route: '/shop/settings', apiEndpoint: '/api/shop/settings' },
        { name: 'Business Hours / Schedule', description: 'Set operating hours and availability', status: 'ready', route: '/shop/settings/schedule' },
        { name: 'Multiple Locations', description: 'Manage multiple shop locations', status: 'ready', route: '/shop/locations', apiEndpoint: '/api/shop/locations' },
        { name: 'New In-Shop Job (Shop Role)', description: 'Create in-shop work orders directly from the shop dashboard', status: 'ready', route: '/shop/new-inshop-job', apiEndpoint: '/api/workorders' },
      ]
    },
    {
      name: 'Shop Management - Business',
      icon: '',
      description: 'Business operations and management',
      features: [
        { name: 'Shop Analytics', description: 'Business performance metrics', status: 'ready', route: '/shop/analytics', apiEndpoint: '/api/shop/stats' },
        { name: 'Financial Summary', description: 'Revenue and expense tracking', status: 'ready', apiEndpoint: '/api/shop/financial-summary' },
        { name: 'Customer Reports', description: 'Customer analytics and insights', status: 'ready', route: '/shop/customer-reports', apiEndpoint: '/api/shop/customer-reports' },
        { name: 'Work Order Stats', description: 'Job completion analytics', status: 'ready', apiEndpoint: '/api/shop/workorder-stats' },
        { name: 'Team Performance', description: 'Technician productivity metrics', status: 'ready', apiEndpoint: '/api/shop/team-performance' },
        { name: 'Recent Activity', description: 'Recent shop activities feed', status: 'ready', apiEndpoint: '/api/shop/recent-activity' },
        { name: 'Urgent Alerts', description: 'Critical notifications and alerts', status: 'ready', apiEndpoint: '/api/shop/urgent-alerts' },
        { name: 'Complete Profile Setup', description: 'Initial shop profile completion', status: 'ready', route: '/shop/complete-profile' },
      ]
    },
    {
      name: 'Shop Management - Operations',
      icon: '',
      description: 'Day-to-day shop operations',
      features: [
        { name: 'Inventory Management', description: 'Parts and supplies tracking', status: 'ready', route: '/shop/inventory', apiEndpoint: '/api/inventory' },
        { name: 'Vendor Management', description: 'Manage parts suppliers', status: 'ready', route: '/shop/vendors', apiEndpoint: '/api/shop/vendors' },
        { name: 'Purchase Orders', description: 'Order parts and supplies', status: 'ready', route: '/shop/purchase-orders', apiEndpoint: '/api/shop/purchase-orders' },
        { name: 'Payroll Management', description: 'Employee payroll processing', status: 'ready', route: '/shop/payroll', apiEndpoint: '/api/shop/payroll' },
        { name: 'Team Schedule', description: 'Staff scheduling and shifts', status: 'ready', apiEndpoint: '/api/shop/team-schedule' },
        { name: 'Work Authorizations', description: 'Customer work approvals', status: 'ready', route: '/shop/work-authorizations', apiEndpoint: '/api/work-authorizations' },
        { name: 'Waiting Room', description: 'Customer waiting area management', status: 'ready', route: '/shop/waiting-room', apiEndpoint: '/api/waiting-room' },
        { name: 'Recurring Work Orders', description: 'Scheduled maintenance jobs', status: 'ready', route: '/shop/recurring-workorders', apiEndpoint: '/api/recurring-workorders' },
      ]
    },
    {
      name: 'Shop Management - Specialized',
      icon: <FaMicroscope style={{marginRight:4}} />,
      description: 'Specialized shop services and features',
      features: [
        { name: 'AR Aging Reports', description: 'Accounts receivable aging', status: 'ready', route: '/shop/ar-aging', apiEndpoint: '/api/ar-aging' },
        { name: 'Condition Reports', description: 'Vehicle condition assessments', status: 'ready', route: '/shop/condition-reports', apiEndpoint: '/api/condition-reports' },
        { name: 'Core Returns', description: 'Parts core return tracking', status: 'ready', route: '/shop/core-returns', apiEndpoint: '/api/core-returns' },
        { name: 'DVI (Damage Vehicle Inspection)', description: 'Vehicle damage documentation', status: 'ready', route: '/shop/dvi', apiEndpoint: '/api/dvi' },
        { name: 'Environmental Fees', description: 'Environmental compliance fees', status: 'ready', route: '/shop/environmental-fees', apiEndpoint: '/api/environmental-fees' },
        { name: 'Fleet Management', description: 'Commercial fleet services', status: 'ready', route: '/shop/fleet', apiEndpoint: '/api/fleet' },
        { name: 'Loaners', description: 'Loaner vehicle management', status: 'ready', route: '/shop/loaners', apiEndpoint: '/api/loaners' },
        { name: 'State Inspections', description: 'Vehicle state inspection services', status: 'ready', route: '/shop/inspections', apiEndpoint: '/api/state-inspections' },
        { name: 'Tax Settings', description: 'Tax rate configuration', status: 'ready', route: '/shop/tax-settings', apiEndpoint: '/api/tax-rules' },
        { name: 'Profit Margins', description: 'Service profitability analysis', status: 'ready', route: '/shop/profit-margins', apiEndpoint: '/api/profit-margins' },
      ]
    },
    {
      name: 'Shop Management - Integrations',
      icon: '',
      description: 'Third-party integrations and automations',
      features: [
        { name: 'Automations', description: 'Workflow automation rules', status: 'ready', route: '/shop/automations', apiEndpoint: '/api/automations' },
        { name: 'Integrations', description: 'Third-party service connections', status: 'ready', route: '/shop/integrations', apiEndpoint: '/api/integrations' },
        { name: 'Referrals', description: 'Customer referral program', status: 'ready', route: '/shop/referrals', apiEndpoint: '/api/referrals' },
        { name: 'Ops Overview', description: 'Shop operations overview and bay activity', status: 'ready', route: '/shop/home', apiEndpoint: '/api/workorders' },
        { name: 'Distributors', description: 'Parts distributor management', status: 'ready', route: '/shop/distributors', apiEndpoint: '/api/shop/vendors' },
      ]
    },
    {
      name: 'Work Orders - Core',
      icon: '',
      description: 'Create and manage repair orders',
      features: [
        { name: 'Create Work Order', description: 'New work order with customer/vehicle', status: 'ready', route: '/workorders/new', apiEndpoint: '/api/workorders' },
        { name: 'Work Order List', description: 'View all work orders with filters and search', status: 'ready', route: '/workorders/list', apiEndpoint: '/api/workorders' },
        { name: 'In-Shop Work Orders', description: 'Dedicated in-shop repair order view', status: 'ready', route: '/workorders/inshop', apiEndpoint: '/api/workorders' },
        { name: 'Work Order Details', description: 'Full order details and editing', status: 'ready', route: '/workorders/[id]' },
        { name: 'Status Updates', description: 'Change order status (pending, in-progress, complete)', status: 'ready', apiEndpoint: '/api/workorders/[id]' },
        { name: 'Photo Uploads', description: 'Attach before/after photos', status: 'ready', apiEndpoint: '/api/workorders/[id]/photos' },
        { name: 'Add Line Items', description: 'Parts, labor, fees', status: 'ready', notes: 'Included in work order creation' },
        { name: 'Invoice Generation', description: 'Create invoice from work order', status: 'ready', apiEndpoint: '/api/workorders/[id]/invoice' },
        { name: 'Payment Processing', description: 'Record payments on orders', status: 'ready', apiEndpoint: '/api/workorders/payment' },
        { name: 'Print Work Order', description: 'Print-friendly work order view', status: 'ready', notes: 'Print-optimized layout with CSS @media print' },
        { name: 'Work Order Templates', description: 'Save common job templates', status: 'ready', route: '/shop/services', apiEndpoint: '/api/shop/templates' },
      ]
    },
    {
      name: 'Technician Tools - Core',
      icon: '',
      description: 'Field technician tools and features',
      features: [
        { name: 'Tech Dashboard', description: 'Technician overview and assignments', status: 'ready', route: '/tech/home' },
        { name: 'New Roadside Job', description: 'Create roadside assistance work order', status: 'ready', route: '/tech/new-roadside-job', apiEndpoint: '/api/workorders' },
        { name: 'New In-Shop Job', description: 'Create in-shop repair work order', status: 'ready', route: '/tech/new-inshop-job', apiEndpoint: '/api/workorders' },
        { name: 'Share Location', description: 'GPS location sharing for customer tracking', status: 'ready', route: '/tech/share-location', apiEndpoint: '/api/tech/tracking' },
        { name: 'Time Clock', description: 'Clock in/out and time tracking', status: 'ready', route: '/tech/timesheet', apiEndpoint: '/api/timeclock' },
        { name: 'Active Jobs', description: 'View current work assignments', status: 'ready', route: '/tech/active-jobs' },
        { name: 'Job History', description: 'Past completed work orders', status: 'ready', route: '/tech/job-history' },
        { name: 'Customer Portal', description: 'Access customer information', status: 'ready', route: '/tech/customers' },
      ]
    },
    {
      name: 'Technician Tools - Advanced',
      icon: '',
      description: 'Advanced technician diagnostic and service tools',
      features: [
        { name: 'All Tools Dashboard', description: 'Complete technician toolkit', status: 'ready', route: '/tech/all-tools' },
        { name: 'Diagnostics', description: 'Vehicle diagnostic tools', status: 'ready', route: '/tech/diagnostics', apiEndpoint: '/api/dtc-lookup' },
        { name: 'DTC Lookup', description: 'Diagnostic trouble code lookup', status: 'ready', route: '/tech/dtc-lookup', apiEndpoint: '/api/dtc-lookup' },
        { name: 'Service Manuals', description: 'Access service manuals', status: 'ready', route: '/tech/manuals' },
        { name: 'Photo Upload', description: 'Upload work order photos', status: 'ready', route: '/tech/photos', apiEndpoint: '/api/photos' },
        { name: 'Inventory Access', description: 'Check parts availability', status: 'ready', route: '/tech/inventory', apiEndpoint: '/api/inventory' },
        { name: 'Messages', description: 'Communicate with shop and customers', status: 'ready', route: '/tech/messages', apiEndpoint: '/api/messages' },
      ]
    },
    {
      name: 'Customer Portal - Core',
      icon: '',
      description: 'Customer account and service management',
      features: [
        { name: 'Customer Dashboard', description: 'Overview of orders and vehicles', status: 'ready', route: '/customer/dashboard' },
        { name: 'Find Shops', description: 'Search and browse auto shops', status: 'ready', route: '/customer/findshops', apiEndpoint: '/api/customers/shops' },
        { name: 'Favorite Shops', description: 'Save preferred shops', status: 'ready', route: '/customer/favorites', apiEndpoint: '/api/customers/favorites' },
        { name: 'Shop Profile View', description: 'Customer-facing shop detail page with services, reviews, and booking', status: 'ready', route: '/customer/shop/[id]' },
        { name: 'View Work Orders', description: 'See order status and history', status: 'ready', route: '/customer/workorders' },
        { name: 'Manage Vehicles', description: 'Add/edit vehicles', status: 'ready', route: '/customer/vehicles' },
        { name: 'Service History', description: 'Past service records', status: 'ready', route: '/customer/history' },
        { name: 'Documents', description: 'Access service documents', status: 'ready', route: '/customer/documents', apiEndpoint: '/api/customers/documents' },
        { name: 'Messages', description: 'Chat with shops', status: 'ready', route: '/customer/messages', apiEndpoint: '/api/customers/messages' },
      ]
    },
    {
      name: 'Customer Portal - Services',
      icon: '',
      description: 'Customer service requests and management',
      features: [
        { name: 'Online Booking', description: 'Schedule appointments online', status: 'ready', route: '/customer/appointments', apiEndpoint: '/api/appointments' },
        { name: 'Service Estimates', description: 'Request and view estimates', status: 'ready', route: '/customer/estimates', apiEndpoint: '/api/customers/estimates' },
        { name: 'Recurring Approvals', description: 'Manage recurring service approvals', status: 'ready', route: '/customer/recurring-approvals', apiEndpoint: '/api/customers/recurring-approvals' },
        { name: 'Payment History', description: 'View past payments', status: 'ready', route: '/customer/payments', apiEndpoint: '/api/customers/payments' },
        { name: 'Pay Online', description: 'Pay invoices online', status: 'setup-required', notes: 'Requires Stripe configuration' },
        { name: 'Technician Tracking', description: 'Track tech location on mobile jobs', status: 'ready', apiEndpoint: '/api/customers/tracking' },
        { name: 'Reviews & Ratings', description: 'Rate and review services', status: 'ready', route: '/customer/reviews', apiEndpoint: '/api/reviews' },
        { name: 'Rewards Program', description: 'Loyalty rewards and points', status: 'ready', route: '/customer/rewards' },
      ]
    },
    {
      name: 'Customer Portal - Insights',
      icon: '',
      description: 'Customer analytics and insights',
      features: [
        { name: 'Service Insights', description: 'Personal service analytics', status: 'ready', route: '/customer/insights' },
        { name: 'Features Overview', description: 'Available platform features', status: 'ready', route: '/customer/features' },
        { name: 'Home Dashboard', description: 'Customer home page', status: 'ready', route: '/customer/home' },
        { name: 'Overview', description: 'Account overview and summary', status: 'ready', route: '/customer/overview' },
        { name: 'Authorization', description: 'Service authorization management', status: 'ready', route: '/customer/authorization' },
      ]
    },
    {
      name: 'Manager Dashboard',
      icon: <FaUserTie style={{marginRight:4}} />,
      description: 'Team management and oversight features',
      features: [
        { name: 'Manager Home', description: 'Manager landing page with quick actions', status: 'ready', route: '/manager/home' },
        { name: 'Manager Dashboard', description: 'Team oversight and full management panel', status: 'ready', route: '/manager/dashboard' },
        { name: 'Manager Assignments', description: 'Assign work to team members', status: 'ready', route: '/manager/assignments', apiEndpoint: '/api/manager/assignments' },
        { name: 'Manager Estimates', description: 'Create and manage estimates for customers', status: 'ready', route: '/manager/estimates', apiEndpoint: '/api/manager/estimates' },
        { name: 'Performance Monitoring', description: 'Track team performance', status: 'ready', apiEndpoint: '/api/manager/performance' },
        { name: 'Schedule Management', description: 'Manage team schedules', status: 'ready', apiEndpoint: '/api/manager/schedule' },
      ]
    },
    {
      name: 'Time Tracking & Payroll',
      icon: <FaClock style={{marginRight:4}} />,
      description: 'Employee time and payroll management',
      features: [
        { name: 'Clock In/Out', description: 'Technician time clock', status: 'ready', route: '/tech/timesheet', apiEndpoint: '/api/timeclock' },
        { name: 'Time Entries', description: 'View and edit time records', status: 'ready', apiEndpoint: '/api/time-tracking' },
        { name: 'GPS Verification', description: 'Location-based clock in', status: 'ready', apiEndpoint: '/api/time-tracking' },
        { name: 'Payroll Reports', description: 'Generate payroll summaries', status: 'ready', apiEndpoint: '/api/shop/payroll' },
        { name: 'Overtime Calculation', description: 'Auto-calculate overtime', status: 'ready', notes: 'Based on time entries' },
        { name: 'Export Payroll', description: 'Export for accounting', status: 'ready', notes: 'CSV and XLS export available' },
      ]
    },
    {
      name: 'Inventory Management',
      icon: '',
      description: 'Parts and inventory tracking',
      features: [
        { name: 'Inventory List', description: 'View all inventory items', status: 'ready', route: '/shop/inventory', apiEndpoint: '/api/inventory' },
        { name: 'Add Inventory', description: 'Add new parts/items', status: 'ready', apiEndpoint: '/api/inventory' },
        { name: 'Low Stock Alerts', description: 'Notifications for low stock', status: 'ready', apiEndpoint: '/api/inventory/low-stock' },
        { name: 'Inventory Requests', description: 'Request parts from admin', status: 'ready', apiEndpoint: '/api/shop/inventory-requests' },
        { name: 'Stock Adjustments', description: 'Adjust quantities manually', status: 'ready', apiEndpoint: '/api/shop/inventory-stock' },
        { name: 'Reorder Points', description: 'Set auto-reorder levels', status: 'ready', notes: 'reorderPoint field on InventoryPart' },
        { name: 'Barcode Scanning', description: 'Scan parts with barcode', status: 'ready', notes: 'BarcodeScanner component uses native BarcodeDetector API' },
        { name: 'Vendor Management', description: 'Manage parts suppliers', status: 'ready', route: '/shop/vendors', apiEndpoint: '/api/shop/vendors' },
      ]
    },
    {
      name: 'Messaging & Notifications',
      icon: '',
      description: 'Communication features',
      features: [
        { name: 'In-App Messaging', description: 'Shop-to-customer messaging', status: 'ready', apiEndpoint: '/api/messages' },
        { name: 'Customer Chat', description: 'Real-time chat with customers', status: 'ready', apiEndpoint: '/api/customers/messages' },
        { name: 'Portal Chat', description: 'Customer portal messaging', status: 'ready', apiEndpoint: '/api/portal-chat' },
        { name: 'In-App Notifications', description: 'Bell icon notifications', status: 'ready', apiEndpoint: '/api/notifications' },
        { name: 'Push Notifications', description: 'Browser push notifications', status: 'setup-required', apiEndpoint: '/api/push/subscribe', notes: 'Requires VAPID keys setup' },
        { name: 'Email Notifications', description: 'Email alerts for updates', status: 'setup-required', notes: 'Requires email service (SendGrid, etc.)' },
        { name: 'SMS Notifications', description: 'Text message alerts', status: 'setup-required', notes: 'Requires Twilio setup' },
      ]
    },
    {
      name: 'Appointments & Scheduling',
      icon: '',
      description: 'Booking and calendar features',
      features: [
        { name: 'Appointment Booking', description: 'Schedule appointments', status: 'ready', apiEndpoint: '/api/appointments' },
        { name: 'Available Slots', description: 'Define available time slots', status: 'ready', notes: 'Based on business hours' },
        { name: 'Appointment Reminders', description: 'Auto-remind customers', status: 'ready', apiEndpoint: '/api/cron/appointment-reminders' },
        { name: 'Calendar View', description: 'View appointments on calendar', status: 'ready', route: '/shop/calendar' },
        { name: 'Recurring Appointments', description: 'Set up repeat bookings', status: 'ready', route: '/shop/appointments/recurring', apiEndpoint: '/api/appointments/recurring' },
      ]
    },
    {
      name: 'Reviews & Ratings',
      icon: '',
      description: 'Customer feedback system',
      features: [
        { name: 'Submit Reviews', description: 'Customers leave reviews', status: 'ready', apiEndpoint: '/api/reviews' },
        { name: 'View Reviews', description: 'Shop can see their reviews', status: 'ready', route: '/shop/reviews' },
        { name: 'Review Moderation', description: 'Admin can moderate reviews', status: 'ready', notes: 'Via admin panel' },
        { name: 'Rating Analytics', description: 'Average ratings and trends', status: 'ready', notes: 'Part of shop analytics' },
        { name: 'Review Responses', description: 'Shop can respond to reviews', status: 'ready', route: '/shop/reviews', apiEndpoint: '/api/reviews/[id]' },
      ]
    },
    {
      name: 'Payments & Invoicing',
      icon: '',
      description: 'Payment processing and invoice workflows',
      features: [
        { name: 'Stripe Integration', description: 'Credit card payments', status: 'setup-required', apiEndpoint: '/api/payment/create-intent', notes: 'Requires Stripe API keys' },
        { name: 'Account Tiers', description: 'Legacy tier configuration endpoint', status: 'not-implemented' },
        { name: 'Payment Recording', description: 'Record cash/check payments', status: 'ready', notes: 'Manual payment entry' },
        { name: 'Invoice Creation', description: 'Generate customer invoices', status: 'ready', apiEndpoint: '/api/workorders/[id]/invoice' },
        { name: 'Refunds', description: 'Process refunds', status: 'setup-required', notes: 'Requires Stripe setup' },
        { name: 'Payment History', description: 'View past transactions', status: 'ready', notes: 'Available in customer profile' },
      ]
    },
    {
      name: 'Reports & Analytics',
      icon: '',
      description: 'Business intelligence features',
      features: [
        { name: 'Work Order Analytics', description: 'Job completion metrics', status: 'ready', apiEndpoint: '/api/analytics' },
        { name: 'Revenue Reports', description: 'Income and sales data', status: 'ready', route: '/shop/analytics' },
        { name: 'Technician Performance', description: 'Tech productivity metrics', status: 'ready', notes: 'Based on work order completion' },
        { name: 'Customer Reports', description: 'Customer acquisition and retention', status: 'ready', route: '/shop/customer-reports', apiEndpoint: '/api/shop/customer-reports' },
        { name: 'Export to CSV', description: 'Download reports as CSV', status: 'ready', apiEndpoint: '/api/admin/export' },
        { name: 'Custom Date Ranges', description: 'Filter by date range', status: 'ready', notes: 'Available on most reports' },
      ]
    },
    {
      name: 'File Uploads & Storage',
      icon: '',
      description: 'File management features',
      features: [
        { name: 'Image Uploads', description: 'Upload photos to work orders', status: 'ready', apiEndpoint: '/api/upload' },
        { name: 'Document Storage', description: 'Store PDFs and documents', status: 'ready', apiEndpoint: '/api/customers/documents' },
        { name: 'Cloudinary Integration', description: 'Cloud image storage', status: 'setup-required', notes: 'Requires Cloudinary API keys' },
        { name: 'Local File Storage', description: 'Store files on server', status: 'ready', notes: 'Default storage method' },
      ]
    },
    {
      name: 'System & Infrastructure',
      icon: '',
      description: 'Technical system features',
      features: [
        { name: 'Health Check Endpoint', description: 'API health monitoring', status: 'ready', apiEndpoint: '/api/health' },
        { name: 'Neon (Postgres)', description: 'Production & development database', status: 'ready', notes: 'Set DATABASE_URL to your Neon connection string' },
        { name: 'PostgreSQL Support', description: 'Production database option', status: 'ready', notes: 'Using Neon' },
        { name: 'Audit Logging', description: 'Track system changes', status: 'ready', apiEndpoint: '/api/admin/audit-logs' },
        { name: 'Backup & Restore', description: 'Database backups', status: 'ready', route: '/admin/backup-restore', apiEndpoint: '/api/admin/backup' },
        { name: 'Docker Support', description: 'Container deployment', status: 'ready', notes: 'Dockerfile included' },
      ]
    },
    // ---------------------------------------------
    // ADMIN  -  DATA, EXPORT & REPORTING
    // ---------------------------------------------
    {
      name: 'Admin  -  Data & Export',
      icon: '',
      description: 'Admin-level data exports, performance, and usage reporting',
      features: [
        { name: 'Platform Stats', description: 'High-level platform-wide stats (users, shops, revenue)', status: 'ready', apiEndpoint: '/api/admin/stats' },
        { name: 'Performance Reports', description: 'Admin performance dashboards across shops', status: 'ready', apiEndpoint: '/api/admin/performance' },
        { name: 'Admin Usage Reports', description: 'Track feature usage across the platform', status: 'ready', apiEndpoint: '/api/admin/usage' },
        { name: 'Client Data Export', description: 'Export all client data for compliance or migration', status: 'ready', apiEndpoint: '/api/admin/clients/export' },
        { name: 'Full Platform Export', description: 'General data export endpoint', status: 'ready', apiEndpoint: '/api/admin/export' },
        { name: 'Pageview Analytics', description: 'Track page and feature usage analytics', status: 'ready', apiEndpoint: '/api/analytics/pageview' },
        { name: 'Global Activity Log', description: 'Platform-wide audit trail (separate from per-shop)', status: 'ready', apiEndpoint: '/api/activity-logs' },
      ]
    },
    // ---------------------------------------------
    // SHOP SCHEDULE & AVAILABILITY
    // ---------------------------------------------
    {
      name: 'Shop Schedule & Availability',
      icon: '',
      description: 'Configure shop schedule, blocked dates, and customer-facing availability',
      features: [
        { name: 'Shop Schedule Config', description: 'Set working hours and days per shop', status: 'ready', route: '/shop/settings/schedule', apiEndpoint: '/api/shop/schedule' },
        { name: 'Blocked Dates', description: 'Block out holidays, closures, and special dates', status: 'ready', apiEndpoint: '/api/shop/schedule/blocked-dates' },
        { name: 'Customer Availability Check', description: 'Customer-facing endpoint to check open appointment slots', status: 'ready', apiEndpoint: '/api/customers/shops/[id]/availability' },
        { name: 'Team Schedule View', description: 'View team members scheduled hours', status: 'ready', apiEndpoint: '/api/shop/team-schedule' },
        { name: 'Schedule Management (Manager)', description: 'Manager can adjust team schedules', status: 'ready', apiEndpoint: '/api/manager/schedule' },
      ]
    },
    // ---------------------------------------------
    // TECH MANAGEMENT (SHOP/ADMIN)
    // ---------------------------------------------
    {
      name: 'Tech Management (Shop/Admin)',
      icon: <FaHardHat style={{marginRight:4}} />,
      description: 'Manage technician profiles, assignments, and tracking from shop or admin level',
      features: [
        { name: 'List Technicians', description: 'View all technicians across a shop', status: 'ready', apiEndpoint: '/api/techs' },
        { name: 'Technician Profile', description: 'Individual tech profile with stats and performance', status: 'ready', apiEndpoint: '/api/techs/[id]' },
        { name: 'Assign Technician', description: 'Assign a technician to a work order', status: 'ready', apiEndpoint: '/api/techs/assign' },
        { name: 'Clock Status Monitoring', description: 'See who is currently clocked in', status: 'ready', apiEndpoint: '/api/timeclock/status' },
        { name: 'Tech DVI Forms', description: 'Technician digital vehicle inspection forms', status: 'ready', route: '/tech/dvi', apiEndpoint: '/api/dvi' },
      ]
    },
    // ---------------------------------------------
    // PAYROLL SYSTEM  -  ADVANCED
    // ---------------------------------------------
    {
      name: 'Payroll System  -  Advanced',
      icon: '',
      description: 'Full enterprise payroll: pay periods, paystubs, leave, overtime, and scheduling',
      features: [
        { name: 'Pay Periods', description: 'Define weekly/biweekly/monthly pay periods', status: 'ready', apiEndpoint: '/api/payroll/pay-periods' },
        { name: 'Pay Period Details', description: 'View/edit individual pay period records', status: 'ready', apiEndpoint: '/api/payroll/pay-periods/[id]' },
        { name: 'Paystubs', description: 'Generate and store employee paystubs', status: 'ready', apiEndpoint: '/api/payroll/paystubs' },
        { name: 'Paystub Detail', description: 'View individual paystub', status: 'ready', apiEndpoint: '/api/payroll/paystubs/[id]' },
        { name: 'Employee Pay Profiles', description: 'Per-employee pay rates, type (hourly/salary), and settings', status: 'ready', apiEndpoint: '/api/payroll/employees' },
        { name: 'Employee Pay Profile Detail', description: 'Edit individual employee payroll profile', status: 'ready', apiEndpoint: '/api/payroll/employees/[id]' },
        { name: 'Leave Management', description: 'Track vacation, sick, and PTO requests', status: 'ready', apiEndpoint: '/api/payroll/leave' },
        { name: 'Leave Request Detail', description: 'Approve or deny individual leave requests', status: 'ready', apiEndpoint: '/api/payroll/leave/[id]' },
        { name: 'Overtime Rules', description: 'Configure overtime thresholds and multipliers', status: 'ready', apiEndpoint: '/api/payroll/overtime-rules' },
        { name: 'Payroll Schedule', description: 'Automate payroll run schedule', status: 'ready', apiEndpoint: '/api/payroll/schedule' },
        { name: 'Attendance Tracking', description: 'Track daily attendance and absences', status: 'ready', apiEndpoint: '/api/payroll/attendance' },
      ]
    },
    // ---------------------------------------------
    // STRIPE CONNECT & ADVANCED PAYMENTS
    // ---------------------------------------------
    {
      name: 'Stripe Connect & Advanced Payments',
      icon: '',
      description: 'Stripe Connect onboarding, customer portal, payment links, and webhooks',
      features: [
        { name: 'Stripe Connect Onboarding', description: 'Onboard shops to accept payments via Stripe Connect', status: 'setup-required', apiEndpoint: '/api/stripe/connect', notes: 'Requires STRIPE_SECRET_KEY in Vercel env vars (already set)' },
        { name: 'Stripe Connect Callback', description: 'Handle OAuth callback after shop connects Stripe', status: 'setup-required', apiEndpoint: '/api/stripe/connect/callback' },
        { name: 'Stripe Connect Refresh', description: 'Refresh Stripe Connect auth link', status: 'setup-required', apiEndpoint: '/api/stripe/connect/refresh' },
        { name: 'Stripe Customer Portal', description: 'Let shops manage payment methods via Stripe-hosted portal', status: 'setup-required', apiEndpoint: '/api/stripe/portal' },
        { name: 'Stripe Checkout Session', description: 'Create Stripe checkout for one-time or account charges', status: 'setup-required', apiEndpoint: '/api/stripe/checkout' },
        { name: 'Stripe Webhook Handler', description: 'Process Stripe events (payment intents and account updates)', status: 'setup-required', apiEndpoint: '/api/stripe/webhook', notes: 'Set STRIPE_WEBHOOK_SECRET in Vercel' },
        { name: 'Payment Links', description: 'Generate shareable payment links for invoices', status: 'ready', apiEndpoint: '/api/payment-links' },
        { name: 'Online Checkout Flow', description: 'Web checkout for customers paying invoices', status: 'setup-required', apiEndpoint: '/api/payment/checkout' },
        { name: 'Customer Payment Methods', description: 'Save and manage customer payment methods', status: 'ready', apiEndpoint: '/api/customers/payment-methods' },
      ]
    },
    // ---------------------------------------------
    // REAL-TIME, PUSH & CRON
    // ---------------------------------------------
    {
      name: 'Real-time, Push & Cron',
      icon: '',
      description: 'Push notifications, browser alerts, and scheduled background jobs',
      features: [
        { name: 'Push Notification Subscribe', description: 'Subscribe browser to push notifications', status: 'setup-required', apiEndpoint: '/api/push/subscribe', notes: 'Requires VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Vercel env vars' },
        { name: 'Push Notification Unsubscribe', description: 'Remove push registration', status: 'setup-required', apiEndpoint: '/api/push/unsubscribe' },
        { name: 'Send Push Notification', description: 'Trigger push notification to user', status: 'setup-required', apiEndpoint: '/api/push/send' },
        { name: 'DB-backed Notifications', description: 'Persistent notifications stored in database', status: 'ready', apiEndpoint: '/api/notifications-db' },
        { name: 'Cron: DB Keepalive', description: 'Ping DB every 5 min to prevent Neon cold starts', status: 'ready', apiEndpoint: '/api/cron/keepalive', notes: 'CRON_SECRET must be set in Vercel (already done)' },
        { name: 'Cron: Appointment Reminders', description: 'Daily cron to send appointment reminder notifications', status: 'ready', apiEndpoint: '/api/cron/appointment-reminders' },
        { name: 'Cron: Recurring Work Orders', description: 'Daily cron to generate recurring work orders', status: 'ready', apiEndpoint: '/api/cron/recurring-workorders' },
        { name: 'Cron: Recurring Reminders', description: 'Daily cron to send recurring job reminders', status: 'ready', apiEndpoint: '/api/cron/recurring-reminders' },
      ]
    },
    // ---------------------------------------------
    // PORTAL CHAT
    // ---------------------------------------------
    {
      name: 'Portal Chat',
      icon: '',
      description: 'Real-time streaming chat between customers, shops, and techs via the portal',
      features: [
        { name: 'Portal Chat by Role', description: 'Role-scoped chat endpoint (customer/shop/tech)', status: 'ready', apiEndpoint: '/api/portal-chat/[role]' },
        { name: 'Portal Chat Streaming', description: 'Server-sent event streaming for real-time chat', status: 'ready', apiEndpoint: '/api/portal-chat/[role]/stream' },
        { name: 'Customer Chat View', description: 'Customer-facing chat with their shop', status: 'ready', route: '/customer/messages', apiEndpoint: '/api/customers/messages' },
        { name: 'Shop Customer Messages', description: 'Shop view of all customer chats', status: 'ready', route: '/shop/customer-messages', apiEndpoint: '/api/shop/messages' },
      ]
    },
    // ---------------------------------------------
    // CUSTOMER VEHICLES
    // ---------------------------------------------
    {
      name: 'Customer Vehicles',
      icon: <FaCar style={{marginRight:4}} />,
      description: 'Full vehicle management for customer accounts',
      features: [
        { name: 'Vehicle List', description: 'View all vehicles on customer account', status: 'ready', route: '/customer/vehicles', apiEndpoint: '/api/customers/vehicles' },
        { name: 'Add Vehicle', description: 'Add a new vehicle to account (year/make/model/VIN)', status: 'ready', apiEndpoint: '/api/customers/vehicles' },
        { name: 'Edit Vehicle', description: 'Update vehicle details', status: 'ready', apiEndpoint: '/api/customers/vehicles/[id]' },
        { name: 'Delete Vehicle', description: 'Remove vehicle from account', status: 'ready', apiEndpoint: '/api/customers/vehicles/[id]' },
        { name: 'Vehicle Service History', description: 'All work orders associated with a vehicle', status: 'ready', route: '/customer/history' },
        { name: 'Customer Search', description: 'Search customers by name, email, or phone', status: 'ready', apiEndpoint: '/api/customers/search' },
      ]
    },
    // ---------------------------------------------
    // WORK AUTHORIZATIONS & RECURRING JOBS
    // ---------------------------------------------
    {
      name: 'Work Authorizations & Recurring',
      icon: <FaPencilAlt style={{marginRight:4}} />,
      description: 'Customer-signed work authorizations and recurring job approvals',
      features: [
        { name: 'Create Work Authorization', description: 'Generate authorization for customer to sign', status: 'ready', route: '/shop/work-authorizations', apiEndpoint: '/api/work-authorizations' },
        { name: 'Token-based Auth Link', description: 'Customer receives unique link to authorize work', status: 'ready', apiEndpoint: '/api/work-authorizations/[token]' },
        { name: 'Customer Auth Page', description: 'Customer-facing page to view and sign authorization', status: 'ready', route: '/customer/authorization/[token]' },
        { name: 'Recurring Work Orders', description: 'Schedule jobs that repeat (oil changes, etc.)', status: 'ready', route: '/shop/recurring-workorders', apiEndpoint: '/api/recurring-workorders' },
        { name: 'Recurring Job Approve/Reject', description: 'Customer approves or rejects a recurring job', status: 'ready', apiEndpoint: '/api/workorders/[id]/respond-recurring' },
        { name: 'Customer Recurring Approvals', description: 'Customer portal view of pending recurring approvals', status: 'ready', route: '/customer/recurring-approvals', apiEndpoint: '/api/customers/recurring-approvals' },
      ]
    },
    // ---------------------------------------------
    // FINDSHOPS (CUSTOMER-FACING MARKETPLACE)
    // ---------------------------------------------
    {
      name: 'FindShops Marketplace',
      icon: '',
      description: 'Customer-facing shop discovery, ratings, booking, and tracking  -  the public marketplace side of FixTray',
      features: [
        { name: 'Shop Search / Browse', description: 'Search shops by location, type, and services', status: 'ready', route: '/customer/findshops', apiEndpoint: '/api/customers/shops' },
        { name: 'Shop Detail Page', description: 'Customer-facing shop profile with services, hours, reviews', status: 'ready', route: '/customer/shop/[id]', apiEndpoint: '/api/customers/shops/[id]' },
        { name: 'Check Shop Availability', description: 'See open appointment slots for a shop', status: 'ready', apiEndpoint: '/api/customers/shops/[id]/availability' },
        { name: 'Favorite a Shop', description: 'Save a shop to favorites list', status: 'ready', route: '/customer/favorites', apiEndpoint: '/api/customers/favorites' },
        { name: 'Unfavorite a Shop', description: 'Remove shop from favorites', status: 'ready', apiEndpoint: '/api/customers/favorites/[id]' },
        { name: 'Book Appointment from Profile', description: 'Book directly from shop profile page', status: 'ready', route: '/customer/appointments/new', apiEndpoint: '/api/appointments' },
        { name: 'Track Tech in Real Time', description: 'Live technician GPS tracking on mobile jobs', status: 'ready', route: '/customer/tracking', apiEndpoint: '/api/customers/tracking' },
        { name: 'Leave a Review', description: 'Customer submits star rating and written review', status: 'ready', route: '/customer/reviews', apiEndpoint: '/api/reviews' },
      ]
    },
  ];

  const statusInfo = {
    'ready': { label: 'Ready to Use', color: 'bg-emerald-500', textColor: 'text-emerald-500', bgLight: 'bg-emerald-500/10' },
    'partial': { label: 'Partially Implemented', color: 'bg-amber-500', textColor: 'text-amber-500', bgLight: 'bg-amber-500/10' },
    'setup-required': { label: 'Needs Setup', color: 'bg-[#e5332a]', textColor: 'text-[#ff6b64]', bgLight: 'bg-[#e5332a]/10' },
    'not-implemented': { label: 'Not Yet Available', color: 'bg-stone-500', textColor: 'text-stone-400', bgLight: 'bg-stone-500/10' },
  };

  const allFeatures = categories.flatMap(c => c.features);
  const totalFeatures = allFeatures.length;
  const readyFeatures = allFeatures.filter(f => f.status === 'ready').length;
  const partialFeatures = allFeatures.filter(f => f.status === 'partial').length;
  const setupFeatures = allFeatures.filter(f => f.status === 'setup-required').length;
  const notImplemented = allFeatures.filter(f => f.status === 'not-implemented').length;

  const filteredCategories = categories.map(cat => ({
    ...cat,
    features: filterStatus === 'all' ? cat.features : cat.features.filter(f => f.status === filterStatus)
  })).filter(cat => cat.features.length > 0);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-stone-300 text-lg">Loading...</div>
      </div>
    );
  }

  // If no user, the useRequireAuth hook will handle redirect
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="bg-black/30 border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                <span className="text-white font-bold">F</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">FixTray Feature Guide</h1>
                <p className="text-stone-400 text-sm">What you can and can't do</p>
              </div>
            </div>
            <Link href="/admin/home" className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-stone-300 text-sm transition-colors">
              <FaArrowLeft style={{marginRight:4}} /> Back to Admin
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-black/30 rounded-xl p-4 border border-white/10">
            <p className="text-stone-400 text-sm">Total Features</p>
            <p className="text-3xl font-bold text-white">{totalFeatures}</p>
          </div>
          <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/30">
            <p className="text-emerald-400 text-sm">Ready to Use</p>
            <p className="text-3xl font-bold text-emerald-500">{readyFeatures}</p>
          </div>
          <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/30">
            <p className="text-amber-400 text-sm">Partial</p>
            <p className="text-3xl font-bold text-amber-500">{partialFeatures}</p>
          </div>
          <div className="bg-[#e5332a]/10 rounded-xl p-4 border border-[#e5332a]/30">
            <p className="text-[#ff6b64] text-sm">Needs Setup</p>
            <p className="text-3xl font-bold text-[#e5332a]">{setupFeatures}</p>
          </div>
          <div className="bg-stone-500/10 rounded-xl p-4 border border-stone-500/30">
            <p className="text-stone-400 text-sm">Not Available</p>
            <p className="text-3xl font-bold text-stone-400">{notImplemented}</p>
          </div>
        </div>

        {/* Legend & Filter */}
        <div className="bg-black/30 rounded-xl p-4 border border-white/10 mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                <span className="text-gray-300 text-sm">Ready - Works out of the box</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                <span className="text-gray-300 text-sm">Partial - Some limitations</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#e5332a]"></span>
                <span className="text-gray-300 text-sm">Setup Required - Needs configuration</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-stone-500"></span>
                <span className="text-gray-300 text-sm">Not Available - Planned for future</span>
              </div>
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 bg-black/30 border border-white/10 rounded-lg text-gray-200 focus:outline-none focus:border-[#e5332a]/50"
            >
              <option value="all">Show All</option>
              <option value="ready">Ready to Use</option>
              <option value="partial">Partial</option>
              <option value="setup-required">Needs Setup</option>
              <option value="not-implemented">Not Available</option>
            </select>
          </div>
        </div>

        {/* Categories */}
        <div className="space-y-4">
          {filteredCategories.map((category) => {
            const isExpanded = expandedCategory === category.name;
            const readyCount = category.features.filter(f => f.status === 'ready').length;
            
            return (
              <div key={category.name} className="bg-black/30 rounded-xl border border-white/10 overflow-hidden">
                <button
                  onClick={() => setExpandedCategory(isExpanded ? null : category.name)}
                  className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">{category.icon}</span>
                    <div className="text-left">
                      <h2 className="text-lg font-semibold text-white">{category.name}</h2>
                      <p className="text-gray-400 text-sm">{category.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-emerald-400 font-semibold">{readyCount}/{category.features.length}</p>
                      <p className="text-gray-500 text-xs">features ready</p>
                    </div>
                    <span className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}><FaCaretDown style={{marginRight:4}} /></span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-white/10 p-4">
                    <div className="space-y-3">
                      {category.features.map((feature, idx) => (
                        <div key={idx} className={`p-4 rounded-lg ${statusInfo[feature.status].bgLight} border border-white/5`}>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-1">
                                <span className={`w-2 h-2 rounded-full ${statusInfo[feature.status].color}`}></span>
                                <h3 className="text-white font-medium">{feature.name}</h3>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${statusInfo[feature.status].bgLight} ${statusInfo[feature.status].textColor}`}>
                                  {statusInfo[feature.status].label}
                                </span>
                              </div>
                              <p className="text-gray-400 text-sm ml-5">{feature.description}</p>
                              {feature.notes && (
                                <p className="text-gray-500 text-xs ml-5 mt-1"><FaInfoCircle style={{marginRight:4}} /> {feature.notes}</p>
                              )}
                              {feature.apiEndpoint && (
                                <p className="text-gray-600 text-xs ml-5 mt-1 font-mono">API: {feature.apiEndpoint}</p>
                              )}
                            </div>
                            {feature.route && (
                              <Link
                                href={feature.route as Route}
                                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-300 text-xs transition-colors whitespace-nowrap"
                              >
                                Open <FaArrowRight style={{marginRight:4}} />
                              </Link>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Setup Required Section */}
        <div className="mt-8 bg-[#e5332a]/10 rounded-xl p-6 border border-[#e5332a]/30">
          <h2 className="text-xl font-bold text-[#ff6b64] mb-4"><FaWrench style={{marginRight:4}} /> Features That Need Setup</h2>
          <p className="text-gray-300 mb-4">These features are built but require external service configuration:</p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-black/20 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-2"><FaCreditCard style={{marginRight:4}} /> Stripe Payments</h3>
              <p className="text-gray-400 text-sm mb-2">For online payment processing</p>
              <code className="text-xs text-[#ff6b64] bg-black/30 px-2 py-1 rounded">STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY</code>
            </div>
            <div className="bg-black/20 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-2"><FaEnvelope style={{marginRight:4}} /> Email Service</h3>
              <p className="text-gray-400 text-sm mb-2">For email notifications (SendGrid, Resend, etc.)</p>
              <code className="text-xs text-[#ff6b64] bg-black/30 px-2 py-1 rounded">EMAIL_API_KEY, EMAIL_FROM</code>
            </div>
            <div className="bg-black/20 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-2"><FaMobileAlt style={{marginRight:4}} /> SMS (Twilio)</h3>
              <p className="text-gray-400 text-sm mb-2">For text message notifications</p>
              <code className="text-xs text-[#ff6b64] bg-black/30 px-2 py-1 rounded">TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN</code>
            </div>
            <div className="bg-black/20 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-2"><FaBell style={{marginRight:4}} /> Push Notifications</h3>
              <p className="text-gray-400 text-sm mb-2">For browser push notifications</p>
              <code className="text-xs text-[#ff6b64] bg-black/30 px-2 py-1 rounded">VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY</code>
            </div>
            <div className="bg-black/20 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-2"><FaCloud style={{marginRight:4}} /> Cloudinary</h3>
              <p className="text-gray-400 text-sm mb-2">For cloud image storage</p>
              <code className="text-xs text-[#ff6b64] bg-black/30 px-2 py-1 rounded">CLOUDINARY_URL</code>
            </div>
            <div className="bg-black/20 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-2"> PostgreSQL</h3>
              <p className="text-gray-400 text-sm mb-2">For production database</p>
              <code className="text-xs text-[#ff6b64] bg-black/30 px-2 py-1 rounded">DATABASE_URL=&lt;your-neon-connection-string&gt;</code>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-stone-500 text-sm">
          <p>FixTray Work Order Management - {totalFeatures} Features - {readyFeatures} Ready to Use</p>
        </div>
      </div>
    </div>
  );
}



