'use client';
import { FaTimes } from 'react-icons/fa';

import { useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { Route } from 'next';
import {
  IconHome, IconOrders, IconMessages, IconTeam, IconCalendar,
  IconWrench, IconClock, IconSettings, IconInventory, IconDollar,
  IconChart, IconCar, IconStar, IconUser, IconCreditCard, IconSearch,
  IconCamera, IconMapPin, IconClipboard, IconTools, IconLogOut, IconGrid,
  IconFileText,
} from '@/components/icons';

interface MobileNavProps {
  role: 'customer' | 'shop' | 'tech' | 'manager';
}

interface NavItem {
  icon: ReactNode;
  label: string;
  path: string;
}

// PRIMARY (bottom bar) + MORE (drawer) items per role
const navConfig: Record<string, { primary: NavItem[]; more: NavItem[] }> = {
  customer: {
    primary: [
      { icon: <IconHome size={22} />,     label: 'Home',    path: '/customer/dashboard' },
      { icon: <IconCalendar size={22} />, label: 'Appts',   path: '/customer/appointments' },
      { icon: <IconWrench size={22} />,   label: 'Repairs', path: '/customer/history' },
      { icon: <IconMessages size={22} />, label: 'Chat',    path: '/customer/messages' },
    ],
    more: [
      { icon: <IconUser size={22} />,       label: 'Profile',       path: '/customer/overview' },
      { icon: <IconStar size={22} />,       label: 'Reviews',       path: '/customer/reviews' },
      { icon: <IconCreditCard size={22} />, label: 'Payments',      path: '/customer/payments' },
      { icon: <IconCar size={22} />,        label: 'My Cars',       path: '/customer/vehicles' },
      { icon: <IconCalendar size={22} />,   label: 'Recurring',     path: '/customer/recurring-approvals' },
      { icon: <IconClipboard size={22} />,  label: 'Notifications', path: '/customer/notifications' },
    ],
  },
  shop: {
    primary: [
      { icon: <IconHome size={22} />,     label: 'Home',     path: '/shop/home' },
      { icon: <IconOrders size={22} />,   label: 'Orders',   path: '/shop/home' },
      { icon: <IconMessages size={22} />, label: 'Messages', path: '/shop/customer-messages' },
      { icon: <IconTeam size={22} />,     label: 'Team',     path: '/shop/manage-team' },
    ],
    more: [
      { icon: <IconInventory size={22} />, label: 'Inventory',  path: '/shop/inventory' },
      { icon: <IconDollar size={22} />,    label: 'Payroll',    path: '/shop/payroll' },
      { icon: <IconChart size={22} />,     label: 'Reports',    path: '/shop/analytics' },
      { icon: <IconCar size={22} />,       label: 'Ops Overview',  path: '/shop/home' },
      { icon: <IconStar size={22} />,      label: 'Reviews',    path: '/shop/reviews' },
      { icon: <IconSettings size={22} />,  label: 'Settings',   path: '/shop/settings' },
    ],
  },
  tech: {
    primary: [
      { icon: <IconHome size={22} />,       label: 'Home',     path: '/tech/home' },
      { icon: <IconClipboard size={22} />,  label: 'My Jobs',  path: '/tech/home' },
      { icon: <IconClock size={22} />,      label: 'Clock',    path: '/tech/timeclock' },
      { icon: <IconMessages size={22} />,   label: 'Messages', path: '/tech/messages' },
    ],
    more: [
      { icon: <IconSearch size={22} />,   label: 'DVI Form',    path: '/tech/dvi' },
      { icon: <IconFileText size={22} />, label: 'DTC Lookup',  path: '/tech/dtc-lookup' },
      { icon: <IconCamera size={22} />,   label: 'Photos',      path: '/tech/photos' },
      { icon: <IconTools size={22} />,    label: 'All Tools',   path: '/tech/all-tools' },
      { icon: <IconInventory size={22} />,label: 'Inventory',   path: '/tech/inventory' },
      { icon: <IconMapPin size={22} />,   label: 'Location',    path: '/tech/share-location' },
    ],
  },
  manager: {
    primary: [
      { icon: <IconHome size={22} />,      label: 'Home',     path: '/manager/home' },
      { icon: <IconClipboard size={22} />, label: 'Assign',   path: '/manager/assignments' },
      { icon: <IconTeam size={22} />,      label: 'Team',     path: '/manager/team' },
      { icon: <IconMessages size={22} />,  label: 'Messages', path: '/manager/messages' },
    ],
    more: [
      { icon: <IconFileText size={22} />,   label: 'Estimates',  path: '/manager/estimates' },
      { icon: <IconClock size={22} />,      label: 'Time Clock', path: '/manager/timeclock' },
      { icon: <IconInventory size={22} />,  label: 'Inventory',  path: '/manager/inventory' },
      { icon: <IconOrders size={22} />,     label: 'All Orders', path: '/manager/home' },
      { icon: <IconChart size={22} />,      label: 'Overview',   path: '/manager/overview' },
      { icon: <IconOrders size={22} />,     label: 'Work Orders', path: '/manager/home' },
      { icon: <IconInventory size={22} />,  label: 'Parts',      path: '/manager/inventory' },
      { icon: <IconSearch size={22} />,     label: 'Inspections', path: '/manager/inspections' },
    ],
  },
};

export default function MobileNav({ role }: MobileNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  if (!isMobile) return null;

  const config = navConfig[role] ?? navConfig.shop;
  const { primary, more } = config;

  const isActive = (path: string) =>
    path === pathname || (path !== '/' && !path.includes('#') && (pathname ?? '').startsWith(path + '/'));

  return (
    <>
      {/* More drawer backdrop */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 1090,
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* More drawer */}
      <div style={{
        position: 'fixed',
        bottom: drawerOpen ? 68 : -400,
        left: 0, right: 0,
        background: 'linear-gradient(180deg, #1a2234 0%, #0f172a 100%)',
        borderTop: '1px solid rgba(229,51,42,0.25)',
        borderRadius: '20px 20px 0 0',
        zIndex: 1095,
        transition: 'bottom 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        padding: '16px 16px 24px',
      }}>
        <div style={{
          width: 40, height: 4, borderRadius: 2,
          background: 'rgba(255,255,255,0.15)',
          margin: '0 auto 16px',
        }} />
        <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 12, textTransform: 'uppercase' }}>
          More
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
        }}>
          {more.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => { router.push(item.path as Route); setDrawerOpen(false); }}
                style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 6,
                  padding: '12px 4px',
                  background: active ? 'rgba(229,51,42,0.15)' : 'rgba(255,255,255,0.04)',
                  border: active ? '1px solid rgba(229,51,42,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 12,
                  color: active ? '#f87171' : '#9ca3af',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 500 }}>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Sign Out */}
        <button
          onClick={() => {
            if (typeof window !== 'undefined') {
              localStorage.removeItem('token');
              localStorage.removeItem('userRole');
              localStorage.removeItem('userName');
              localStorage.removeItem('shopId');
              localStorage.removeItem('userId');
              window.location.href = '/auth/login';
            }
          }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%',
            marginTop: 12,
            padding: '12px 0',
            background: 'rgba(229,51,42,0.10)',
            border: '1px solid rgba(229,51,42,0.25)',
            borderRadius: 12,
            color: '#e5332a',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <IconLogOut size={16} /> Sign Out
        </button>
      </div>

      {/* Bottom nav bar */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        // minHeight covers the tap targets; padding adds safe-area on notch/gesture-nav devices
        // env(safe-area-inset-bottom) resolves correctly on:
        //   iOS Safari (any notched iPhone), Android Chrome 69+ with viewport-fit=cover
        //   Falls back to 0 on older Android  -  the 68px height alone is sufficient there
        minHeight: 'calc(68px + env(safe-area-inset-bottom, 0px))',
        background: 'rgba(10,15,28,0.97)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'flex-start',  // items sit at top; padding pushes bar down
        paddingTop: 0,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        zIndex: 1100,
        backdropFilter: 'blur(12px)',
      }}>
        {primary.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path as Route)}
              style={{
                flex: 1,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 3,
                background: 'none', border: 'none',
                color: active ? '#e5332a' : '#6b7280',
                cursor: 'pointer',
                position: 'relative',
                transition: 'color 0.15s',
              }}
            >
              {active && (
                <div style={{
                  position: 'absolute', top: 0, left: '25%', right: '25%',
                  height: 2, borderRadius: '0 0 2px 2px',
                  background: '#e5332a',
                }} />
              )}
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: active ? '#e5332a' : '#6b7280' }}>{item.icon}</span>
              <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, letterSpacing: '0.02em' }}>
                {item.label}
              </span>
            </button>
          );
        })}

        {/* More button */}
        <button
          onClick={() => setDrawerOpen(!drawerOpen)}
          style={{
            flex: 1,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 3,
            background: 'none', border: 'none',
            color: drawerOpen ? '#e5332a' : '#6b7280',
            cursor: 'pointer',
            transition: 'color 0.15s',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{drawerOpen ? <span style={{ fontSize: 18, lineHeight: 1 }}><FaTimes style={{marginRight:4}} /></span> : <IconGrid size={20} />}</span>
          <span style={{ fontSize: 10, fontWeight: 400 }}>More</span>
        </button>
      </div>
    </>
  );
}
