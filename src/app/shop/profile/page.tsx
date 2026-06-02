'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRequireAuth } from '@/contexts/AuthContext';

type ShopProfileSection = 'profile' | 'details' | 'links';

type ShopInfo = {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  hours: string;
  description: string;
};

function ShopProfilePageContent() {
  const { user, isLoading } = useRequireAuth(['shop', 'superadmin']);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [section, setSection] = useState<ShopProfileSection>('profile');
  const [shop, setShop] = useState<ShopInfo>({
    name: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
    email: '',
    hours: '',
    description: '',
  });
  const [loadingShop, setLoadingShop] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const raw = (searchParams?.get('section') || 'profile').toLowerCase();
    if (raw === 'profile' || raw === 'details' || raw === 'links') {
      setSection(raw as ShopProfileSection);
      return;
    }
    setSection('profile');
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;

    const fetchShop = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/shops/settings', {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) return;
        const data = await res.json();
        const shopData = data?.shop || {};
        setShop({
          name: shopData.name || shopData.shopName || '',
          address: shopData.address || '',
          city: shopData.city || '',
          state: shopData.state || '',
          zip: shopData.zip || shopData.zipCode || '',
          phone: shopData.phone || '',
          email: shopData.email || '',
          hours: shopData.hours || shopData.businessHours || '',
          description: shopData.description || '',
        });
      } catch {
      } finally {
        setLoadingShop(false);
      }
    };

    fetchShop();
  }, [user]);

  const initials = useMemo(() => {
    const base = (shop.name || user?.name || 'S').trim();
    const chars = base.split(/\s+/).map((p) => p[0]).join('').slice(0, 2);
    return chars.toUpperCase() || 'S';
  }, [shop.name, user]);

  const openSection = (next: ShopProfileSection) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('section', next);
    router.replace(`/shop/profile?${params.toString()}` as Route, { scroll: false });
    setSection(next);
    setMessage('');
  };

  const handleSave = async () => {
    if (!user) {
      setMessage('Unable to save profile right now.');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/shops/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          shopId: user.id,
          shopName: shop.name,
          email: shop.email,
          phone: shop.phone,
          address: shop.address,
          city: shop.city,
          state: shop.state,
          zipCode: shop.zip,
        }),
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

  if (isLoading || loadingShop) {
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
        <Link href={'/shop/home' as Route} style={{ color: '#ffb4ad', textDecoration: 'none', fontSize: 14 }}>
          Back to Shop Home
        </Link>

        <div style={{ marginTop: 14, background: '#000000', border: '1px solid #1f2937', borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 30, color: '#f8fafc' }}>Shop Profile</h1>
              <p style={{ marginTop: 8, color: '#94a3b8', fontSize: 14 }}>Your shop details and account information.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 999, background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.35)', color: '#86efac', fontSize: 12, fontWeight: 700 }}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(34,197,94,0.25)', color: '#dcfce7' }}>{initials}</span>
              {shop.name || user.name || 'Shop'}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 260px', gap: 18, marginTop: 20 }}>
            <div style={{ minWidth: 0 }}>
              {section === 'profile' && (
                <div style={{ background: '#0b1220', border: '1px solid #1e293b', borderRadius: 12, padding: 16 }}>
                  <h2 style={{ marginTop: 0, color: '#f8fafc', fontSize: 22 }}>My Profile</h2>
                  <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 14 }}>Overview of your shop account.</p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 14 }}>
                      <div style={{ color: '#94a3b8', fontSize: 12 }}>Shop Name</div>
                      <div style={{ fontWeight: 700, fontSize: 18, marginTop: 6 }}>{shop.name || 'Not set'}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 14 }}>
                      <div style={{ color: '#94a3b8', fontSize: 12 }}>Location</div>
                      <div style={{ fontWeight: 700, fontSize: 18, marginTop: 6 }}>{[shop.city, shop.state].filter(Boolean).join(', ') || 'Not set'}</div>
                    </div>
                  </div>
                </div>
              )}

              {section === 'details' && (
                <div style={{ background: '#0b1220', border: '1px solid #1e293b', borderRadius: 12, padding: 16 }}>
                  <h2 style={{ marginTop: 0, color: '#f8fafc', fontSize: 22 }}>Shop Details</h2>
                  <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 14 }}>Update your shop contact and address details.</p>

                  <div style={{ display: 'grid', gap: 10, maxWidth: 700 }}>
                    <input value={shop.name} onChange={(e) => setShop((p) => ({ ...p, name: e.target.value }))} placeholder="Shop name" style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #334155', background: '#020617', color: '#e2e8f0' }} />
                    <input value={shop.phone} onChange={(e) => setShop((p) => ({ ...p, phone: e.target.value }))} placeholder="Phone" style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #334155', background: '#020617', color: '#e2e8f0' }} />
                    <input value={shop.email} onChange={(e) => setShop((p) => ({ ...p, email: e.target.value }))} placeholder="Email" style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #334155', background: '#020617', color: '#e2e8f0' }} />
                    <input value={shop.hours} onChange={(e) => setShop((p) => ({ ...p, hours: e.target.value }))} placeholder="Business hours" style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #334155', background: '#020617', color: '#e2e8f0' }} />
                    <input value={shop.address} onChange={(e) => setShop((p) => ({ ...p, address: e.target.value }))} placeholder="Address" style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #334155', background: '#020617', color: '#e2e8f0' }} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                      <input value={shop.city} onChange={(e) => setShop((p) => ({ ...p, city: e.target.value }))} placeholder="City" style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #334155', background: '#020617', color: '#e2e8f0' }} />
                      <input value={shop.state} onChange={(e) => setShop((p) => ({ ...p, state: e.target.value }))} placeholder="State" style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #334155', background: '#020617', color: '#e2e8f0' }} />
                      <input value={shop.zip} onChange={(e) => setShop((p) => ({ ...p, zip: e.target.value }))} placeholder="ZIP" style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #334155', background: '#020617', color: '#e2e8f0' }} />
                    </div>
                    <textarea value={shop.description} onChange={(e) => setShop((p) => ({ ...p, description: e.target.value }))} rows={4} placeholder="Shop description" style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #334155', background: '#020617', color: '#e2e8f0', resize: 'vertical' }} />
                    <button onClick={handleSave} disabled={saving} style={{ width: 'fit-content', padding: '10px 14px', borderRadius: 8, border: 'none', background: '#16a34a', color: 'white', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.75 : 1 }}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              )}

              {section === 'links' && (
                <div style={{ background: '#0b1220', border: '1px solid #1e293b', borderRadius: 12, padding: 16 }}>
                  <h2 style={{ marginTop: 0, color: '#f8fafc', fontSize: 22 }}>Quick Links</h2>
                  <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 14 }}>Jump to commonly used shop pages.</p>

                  <div style={{ display: 'grid', gap: 10, maxWidth: 460 }}>
                    <Link href={'/shop/settings' as Route} style={{ textDecoration: 'none', color: '#86efac', border: '1px solid #166534', borderRadius: 8, padding: '10px 12px', background: 'rgba(22,101,52,0.2)' }}>
                      Shop Settings
                    </Link>
                    <Link href={'/shop/home' as Route} style={{ textDecoration: 'none', color: '#86efac', border: '1px solid #166534', borderRadius: 8, padding: '10px 12px', background: 'rgba(22,101,52,0.2)' }}>
                      Shop Dashboard
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
                <button onClick={() => openSection('profile')} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: section === 'profile' ? '1px solid rgba(34,197,94,0.45)' : '1px solid transparent', background: section === 'profile' ? 'rgba(34,197,94,0.14)' : 'transparent', color: '#e2e8f0', cursor: 'pointer', marginBottom: 8 }}>
                  My Profile
                </button>
                <button onClick={() => openSection('details')} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: section === 'details' ? '1px solid rgba(34,197,94,0.45)' : '1px solid transparent', background: section === 'details' ? 'rgba(34,197,94,0.14)' : 'transparent', color: '#e2e8f0', cursor: 'pointer', marginBottom: 8 }}>
                  Shop Details
                </button>
                <button onClick={() => openSection('links')} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: section === 'links' ? '1px solid rgba(34,197,94,0.45)' : '1px solid transparent', background: section === 'links' ? 'rgba(34,197,94,0.14)' : 'transparent', color: '#e2e8f0', cursor: 'pointer' }}>
                  Quick Links
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ShopProfilePage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', background: '#000000', color: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          Loading...
        </div>
      }
    >
      <ShopProfilePageContent />
    </Suspense>
  );
}


