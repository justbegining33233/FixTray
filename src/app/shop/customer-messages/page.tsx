'use client';

import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import MessagingCard from '@/components/MessagingCard';
import { FaArrowLeft, FaComments } from 'react-icons/fa';

export default function CustomerMessagesPage() {
  const { user, isLoading } = useRequireAuth(['shop']);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#e5e7eb',
        fontSize: '18px'
      }}>
        Loading...
      </div>
    );
  }

  // If no user, the useRequireAuth hook will handle redirect
  if (!user) {
    return null;
  }

  if (!user?.id || !user?.shopId) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  }

  return (
    <div style={{ minHeight: '100vh', background: 'transparent' }}>
      <div style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(245,158,11,0.3)', padding: '20px 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Link href="/shop/admin" style={{ color: '#e5332a', textDecoration: 'none', fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'inline-block' }}>
            <FaArrowLeft style={{marginRight:4}} /> Back to Dashboard
          </Link>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', marginBottom: 8 }}><FaComments style={{marginRight:4}} /> Customer Messages</h1>
              <p style={{ fontSize: 14, color: '#9aa3b2' }}>Same messaging system as shop admin and tech portals</p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 32 }}>
        <MessagingCard userId={user.id} shopId={user.shopId || user.id} />
      </div>
    </div>
  );
}

