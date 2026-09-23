'use client';

import { usePhrase } from '@/lib/usePhrase';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';

const LINKS = [
  { href: '/tech/settings/two-factor', label: 'Two-Factor Authentication', desc: 'Add a second step when you sign in' },
  { href: '/tech/share-location', label: 'Location sharing', desc: 'Share GPS with dispatch' },
  { href: '/tech/timesheet', label: 'Timesheet', desc: 'Review clocked hours' },
];

export default function TechSettingsHub() {
  const say = usePhrase();
  const { user, isLoading } = useRequireAuth(['tech']);
  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>{say("Loading...")}</div>;
  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', padding: 24 }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ color: '#e5e7eb', fontSize: 28, fontWeight: 700, marginBottom: 8 }}>{say("Technician Settings")}</h1>
        <p style={{ color: '#9aa3b2', marginBottom: 24 }}>{say("Choose a settings area. Two-factor is optional, not the only page.")}</p>
        <div style={{ display: 'grid', gap: 12 }}>
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href as any}
              style={{ display: 'block', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16, textDecoration: 'none' }}
            >
              <div style={{ color: '#e5e7eb', fontWeight: 700 }}>{say(link.label)}</div>
              <div style={{ color: '#9aa3b2', fontSize: 13, marginTop: 4 }}>{say(link.desc)}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
