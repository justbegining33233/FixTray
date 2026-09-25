'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Capacitor } from '@capacitor/core';
import { usePhrase } from '@/lib/usePhrase';
import { shellHrefForRole } from '@/lib/roleNav';
import { useAuth } from '@/contexts/AuthContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { nativeMobileService } from '@/lib/nativeMobileService';
import {
  IconHome, IconOrders, IconMessages, IconTeam, IconCalendar,
  IconWrench, IconClock, IconSettings, IconInventory, IconDollar,
  IconChart, IconCar, IconStar, IconUser, IconCreditCard, IconSearch,
  IconCamera, IconMapPin, IconClipboard, IconTools, IconLogOut, IconGrid,
  IconFileText, IconBell,
} from '@/components/icons';
import {
  activePrimaryTabIndex,
  hrefPath,
  type MobileIconName,
  type MobileLink,
  type MobileRoleNav,
} from '@/lib/mobileRoleNav';

const ICONS: Record<MobileIconName, typeof IconHome> = {
  home: IconHome,
  orders: IconOrders,
  messages: IconMessages,
  team: IconTeam,
  calendar: IconCalendar,
  wrench: IconWrench,
  clock: IconClock,
  settings: IconSettings,
  inventory: IconInventory,
  dollar: IconDollar,
  chart: IconChart,
  car: IconCar,
  star: IconStar,
  user: IconUser,
  card: IconCreditCard,
  search: IconSearch,
  camera: IconCamera,
  pin: IconMapPin,
  clipboard: IconClipboard,
  tools: IconTools,
  grid: IconGrid,
  file: IconFileText,
  bell: IconBell,
};

function NavIcon({ name, size = 22 }: { name: MobileIconName; size?: number }) {
  const Icon = ICONS[name] ?? IconGrid;
  return <Icon size={size} />;
}

function linkMatches(href: string, pathname: string): boolean {
  const path = hrefPath(href);
  return pathname === path || (path !== '/' && pathname.startsWith(`${path}/`));
}

