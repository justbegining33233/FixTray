'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import TopNavBar from '@/components/TopNavBar';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaCamera } from 'react-icons/fa';

type ShopPhoto = { id: string; url: string; filename?: string; caption?: string; workOrderId?: string };

export default function ShopPhotosPage() {
  const { user, isLoading } = useRequireAuth(['shop', 'manager']);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [photos, setPhotos] = useState<ShopPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('token');
    fetch('/api/photos', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async (res) => {
        if (!res.ok) {
          setError('Shop photos could not be loaded.');
          return;
        }
        const json = await res.json();
        setPhotos(Array.isArray(json.photos) ? json.photos : []);
      })
      .catch(() => setError('Shop photos could not be loaded.'))
      .finally(() => setLoading(false));
  }, [user]);

  if (isLoading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  }
  if (!user) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#000000' }}>
      <Sidebar role={user.role === 'manager' ? 'manager' : 'shop'} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopNavBar onMenuToggle={() => setSidebarOpen((open) => !open)} showMenuButton />
        <main style={{ flex: 1, padding: 24, maxWidth: 1100, margin: '0 auto', width: '100%' }}>
          <h1 style={{ color: '#e5e7eb', fontSize: 28, fontWeight: 700, marginBottom: 8 }}><FaCamera style={{ marginRight: 8 }} /> Shop Photos</h1>
          <p style={{ color: '#9aa3b2', marginBottom: 24 }}>Photos uploaded on jobs for this shop.</p>
          {loading && <p style={{ color: '#9aa3b2' }}>Loading photos...</p>}
          {error && <p style={{ color: '#fca5a5' }}>{error}</p>}
          {!loading && !error && photos.length === 0 && (
            <div style={{ background: '#111827', border: '1px solid #374151', borderRadius: 12, padding: 32, color: '#9aa3b2' }}>
              No shop photos yet. Technicians add photos from their Photos page while they are on a job.
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {photos.map((photo) => (
              <div key={photo.id} style={{ background: '#000', borderRadius: 8, overflow: 'hidden' }}>
                <img src={photo.url} alt={photo.caption || photo.filename || 'Shop photo'} style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
                <div style={{ padding: 8, color: '#e5e7eb', fontSize: 12 }}>{photo.caption || photo.filename || 'Photo'}</div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
