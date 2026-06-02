'use client';

import Link from 'next/link';
import MessagingCard from '@/components/MessagingCard';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaComments } from 'react-icons/fa';

export default function AdminMessages() {
  const { user, isLoading } = useRequireAuth(['admin', 'superadmin']);

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>
        Loading...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000000' }}>
      <div style={{ background: 'rgba(0,0,0,0.5)', borderBottom: '1px solid rgba(99,102,241,0.3)', padding: '20px 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Link
            href="/admin/home"
            style={{ color: '#818cf8', textDecoration: 'none', fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'inline-block' }}
          >
            <FaArrowLeft style={{marginRight:4}} /> Back to Admin Dashboard
          </Link>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', marginBottom: 8 }}><FaComments style={{marginRight:4}} /> Platform Messages</h1>
              <p style={{ fontSize: 14, color: '#9aa3b2' }}>Message shops and platform users</p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 32 }}>
        <MessagingCard userId={user.id} shopId="" />
      </div>
    </div>
  );
}

