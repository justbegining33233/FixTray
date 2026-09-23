'use client';

import Link from 'next/link';
import { usePhrase } from '@/lib/usePhrase';
import { useRequireAuth } from '@/contexts/AuthContext';
import TechTrackingMap from '@/components/TechTrackingMap';
import { FaArrowLeft } from 'react-icons/fa';

export default function ManagerMapPage() {
  const say = usePhrase();
  const { user, isLoading } = useRequireAuth(['manager']);

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>
        {say('Loading...')}
      </div>
    );
  }
  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'transparent' }}>
      <div style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(229,51,42,0.3)', padding: '20px 32px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <Link href="/manager/home" style={{ color: '#e5332a', textDecoration: 'none', fontSize: 14, fontWeight: 600, marginBottom: 8, display: 'inline-block' }}>
            <FaArrowLeft style={{ marginRight: 4 }} /> {say('Back to Manager Home')}
          </Link>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', margin: '0 0 4px' }}>Road Call Map</h1>
          <p style={{ fontSize: 14, color: '#9aa3b2', margin: 0 }}>Shop address and technicians on active road calls</p>
        </div>
      </div>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: 32 }}>
        <TechTrackingMap />
      </div>
    </div>
  );
}
