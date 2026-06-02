// Contextual Help Tooltip Component
// Provides in-app guidance to reduce user confusion

'use client';

import { useState, useEffect, useRef } from 'react';
import { FaQuestionCircle, FaTimes, FaLightbulb } from 'react-icons/fa';

interface HelpTooltipProps {
  content: string;
  title?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  trigger?: 'hover' | 'click';
  size?: 'sm' | 'md' | 'lg';
  showCloseButton?: boolean;
  persistent?: boolean; // Don't auto-hide
  children?: React.ReactNode;
}

export default function HelpTooltip({
  content,
  title,
  position = 'top',
  trigger = 'hover',
  size = 'md',
  showCloseButton = true,
  persistent = false,
  children
}: HelpTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [, setHasBeenShown] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const sizeClasses = {
    sm: 'max-w-xs',
    md: 'max-w-sm',
    lg: 'max-w-md'
  };

  const positionClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-2'
  };

  const arrowClasses = {
    top: 'top-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent',
    left: 'left-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent',
    right: 'right-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent'
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        !persistent
      ) {
        setIsVisible(false);
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible, persistent]);

  const handleTrigger = () => {
    if (trigger === 'click') {
      setIsVisible(!isVisible);
      setHasBeenShown(true);
    }
  };

  const handleMouseEnter = () => {
    if (trigger === 'hover') {
      setIsVisible(true);
      setHasBeenShown(true);
    }
  };

  const handleMouseLeave = () => {
    if (trigger === 'hover' && !persistent) {
      setIsVisible(false);
    }
  };

  const handleClose = () => {
    setIsVisible(false);
  };

  return (
    <div className="relative inline-block">
      <div
        ref={triggerRef}
        onClick={handleTrigger}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="inline-flex items-center cursor-help"
      >
        {children || (
          <FaQuestionCircle className="w-4 h-4 text-gray-400 hover:text-gray-600 transition-colors" />
        )}
      </div>

      {isVisible && (
        <div
          ref={tooltipRef}
          className={`absolute z-50 ${positionClasses[position]} ${sizeClasses[size]}`}
        >
          <div className="bg-gray-900 text-white rounded-lg shadow-lg p-4 relative">
            {/* Arrow */}
            <div
              className={`absolute w-0 h-0 border-4 border-gray-900 ${arrowClasses[position]}`}
              style={{
                [position === 'top' ? 'borderTopWidth' : position === 'bottom' ? 'borderBottomWidth' : 'borderLeftWidth']: '6px'
              }}
            />

            {/* Close button */}
            {showCloseButton && (
              <button
                onClick={handleClose}
                className="absolute top-2 right-2 text-gray-400 hover:text-white transition-colors"
              >
                <FaTimes className="w-3 h-3" />
              </button>
            )}

            {/* Content */}
            <div className="pr-6">
              {title && (
                <div className="flex items-center space-x-2 mb-2">
                  <FaLightbulb className="w-4 h-4 text-yellow-400" />
                  <h4 className="font-semibold text-sm">{title}</h4>
                </div>
              )}
              <p className="text-sm leading-relaxed">{content}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Pre-configured help tooltips for common UI elements
export const HelpTooltips = {
  // Navigation help
  Navigation: () => (
    <HelpTooltip
      title="Navigation Menu"
      content="Use this menu to quickly access different sections of the application. Each item shows relevant information like active jobs or unread messages."
      position="bottom"
    />
  ),

  // Dashboard help
  DashboardStats: () => (
    <HelpTooltip
      title="Dashboard Overview"
      content="This section shows key metrics and recent activity. Click on any card to view more details or take action."
      position="right"
    />
  ),

  // Form help
  RequiredField: () => (
    <HelpTooltip
      content="This field is required. Please fill it in before submitting."
      position="top"
      size="sm"
    />
  ),

  // Status indicators
  StatusIndicator: ({ status }: { status: string }) => (
    <HelpTooltip
      content={`This item is currently ${status.toLowerCase()}. ${getStatusDescription(status)}`}
      position="top"
      size="sm"
    />
  ),

  // Action buttons
  ActionButton: ({ action }: { action: string }) => (
    <HelpTooltip
      content={`Click here to ${action.toLowerCase()}. This will ${getActionDescription(action)}`}
      position="top"
    />
  ),

  // Search and filters
  SearchBar: () => (
    <HelpTooltip
      title="Search & Filter"
      content="Use this search bar to find specific items. You can also use filters to narrow down results by status, date, or other criteria."
      position="bottom"
    />
  ),

  // Notifications
  Notifications: () => (
    <HelpTooltip
      title="Notifications"
      content="Check here for important updates, messages, and alerts. Click the bell icon to see all notifications."
      position="bottom"
    />
  ),

  // Profile and settings
  ProfileMenu: () => (
    <HelpTooltip
      title="Account Menu"
      content="Access your profile settings, account preferences, and sign out options from this menu."
      position="bottom"
    />
  )
};

function getStatusDescription(status: string): string {
  const descriptions: Record<string, string> = {
    'pending': 'waiting to be started',
    'in progress': 'currently being worked on',
    'completed': 'finished and ready',
    'cancelled': 'no longer active',
    'on hold': 'temporarily paused'
  };
  return descriptions[status.toLowerCase()] || 'in this state';
}

function getActionDescription(action: string): string {
  const descriptions: Record<string, string> = {
    'edit': 'open the edit form',
    'delete': 'remove this item permanently',
    'create': 'open a form to add something new',
    'view': 'show more details',
    'save': 'store your changes',
    'cancel': 'discard changes and go back',
    'submit': 'send this information',
    'approve': 'confirm and accept this request',
    'reject': 'decline this request'
  };
  return descriptions[action.toLowerCase()] || 'perform this action';
}