'use client';
import { FaArrowRight } from 'react-icons/fa';

import Link from 'next/link';
import type { Route } from 'next';

interface QuickActionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
  value?: string | number;
  color?: string;
  badge?: number;
  status?: 'success' | 'warning' | 'danger' | 'info';
}

export default function QuickActionCard(props: QuickActionCardProps) {
  const {
    icon,
    title,
    description,
    href,
    onClick,
    value,
    color = '#3b82f6',
    badge,
    status,
  } = props;
  const statusColors = {
    success: { bg: 'rgba(34,197,94,0.2)', border: 'rgba(34,197,94,0.3)', text: '#22c55e' },
    warning: { bg: 'rgba(245,158,11,0.2)', border: 'rgba(245,158,11,0.3)', text: '#f59e0b' },
    danger: { bg: 'rgba(239,68,68,0.2)', border: 'rgba(239,68,68,0.3)', text: '#ef4444' },
    info: { bg: 'rgba(59,130,246,0.2)', border: 'rgba(59,130,246,0.3)', text: '#3b82f6' },
  };

  const statusStyle = status ? statusColors[status] : {
    bg: `${color}20`,
    border: `${color}40`,
    text: color,
  };

  const renderContent = () => (
    <div style={{
      position: 'relative',
      padding: 20,
      background: statusStyle.bg,
      border: `1px solid ${statusStyle.border}`,
      borderRadius: 12,
      cursor: href || onClick ? 'pointer' : 'default',
      transition: 'all 0.3s ease',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      height: '100%',
    }}
    onMouseEnter={(e) => {
      if (href || onClick) {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.2)';
      }
    }}
    onMouseLeave={(e) => {
      if (href || onClick) {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }
    }}>
      {/* Badge */}
      {badge !== undefined && badge > 0 && (
        <div style={{
          position: 'absolute',
          top: -8,
          right: -8,
          background: '#e5332a',
          color: 'white',
          borderRadius: '50%',
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 700,
          boxShadow: '0 2px 8px rgba(229,51,42,0.4)',
        }}>
          {badge > 99 ? '99+' : badge}
        </div>
      )}

      {/* Icon & Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ 
          fontSize: 32,
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
        }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ 
            color: '#e5e7eb', 
            fontSize: 16, 
            fontWeight: 700, 
            margin: 0,
            marginBottom: 4,
          }}>
            {title}
          </h3>
          {value !== undefined && (
            <div style={{
              color: statusStyle.text,
              fontSize: 24,
              fontWeight: 800,
              lineHeight: 1,
            }}>
              {value}
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      <p style={{ 
        color: '#9ca3af', 
        fontSize: 13, 
        margin: 0,
        lineHeight: 1.5,
      }}>
        {description}
      </p>

      {/* Action Arrow */}
      {(href || onClick) && (
        <div style={{
          marginTop: 'auto',
          display: 'flex',
          justifyContent: 'flex-end',
        }}>
          <span style={{ 
            color: statusStyle.text, 
            fontSize: 18,
            fontWeight: 700,
          }}>
            <FaArrowRight style={{marginRight:4}} />
          </span>
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href as Route} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
        {renderContent()}
      </Link>
    );
  }

  if (onClick) {
    return (
      <div onClick={onClick} style={{ height: '100%' }}>
        {renderContent()}
      </div>
    );
  }

  return renderContent();
}
