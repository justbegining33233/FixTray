'use client';

import { usePhrase } from '@/lib/usePhrase';
// Use react-icons for all icons
import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { FaArrowLeft, FaArrowRight, FaBoxes, FaBullhorn, FaCalendarAlt, FaCamera, FaCar, FaCaretDown, FaChartBar, FaClipboardList, FaClock, FaCog, FaComments, FaCreditCard, FaHome, FaListAlt, FaMapMarkerAlt, FaMoneyBill, FaScroll, FaSearch, FaStar, FaStore, FaTools, FaUser, FaUsers } from 'react-icons/fa';
import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeRole } from '@/lib/roleNav';
import { isPlatformActor } from '@/lib/platformOwnerScope';
import { filterMenuGroups, type MenuIcon, type SidebarRole } from '@/lib/roleMenus';

interface SidebarProps {
  role: 'shop' | 'manager' | 'tech' | 'admin' | 'superadmin';
  isOpen?: boolean;
  onClose?: () => void;
  onSelectTab?: (tab: string) => void;
  activeHash?: string;
}

function menuIcon(name: MenuIcon): ReactNode {
  const icons: Record<MenuIcon, ReactNode> = {
    home: <FaHome />,
    orders: <FaListAlt />,
    messages: <FaComments />,
    team: <FaUsers />,
    calendar: <FaCalendarAlt />,
    wrench: <FaTools />,
    clock: <FaClock />,
    settings: <FaCog />,
    inventory: <FaBoxes />,
    dollar: <FaMoneyBill />,
    chart: <FaChartBar />,
    car: <FaCar />,
    star: <FaStar />,
    user: <FaUser />,
    card: <FaCreditCard />,
    search: <FaSearch />,
    camera: <FaCamera />,
    pin: <FaMapMarkerAlt />,
    clipboard: <FaClipboardList />,
    tools: <FaTools />,
    grid: <FaStore />,
    file: <FaScroll />,
    bell: <FaBullhorn />,
  };
  return icons[name];
}

// --- COMPONENT ---------------------------------------------------------------

