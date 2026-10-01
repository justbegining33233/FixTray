'use client';

import { useEffect } from 'react';

export default function LogoutPage() {
  useEffect(() => {
    const signOut = async () => {
      try {
        const csrfToken = document.cookie.match(/csrf_token=([^;]+)/)?.[1] || '';
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
          headers: { 'x-csrf-token': csrfToken },
        });
      } catch {
        // Still clear the local session if the request fails.
      }
      for (const key of [
        'token',
        'userRole',
        'userName',
        'userId',
        'shopId',
        'isShopAdmin',
        'shopProfileComplete',
        'isSuperAdmin',
        'isOwner',
      ]) {
        localStorage.removeItem(key);
      }
      window.location.replace('/auth/login');
    };
    void signOut();
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>
      Signing out...
    </div>
  );
}
