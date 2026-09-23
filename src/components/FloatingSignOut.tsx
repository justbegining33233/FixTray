'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { FaSignOutAlt } from 'react-icons/fa';

export default function FloatingSignOut() {
  const say = usePhrase();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    // Only show when logged in (not on login/auth pages)
    const isAuthPage = pathname?.startsWith('/auth');
    const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('token');
    setVisible(!isAuthPage && hasToken);
  }, [pathname]);

  // Hidden on mobile — MobileNav already has Sign Out.
  // These customer pages already render a labeled Sign Out (VIS-041).
  const pageHasSignOut = pathname === '/customer/favorites' || pathname === '/customer/recurring-approvals';
  if (!visible || isMobile || pageHasSignOut) return null;

  const handleSignOut = async () => {
    try {
      // Call logout API to clear httpOnly cookies
      const csrfToken = document.cookie.match(/csrf_token=([^;]+)/)?.[1] || '';
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-csrf-token': csrfToken },
      }).catch(() => {});
    } catch {
      // Continue with client-side cleanup even if API fails
    }
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    localStorage.removeItem('shopId');
    localStorage.removeItem('userId');
    window.location.href = '/auth/login';
  };

  return (
    <button
      onClick={handleSignOut}
      style={{
        position: 'fixed',
        bottom: 80,
        right: 12,
        zIndex: 9999,
        background: '#e5332a',
        color: 'white',
        border: 'none',
        borderRadius: 50,
        width: 48,
        height: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 20,
        boxShadow: '0 4px 14px rgba(229,51,42,0.4)',
        cursor: 'pointer',
      }}
      title={say("Sign Out")}
    >
      <FaSignOutAlt style={{marginRight:4}} />
    </button>
  );
}