export default function RoleTabBar({
  nav,
  moreOpen,
  onMoreOpenChange,
}: {
  nav: MobileRoleNav;
  moreOpen?: boolean;
  onMoreOpenChange?: (open: boolean) => void;
}) {
  const say = usePhrase();
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const open = moreOpen ?? internalOpen;

  const setOpen = (next: boolean) => {
    onMoreOpenChange?.(next);
    if (moreOpen === undefined) setInternalOpen(next);
  };

  useEffect(() => {
    setOpen(false);
    setQuery('');
    // Close the directory when the route changes. setOpen is stable enough for this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const tabIndex = activePrimaryTabIndex(nav, pathname);
  const filtered = useMemo(() => {
    const ownerOnly = (item: MobileLink) => item.label === 'Owner Tools' || item.href.startsWith('/admin/owner');
    const source = user?.isOwner
      ? nav.more
      : nav.more
          .map((group) => ({ ...group, items: group.items.filter((item) => !ownerOnly(item)) }))
          .filter((group) => group.items.length > 0);
    const needle = query.trim().toLowerCase();
    if (!needle) return source;
    return source
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.label.toLowerCase().includes(needle) || item.href.toLowerCase().includes(needle)),
      }))
      .filter((group) => group.items.length > 0);
  }, [nav.more, query, user?.isOwner]);

  const go = (href: string) => {
    if (Capacitor.isNativePlatform()) {
      void nativeMobileService.triggerHapticFeedback();
    }
    const actor = user?.role || nav.id;
    router.push(shellHrefForRole(href, actor) as Route);
    setOpen(false);
  };

  const signOut = async () => {
    try {
      const csrfToken = document.cookie.match(/csrf_token=([^;]+)/)?.[1] || '';
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-csrf-token': csrfToken },
      }).catch(() => {});
    } catch {
      // Client cleanup still runs.
    }
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    localStorage.removeItem('shopId');
    localStorage.removeItem('userId');
    localStorage.removeItem('isSuperAdmin');
    window.location.href = '/auth/login';
  };

  const moreActive = open || tabIndex < 0;

  return (
    <>
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.62)', zIndex: 1200 }}
        />
      )}
      <div
        data-role-more={open ? 'open' : 'closed'}
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: open ? 0 : '-110%',
          maxHeight: 'min(78dvh, 720px)',
          background: '#020608',
          borderTop: '1px solid var(--accent-border, rgba(229,51,42,0.3))',
          borderRadius: '22px 22px 0 0',
          zIndex: 1210,
          transition: 'bottom 0.28s ease',
          display: 'flex',
          flexDirection: 'column',
          padding: '12px 14px calc(76px + env(safe-area-inset-bottom, 0px))',
          boxShadow: '0 -12px 40px rgba(0,0,0,0.45)',
        }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.16)', margin: '0 auto 12px' }} />
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text, #f1f5f9)', letterSpacing: '-0.02em' }}>{say('More')}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)', marginBottom: 10 }}>
          {say('Everything for this role, one tap away.')}
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={say('Search or jump to a section...')}
          aria-label={say('Search or jump to a section...')}
          style={{
            width: '100%',
            marginBottom: 12,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border, rgba(255,255,255,0.08))',
            borderRadius: 12,
            color: 'var(--text, #f1f5f9)',
            padding: '10px 12px',
            fontFamily: 'var(--font)',
          }}
        />
        <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 8 }}>
          {filtered.map((group) => (
            <div key={group.title} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint, #475569)', margin: '4px 2px 8px' }}>
                {say(group.title)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {group.items.map((item) => (
                  <MoreCard key={`${group.title}-${item.href}-${item.label}`} item={item} active={linkMatches(item.href, pathname)} onClick={() => go(item.href)} />
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 13, padding: '8px 2px' }}>{say('No matching pages')}</div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
          <LanguageSwitcher />
          <button
            type="button"
            onClick={() => {
              localStorage.setItem('viewMode', 'desktop');
              window.location.reload();
            }}
            style={ghostButton}
          >
            {say('Web view')}
          </button>
          <button type="button" onClick={() => void signOut()} style={{ ...ghostButton, color: 'var(--accent, #e5332a)', borderColor: 'var(--accent-border, rgba(229,51,42,0.3))' }}>
            <IconLogOut size={16} /> {say('Sign Out')}
          </button>
        </div>
      </div>

      <div
        data-role-tab-bar={nav.id}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1220,
          display: 'flex',
          alignItems: 'flex-start',
          minHeight: 'calc(64px + env(safe-area-inset-bottom, 0px))',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          background: 'rgba(2,6,8,0.96)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(16px)',
        }}
      >
        {nav.tabs.map((tab, index) => (
          <TabButton key={tab.label} label={say(tab.label)} icon={tab.icon} active={!open && index === tabIndex} onClick={() => go(tab.href)} />
        ))}
        <TabButton label={say('More')} icon="grid" active={moreActive} onClick={() => setOpen(!open)} />
      </div>
    </>
  );
}

function MoreCard({ item, active, onClick }: { item: MobileLink; active: boolean; onClick: () => void }) {
  const say = usePhrase();
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        textAlign: 'left',
        padding: '10px 10px',
        borderRadius: 12,
        background: active ? 'var(--accent-dim, rgba(229,51,42,0.15))' : 'rgba(255,255,255,0.04)',
        border: active ? '1px solid var(--accent-border, rgba(229,51,42,0.3))' : '1px solid rgba(255,255,255,0.06)',
        color: active ? 'var(--accent, #e5332a)' : 'var(--text, #f1f5f9)',
        cursor: 'pointer',
        minWidth: 0,
      }}
    >
      <span style={{ display: 'flex', flexShrink: 0 }}><NavIcon name={item.icon} size={16} /></span>
      <span style={{ fontSize: 12, fontWeight: 650, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis' }}>{say(item.label)}</span>
    </button>
  );
}

function TabButton({ label, icon, active, onClick }: { label: string; icon: MobileIconName; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        minHeight: 64,
        background: 'none',
        border: 'none',
        color: active ? 'var(--accent, #e5332a)' : '#6b7280',
        cursor: 'pointer',
        position: 'relative',
        padding: '8px 2px 6px',
      }}
    >
      {active && (
        <span style={{ position: 'absolute', top: 0, left: '28%', right: '28%', height: 2, borderRadius: 2, background: 'var(--accent, #e5332a)' }} />
      )}
      <NavIcon name={icon} size={20} />
      <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, letterSpacing: '0.01em' }}>{label}</span>
    </button>
  );
}

const ghostButton: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  width: '100%',
  padding: '10px 12px',
  borderRadius: 12,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: 'var(--text, #f1f5f9)',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
};
