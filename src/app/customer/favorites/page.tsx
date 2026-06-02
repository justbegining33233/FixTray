'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaMapMarkerAlt, FaStar } from 'react-icons/fa';

export default function Favorites() {
  useRequireAuth(['customer']);
  const [userName, setUserName] = useState('');
  const [favorites] = useState<{id: string; name: string; type: string; location: string; rating: number; distance: string; address: string; services: string[]}[]>([]);

  useEffect(() => {
    const name = localStorage.getItem('userName') || '';
    setUserName(name);
  }, []);

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

        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(350px, 1fr))', gap:24}}>
          {favorites.map(shop => (
            <div key={shop.id} style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
              <div style={{marginBottom:16}}>
                <h3 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:4}}>{shop.name}</h3>
                <div style={{fontSize:14, color:'#e5332a', fontWeight:600, marginBottom:8}}>{shop.type}</div>
                <div style={{display:'flex', alignItems:'center', gap:16, marginBottom:12}}>
                  <span style={{fontSize:14, color:'#9aa3b2'}}><FaStar style={{marginRight:4}} /> {shop.rating}</span>
                  <span style={{fontSize:14, color:'#9aa3b2'}}><FaMapMarkerAlt style={{marginRight:4}} /> {shop.distance}</span>
                </div>
                <div style={{fontSize:14, color:'#9aa3b2', marginBottom:12}}>{shop.address}</div>
                <div style={{display:'flex', flexWrap:'wrap', gap:8, marginBottom:16}}>
                  {shop.services.map(service => (
                    <span key={service} style={{padding:'4px 8px', background:'rgba(229,51,42,0.2)', color:'#ff6b64', borderRadius:6, fontSize:12, fontWeight:600}}>
                      {service}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{display:'flex', gap:12}}>
                <button style={{
                  flex:1,
                  padding:'12px',
                  background:'#e5332a',
                  color:'white',
                  border:'none',
                  borderRadius:8,
                  fontSize:14,
                  fontWeight:600,
                  cursor:'pointer'
                }}>
                  Book Appointment
                </button>
                <button style={{
                  flex:1,
                  padding:'12px',
                  background:'rgba(239,68,68,0.1)',
                  color:'#ef4444',
                  border:'1px solid rgba(239,68,68,0.3)',
                  borderRadius:8,
                  fontSize:14,
                  fontWeight:600,
                  cursor:'pointer'
                }}>
                  Remove Favorite
                </button>
              </div>
            </div>
          ))}
        </div>

        {favorites.length === 0 && (
          <div style={{textAlign:'center', padding:40, color:'#9aa3b2'}}>
            No favorite shops yet. Start exploring and add some favorites!
          </div>
        )}

        {/* Back to Dashboard */}
        <div style={{marginTop:32, textAlign:'center'}}>
          <Link href="/customer/dashboard" style={{
            padding:'12px 24px',
            background:'#e5332a',
            color:'white',
            border:'none',
            borderRadius:8,
            fontSize:16,
            fontWeight:600,
            textDecoration:'none',
            cursor:'pointer'
          }}>
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