export default function Sidebar({ role, isOpen = true, onClose, onSelectTab, activeHash }: SidebarProps) {
  const say = usePhrase();
  const pathname = usePathname();
  const { user } = useAuth();
  const linkRole = normalizeRole(user?.role) || role;
  const platformActor = isPlatformActor({
    role: user?.role || (role === 'admin' || role === 'superadmin' ? role : undefined),
    isOwner: user?.isOwner,
    isSuperAdmin: user?.isSuperAdmin,
  });
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isCompactDesktop, setIsCompactDesktop] = useState(false);
  const [currentHash, setCurrentHash] = useState('');

  const filteredGroups = filterMenuGroups(role as SidebarRole, linkRole, platformActor).map((group) => ({
    ...group,
    icon: menuIcon(group.icon),
    items: group.items.map((item) => ({ ...item, icon: menuIcon(item.icon) })),
  }));

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(filteredGroups.map(g => [g.label, g.defaultOpen ?? false]))
  );

  useEffect(() => {
    const checkMobile = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      setIsCompactDesktop(width >= 768 && width <= 1200);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    const handleHashChange = () => setCurrentHash(window.location.hash || '');
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setCollapsed(isCompactDesktop);
    }
  }, [isCompactDesktop, isMobile]);

  useEffect(() => {
    setOpenGroups(prev => {
      const next: Record<string, boolean> = {};
      for (const group of filteredGroups) {
        next[group.label] = prev[group.label] ?? (group.defaultOpen ?? false);
      }
      return next;
    });
  }, [role]);

  const isActive = (href: string) => {
    if (href.includes('#')) {
      const [base, hash] = href.split('#');
      const hashValue = activeHash || currentHash;
      return pathname === base && hashValue === `#${hash}`;
    }
    return pathname === href || (href !== '/' && (pathname ?? '').startsWith(href + '/'));
  };

  const toggleGroup = (label: string) => {
    if (collapsed) return;
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const handleItemClick = (e: React.MouseEvent, href: string) => {
    if (onSelectTab && href.includes('#')) {
      const [, hash] = href.split('#');
      if (hash) {
        e.preventDefault();
        onSelectTab(hash);
        setCurrentHash(`#${hash}`);
      }
    }
    if (isMobile && onClose) onClose();
  };

  if (!isOpen) return null;

  const expandedWidth = isCompactDesktop ? 206 : 230;
  const collapsedWidth = 58;

  return (
    <>
      {/* Mobile backdrop */}
      {isMobile && isOpen && onClose && (
        <div
          data-desktop-chrome="true"
          onClick={onClose}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.55)', zIndex: 998,
          }}
        />
      )}

      <aside data-desktop-chrome="true" style={{
        width: collapsed ? collapsedWidth : expandedWidth,
        minWidth: collapsed ? collapsedWidth : expandedWidth,
        height: '100vh',
        background: 'rgba(8, 12, 24, 0.82)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        position: isMobile ? 'fixed' : 'sticky',
        top: 0,
        left: isMobile && !isOpen ? -expandedWidth : 0,
        transition: 'width 0.22s cubic-bezier(.4,0,.2,1), min-width 0.22s cubic-bezier(.4,0,.2,1)',
        overflowY: 'auto',
        overflowX: 'hidden',
        zIndex: 999,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
      }}>

        {/* Header */}
        <div style={{
          padding: collapsed ? '16px 0' : '16px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: 8,
          flexShrink: 0,
          minHeight: 54,
        }}>
          {!collapsed && (
            <div style={{
              fontSize: 16,
              fontWeight: 800,
              color: '#e5332a',
              letterSpacing: '-0.5px',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}>
              {say("FixTray")}{' '}</div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#475569',
              width: 26, height: 26,
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
            title={collapsed ? say("Expand sidebar") : say("Collapse sidebar")}
          >
            {collapsed ? <FaArrowRight /> : <FaArrowLeft />}
          </button>
        </div>

        {/* Nav Groups */}
        <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
          {filteredGroups.map((group) => {
            const isGroupOpen = collapsed ? false : (openGroups[group.label] ?? group.defaultOpen);
            const hasActiveItem = group.items.some(item => isActive(item.href));

            return (
              <div key={group.label} style={{ marginBottom: 2 }}>
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group.label)}
                  title={collapsed ? group.label : undefined}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: collapsed ? '10px 0' : '8px 14px',
                    background: 'transparent',
                    border: 'none',
                    cursor: collapsed ? 'default' : 'pointer',
                    borderLeft: hasActiveItem ? '2px solid rgba(229,51,42,0.6)' : '2px solid transparent',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                  }}
                >
                  {collapsed && <span style={{ fontSize: 15, flexShrink: 0 }}>{say(group.icon)}</span>}
                  {!collapsed && (
                    <>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.09em',
                        textTransform: 'uppercase',
                        color: hasActiveItem ? '#e5332a' : '#334155',
                        flex: 1,
                        textAlign: 'left',
                      }}>
                        {say(group.label)}
                      </span>
                      <span style={{
                        color: '#334155',
                        fontSize: 9,
                        transition: 'transform 0.2s',
                        transform: isGroupOpen ? 'rotate(180deg)' : 'none',
                      }}><FaCaretDown style={{marginRight:4}} /></span>
                    </>
                  )}
                </button>

                {/* Expanded items */}
                {isGroupOpen && !collapsed && (
                  <div style={{ paddingBottom: 4 }}>
                    {group.items.map((item, idx) => {
                      const active = isActive(item.href);
                      return (
                        <Link
                          key={idx}
                          href={item.href as Route}
                          onClick={(e) => handleItemClick(e, item.href)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 9,
                            padding: '7px 14px 7px 26px',
                            textDecoration: 'none',
                            background: active ? 'rgba(229,51,42,0.10)' : 'transparent',
                            borderLeft: active ? '2px solid #e5332a' : '2px solid transparent',
                            color: active ? '#f1f5f9' : '#64748b',
                            fontSize: 12.5,
                            fontWeight: active ? 600 : 400,
                            letterSpacing: '0.01em',
                            transition: 'color 0.12s, background 0.12s',
                          }}
                          onMouseEnter={(e) => {
                            if (!active) {
                              e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                              e.currentTarget.style.color = '#cbd5e1';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!active) {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.color = '#64748b';
                            }
                          }}
                        >
                          <span style={{ fontSize: 13, flexShrink: 0, opacity: active ? 1 : 0.65 }}>{say(item.icon)}</span>
                          <span style={{ flex: 1 }}>{say(item.label)}</span>
                          {item.badge && item.badge > 0 && (
                            <span style={{
                              background: '#e5332a', color: 'white',
                              borderRadius: 999, padding: '1px 6px',
                              fontSize: 10, fontWeight: 700,
                            }}>
                              {item.badge > 9 ? '9+' : item.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}

                {/* Collapsed: icon-only items */}
                {collapsed && (
                  <div style={{ paddingBottom: 2 }}>
                    {group.items.map((item, idx) => {
                      const active = isActive(item.href);
                      return (
                        <Link
                          key={idx}
                          href={item.href as Route}
                          onClick={(e) => handleItemClick(e, item.href)}
                          title={say(item.label)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '8px 0',
                            textDecoration: 'none',
                            background: active ? 'rgba(229,51,42,0.15)' : 'transparent',
                            borderLeft: active ? '2px solid #e5332a' : '2px solid transparent',
                            color: active ? '#f87171' : '#6b7280',
                            fontSize: 15,
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={(e) => {
                            if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                          }}
                          onMouseLeave={(e) => {
                            if (!active) e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          {say(item.icon)}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        {!collapsed && (
          <div style={{
            padding: '10px 14px',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            flexShrink: 0,
          }}>
            <div style={{ fontSize: 10, color: '#1e293b', textAlign: 'center', letterSpacing: '0.08em', fontWeight: 600, textTransform: 'uppercase' }}>
              {say("FixTray · v1.0")}{' '}</div>
          </div>
        )}
      </aside>
    </>
  );
}
