'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaMapMarkerAlt, FaTrash } from 'react-icons/fa';

interface FavoriteEntry {
  favoriteId: string;
  createdAt: string;
  shop: {
    id: string;
    shopName: string;
    shopType: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    phone?: string;
    services: { serviceName: string; category: string }[];
  } | null;
}

export default function Favorites() {
  useRequireAuth(['customer']);
  const [userName, setUserName] = useState('');
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<Set<string>>(new Set());

  useEffect(() => {
    const name = localStorage.getItem('userName') || '';
    setUserName(name);
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/customers/favorites', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFavorites(data.favorites || []);
      }
    } catch (err) {
      console.error('Error fetching favorites:', err);
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = async (favoriteId: string) => {
    if (removing.has(favoriteId)) return;
    setRemoving(prev => new Set(prev).add(favoriteId));
    // Optimistic remove
    setFavorites(prev => prev.filter(f => f.favoriteId !== favoriteId));
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/customers/favorites/${favoriteId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) fetchFavorites(); // revert on failure
    } catch {
      fetchFavorites();
    } finally {
      setRemoving(prev => { const s = new Set(prev); s.delete(favoriteId); return s; });
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    window.location.href = '/auth/login';
  };

  return (
    <div style={{minHeight:'100vh', background: 'transparent'}}>
      {/* Header */}
      <div style={{background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(229,51,42,0.3)', padding:'16px 32px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div style={{display:'flex', alignItems:'center', gap:24}}>
          <Link href="/customer/dashboard" style={{fontSize:24, fontWeight:900, color:'#e5332a', textDecoration:'none'}}>FixTray</Link>
          <div>
            <div style={{fontSize:20, fontWeight:700, color:'#e5e7eb'}}>Customer Portal</div>
            <div style={{fontSize:12, color:'#9aa3b2'}}>Favorites</div>
          </div>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:16}}>
          <span style={{fontSize:14, color:'#9aa3b2'}}>Welcome, {userName}</span>
          <button onClick={handleSignOut} style={{padding:'8px 16px', background:'#e5332a', color:'white', border:'none', borderRadius:6, cursor:'pointer', fontSize:13, fontWeight:600}}>
            Sign Out
          </button>
        </div>
      </div>

      <div style={{maxWidth:1200, margin:'0 auto', padding:32}}>
        <h1 style={{fontSize:32, fontWeight:700, color:'#e5e7eb', marginBottom:32}}>Favorite Shops</h1>

        {loading ? (
          <div style={{textAlign:'center', padding:40, color:'#9aa3b2'}}>Loading favorites...</div>
        ) : (
          <>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(350px, 1fr))', gap:24}}>
              {favorites.map(entry => {
                const shop = entry.shop;
                if (!shop) return null;
                const address = [shop.address, shop.city, shop.state, shop.zipCode].filter(Boolean).join(', ');
                return (
                  <div key={entry.favoriteId} style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
                    <div style={{marginBottom:16}}>
                      <h3 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:4}}>{shop.shopName}</h3>
                      <div style={{fontSize:14, color:'#e5332a', fontWeight:600, marginBottom:8}}>{shop.shopType}</div>
                      <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:12}}>
                        <FaMapMarkerAlt style={{color:'#9aa3b2'}} />
                        <span style={{fontSize:14, color:'#9aa3b2'}}>{address}</span>
                      </div>
                      {shop.phone && (
                        <div style={{fontSize:14, color:'#9aa3b2', marginBottom:12}}>{shop.phone}</div>
                      )}
                      <div style={{display:'flex', flexWrap:'wrap', gap:8, marginBottom:16}}>
                        {shop.services.slice(0, 5).map(svc => (
                          <span key={svc.serviceName} style={{padding:'4px 8px', background:'rgba(229,51,42,0.2)', color:'#ff6b64', borderRadius:6, fontSize:12, fontWeight:600}}>
                            {svc.serviceName}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div style={{display:'flex', gap:12}}>
                      <Link
                        href={`/customer/appointments/new?shopId=${shop.id}` as any}
                        style={{
                          flex:1, padding:'12px', background:'#e5332a', color:'white',
                          border:'none', borderRadius:8, fontSize:14, fontWeight:600,
                          cursor:'pointer', textDecoration:'none', textAlign:'center',
                        }}
                      >
                        Book Appointment
                      </Link>
                      <button
                        onClick={() => removeFavorite(entry.favoriteId)}
                        disabled={removing.has(entry.favoriteId)}
                        style={{
                          display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                          padding:'12px 16px', background:'rgba(239,68,68,0.1)', color:'#ef4444',
                          border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, fontSize:14,
                          fontWeight:600, cursor:'pointer', opacity: removing.has(entry.favoriteId) ? 0.5 : 1,
                        }}
                      >
                        <FaTrash /> Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {favorites.length === 0 && (
              <div style={{textAlign:'center', padding:40, color:'#9aa3b2'}}>
                No favorite shops yet.{' '}
                <Link href="/customer/findshops" style={{color:'#e5332a'}}>Find shops near you</Link>
              </div>
            )}
          </>
        )}

        {/* Back to Dashboard */}
        <div style={{marginTop:32, textAlign:'center'}}>
          <Link href="/customer/dashboard" style={{
            padding:'12px 24px', background:'#e5332a', color:'white',
            border:'none', borderRadius:8, fontSize:16, fontWeight:600,
            textDecoration:'none', cursor:'pointer'
          }}>
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
