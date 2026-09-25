'use client';

import Link from 'next/link';
import { usePhrase } from '@/lib/usePhrase';

const card = {
  display: 'block',
  padding: 16,
  borderRadius: 12,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#e5e7eb',
  textDecoration: 'none',
  fontWeight: 700,
} as const;

export default function ManagerAdminRootPage() {
  const say = usePhrase();
  return (
    <main style={{ minHeight: '100vh', background: '#000000', color: '#e5e7eb', padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>{say('Admin')}</h1>
      <p style={{ color: '#9aa3b2', marginBottom: 20 }}>{say('Shop administration for managers.')}</p>
      <div style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
        <Link href="/manager/admin/logs" style={card}>{say('Logs')}</Link>
        <Link href="/manager/admin/settings" style={card}>{say('Settings')}</Link>
      </div>
    </main>
  );
}
