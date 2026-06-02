'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRequireAuth } from '@/contexts/AuthContext';

type SuperAdminProfileSection = 'profile' | 'contact' | 'security';

function SuperAdminProfilePageContent() {
  const { user, isLoading } = useRequireAuth(['admin', 'superadmin']);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [section, setSection] = useState<SuperAdminProfileSection>('profile');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const raw = (searchParams?.get('section') || 'profile').toLowerCase();
    if (raw === 'profile' || raw === 'contact' || raw === 'security') {
      setSection(raw as SuperAdminProfileSection);
      return;
    }
    setSection('profile');
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;
    const u = user as Record<string, unknown>;
    setName((u.name as string) || '');
    setEmail((u.email as string) || '');
    setPhone((u.phone as string) || '');
  }, [user]);

  const initials = useMemo(() => {
    const base = (name || user?.name || 'S').trim();
    const chars = base.split(/\s+/).map((p) => p[0]).join('').slice(0, 2);
    return chars.toUpperCase() || 'SA';
  }, [name, user]);

  const openSection = (next: SuperAdminProfileSection) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('section', next);
    router.replace(`/superadmin/profile?${params.toString()}` as Route, { scroll: false });
    setSection(next);
    setMessage('');
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ name, phone }),
      });

      if (!res.ok) {
        setMessage('Unable to save profile right now.');
        return;
      }

      setMessage('Profile updated successfully.');
    } catch {
      setMessage('Unable to save profile right now.');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#000000', color: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Loading...
      </div>
    );
  }

  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#000000', color: '#e2e8f0' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 20px' }}>
        <Link href={'/admin/home' as Route} style={{ color: '#ffb4ad', textDecoration: 'none', fontSize: 14 }}>
          Back to Super Admin Dashboard
        </Link>

        <div style={{ marginTop: 14, background: '#000000', border: '1px solid #1f2937', borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 30, color: '#f8fafc' }}>Super Admin Profile</h1>
              <p style={{ marginTop: 8, color: '#94a3b8', fontSize: 14 }}>Personal profile and account security for your own login.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 999, background: 'rgba(99,102,241,0.14)', border: '1px solid rgba(99,102,241,0.35)', color: '#c7d2fe', fontSize: 12, fontWeight: 700 }}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(99,102,241,0.25)', color: '#e0e7ff' }}>{initials}</span>
              {user.name || 'Super Admin'}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 260px', gap: 18, marginTop: 20 }}>
            <div style={{ minWidth: 0 }}>
              {section === 'profile' && (
                <div style={{ background: '#0b1220', border: '1px solid #1e293b', borderRadius: 12, padding: 16 }}>
                  <h2 style={{ marginTop: 0, color: '#f8fafc', fontSize: 22 }}>My Profile</h2>
                  <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 14 }}>Only your own account information is available here.</p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 14 }}>
                      <div style={{ color: '#94a3b8', fontSize: 12 }}>Name</div>
                      <div style={{ fontWeight: 700, fontSize: 18, marginTop: 6 }}>{name || 'Not set'}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 14 }}>
                      <div style={{ color: '#94a3b8', fontSize: 12 }}>Role</div>
                      <div style={{ fontWeight: 700, fontSize: 18, marginTop: 6 }}>superadmin</div>
                    </div>
                  </div>
                </div>
              )}

              {section === 'contact' && (
                <div style={{ background: '#0b1220', border: '1px solid #1e293b', borderRadius: 12, padding: 16 }}>
                  <h2 style={{ marginTop: 0, color: '#f8fafc', fontSize: 22 }}>Contact & Settings</h2>
                  <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 14 }}>Update your personal profile details.</p>

                  <div style={{ display: 'grid', gap: 10, maxWidth: 620 }}>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Full name"
                      style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #334155', background: '#020617', color: '#e2e8f0' }}
                    />
                    <input
                      value={email}
                      disabled
                      placeholder="Email"
                      style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #1f2937', background: '#0b1220', color: '#94a3b8' }}
                    />
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Phone"
                      style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #334155', background: '#020617', color: '#e2e8f0' }}
                    />
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      style={{ width: 'fit-content', padding: '10px 14px', borderRadius: 8, border: 'none', background: '#e5332a', color: 'white', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.75 : 1 }}
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              )}

              {section === 'security' && (
                <div style={{ background: '#0b1220', border: '1px solid #1e293b', borderRadius: 12, padding: 16 }}>
                  <h2 style={{ marginTop: 0, color: '#f8fafc', fontSize: 22 }}>Security & Links</h2>
                  <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 14 }}>Open your security and global settings pages.</p>

                  <div style={{ display: 'grid', gap: 10, maxWidth: 460 }}>
                    <Link href={'/superadmin/security' as Route} style={{ textDecoration: 'none', color: '#c7d2fe', border: '1px solid #3730a3', borderRadius: 8, padding: '10px 12px', background: 'rgba(55,48,163,0.2)' }}>
                      Security Settings
                    </Link>
                    <Link href={'/superadmin/settings' as Route} style={{ textDecoration: 'none', color: '#c7d2fe', border: '1px solid #3730a3', borderRadius: 8, padding: '10px 12px', background: 'rgba(55,48,163,0.2)' }}>
                      Global Settings
                    </Link>
                  </div>
                </div>
              )}

              {message && (
                <div style={{ marginTop: 12, fontSize: 13, color: message.toLowerCase().includes('success') ? '#4ade80' : '#fda4af' }}>
                  {message}
                </div>
              )}
            </div>

            <div>
              <div style={{ background: '#0b1220', border: '1px solid #1e293b', borderRadius: 12, padding: 12, position: 'sticky', top: 24 }}>
                <div style={{ color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Menu</div>
                <button onClick={() => openSection('profile')} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: section === 'profile' ? '1px solid rgba(99,102,241,0.45)' : '1px solid transparent', background: section === 'profile' ? 'rgba(99,102,241,0.14)' : 'transparent', color: '#e2e8f0', cursor: 'pointer', marginBottom: 8 }}>
                  My Profile
                </button>
                <button onClick={() => openSection('contact')} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: section === 'contact' ? '1px solid rgba(99,102,241,0.45)' : '1px solid transparent', background: section === 'contact' ? 'rgba(99,102,241,0.14)' : 'transparent', color: '#e2e8f0', cursor: 'pointer', marginBottom: 8 }}>
                  Contact & Settings
                </button>
                <button onClick={() => openSection('security')} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: section === 'security' ? '1px solid rgba(99,102,241,0.45)' : '1px solid transparent', background: section === 'security' ? 'rgba(99,102,241,0.14)' : 'transparent', color: '#e2e8f0', cursor: 'pointer' }}>
                  Security & Links
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SuperAdminProfilePage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', background: '#000000', color: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          Loading...
        </div>
      }
    >
      <SuperAdminProfilePageContent />
    </Suspense>
  );
}


