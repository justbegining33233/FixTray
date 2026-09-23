'use client';

import { usePhrase } from '@/lib/usePhrase';
export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRequireAuth } from '@/contexts/AuthContext';

type CustomerProfileSection = 'profile' | 'contact' | 'links';

function CustomerProfilePageContent() {
  const say = usePhrase();
  const { user, isLoading } = useRequireAuth(['customer']);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [section, setSection] = useState<CustomerProfileSection>('profile');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const raw = (searchParams?.get('section') || 'profile').toLowerCase();
    if (raw === 'profile' || raw === 'contact' || raw === 'links') {
      setSection(raw as CustomerProfileSection);
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
    const base = (name || user?.name || 'C').trim();
    const chars = base.split(/\s+/).map((p) => p[0]).join('').slice(0, 2);
    return chars.toUpperCase() || 'C';
  }, [name, user]);

  const openSection = (next: CustomerProfileSection) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('section', next);
    router.replace(`/customer/profile?${params.toString()}` as any, { scroll: false });
    setSection(next);
    setMessage('');
  };

  const handleSave = async () => {
    if (!name.trim() || !phone.trim()) {
      setMessage('Name and phone are required.');
      return;
    }
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
        {say("Loading...")}{' '}</div>
    );
  }

  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#000000', color: '#e2e8f0' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 20px' }}>
        <Link href={'/customer/dashboard' as Route} style={{ color: '#ffb4ad', textDecoration: 'none', fontSize: 14 }}>
          {say("Back to Customer Dashboard")}{' '}</Link>

        <div style={{ marginTop: 14, background: '#000000', border: '1px solid #1f2937', borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 30, color: '#f8fafc' }}>{say("Customer Profile")}</h1>
              <p style={{ marginTop: 8, color: '#94a3b8', fontSize: 14 }}>{say("Your personal customer account settings.")}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 999, background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.35)', color: '#fecaca', fontSize: 12, fontWeight: 700 }}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239,68,68,0.25)', color: '#fee2e2' }}>{say(initials)}</span>
              {name || user.name || say("Customer")}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 260px', gap: 18, marginTop: 20 }}>
            <div style={{ minWidth: 0 }}>
              {section === 'profile' && (
                <div style={{ background: '#0b1220', border: '1px solid #1e293b', borderRadius: 12, padding: 16 }}>
                  <h2 style={{ marginTop: 0, color: '#f8fafc', fontSize: 22 }}>{say("My Profile")}</h2>
                  <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 14 }}>{say("Overview of your customer account.")}</p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 14 }}>
                      <div style={{ color: '#94a3b8', fontSize: 12 }}>{say("Name")}</div>
                      <div style={{ fontWeight: 700, fontSize: 18, marginTop: 6 }}>{name || say("Not set")}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 14 }}>
                      <div style={{ color: '#94a3b8', fontSize: 12 }}>{say("Role")}</div>
                      <div style={{ fontWeight: 700, fontSize: 18, marginTop: 6 }}>customer</div>
                    </div>
                  </div>
                </div>
              )}

              {section === 'contact' && (
                <div style={{ background: '#0b1220', border: '1px solid #1e293b', borderRadius: 12, padding: 16 }}>
                  <h2 style={{ marginTop: 0, color: '#f8fafc', fontSize: 22 }}>{say("Contact & Settings")}</h2>
                  <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 14 }}>{say("Update your customer contact details.")}</p>

                  <div style={{ display: 'grid', gap: 10, maxWidth: 620 }}>
                    <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} style={{ display: 'grid', gap: 10 }}>
                    <input required aria-label={say("Full name")} value={name} onChange={(e) => setName(e.target.value)} placeholder={say("Full name")} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #334155', background: '#020617', color: '#e2e8f0' }} />
                    <input aria-label={say("Email")} value={email} disabled placeholder={say("Email")} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #1f2937', background: '#0b1220', color: '#94a3b8' }} />
                    <input required aria-label={say("Phone")} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={say("Phone")} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #334155', background: '#020617', color: '#e2e8f0' }} />
                    <button type="submit" disabled={saving} style={{ width: 'fit-content', padding: '10px 14px', borderRadius: 8, border: 'none', background: '#dc2626', color: 'white', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.75 : 1 }}>
                      {saving ? say("Saving...") : say("Save Changes")}
                    </button>
                    <Link href={'/customer/addresses' as Route} style={{ textDecoration: 'none', color: '#fecaca', fontWeight: 700 }}>
                      {say("Manage saved addresses")}{' '}</Link>
                    </form>
                  </div>
                </div>
              )}

              {section === 'links' && (
                <div style={{ background: '#0b1220', border: '1px solid #1e293b', borderRadius: 12, padding: 16 }}>
                  <h2 style={{ marginTop: 0, color: '#f8fafc', fontSize: 22 }}>{say("Quick Links")}</h2>
                  <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 14 }}>{say("Useful customer pages.")}</p>

                  <div style={{ display: 'grid', gap: 10, maxWidth: 460 }}>
                    <Link href={'/customer/addresses' as Route} style={{ textDecoration: 'none', color: '#fecaca', border: '1px solid #991b1b', borderRadius: 8, padding: '10px 12px', background: 'rgba(153,27,27,0.2)' }}>
                      {say("Saved Addresses")}{' '}</Link>
                    <Link href={'/customer/vehicles' as Route} style={{ textDecoration: 'none', color: '#fecaca', border: '1px solid #991b1b', borderRadius: 8, padding: '10px 12px', background: 'rgba(153,27,27,0.2)' }}>
                      {say("My Vehicles")}{' '}</Link>
                    <Link href={'/customer/workorders' as Route} style={{ textDecoration: 'none', color: '#fecaca', border: '1px solid #991b1b', borderRadius: 8, padding: '10px 12px', background: 'rgba(153,27,27,0.2)' }}>
                      {say("My Work Orders")}{' '}</Link>
                  </div>
                </div>
              )}

              {message && (
                <div style={{ marginTop: 12, fontSize: 13, color: message.toLowerCase().includes('success') ? '#4ade80' : '#fda4af' }}>
                  {say(message)}
                </div>
              )}
            </div>

            <div>
              <div style={{ background: '#0b1220', border: '1px solid #1e293b', borderRadius: 12, padding: 12, position: 'sticky', top: 24 }}>
                <div style={{ color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{say("Menu")}</div>
                <button onClick={() => openSection('profile')} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: section === 'profile' ? '1px solid rgba(239,68,68,0.45)' : '1px solid transparent', background: section === 'profile' ? 'rgba(239,68,68,0.14)' : 'transparent', color: '#e2e8f0', cursor: 'pointer', marginBottom: 8 }}>
                  {say("My Profile")}{' '}</button>
                <button onClick={() => openSection('contact')} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: section === 'contact' ? '1px solid rgba(239,68,68,0.45)' : '1px solid transparent', background: section === 'contact' ? 'rgba(239,68,68,0.14)' : 'transparent', color: '#e2e8f0', cursor: 'pointer', marginBottom: 8 }}>
                  {say("Contact & Settings")}{' '}</button>
                <button onClick={() => openSection('links')} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: section === 'links' ? '1px solid rgba(239,68,68,0.45)' : '1px solid transparent', background: section === 'links' ? 'rgba(239,68,68,0.14)' : 'transparent', color: '#e2e8f0', cursor: 'pointer' }}>
                  {say("Quick Links")}{' '}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CustomerProfilePage() {
  const say = usePhrase();
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', background: '#000000', color: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {say("Loading...")}{' '}</div>
      }
    >
      <CustomerProfilePageContent />
    </Suspense>
  );
}


