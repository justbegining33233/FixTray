'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaStar } from 'react-icons/fa';

interface Review {
  id: string;
  shop: string;
  service: string;
  vehicle: string;
  date: string;
  rating: number;
  review: string;
}

export default function Reviews() {
  useRequireAuth(['customer']);
  const [userName, setUserName] = useState('');
  const [reviews] = useState<Review[]>([]);

  useEffect(() => {
    const name = localStorage.getItem('userName') || '';
    setUserName(name);
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    window.location.href = '/auth/login';
  };

  const renderStars = (rating: number) => {
    return Array.from({length: rating}, (_, i) => <FaStar key={i} />);
  };

  return (
    <div style={{minHeight:'100vh', background: 'transparent'}}>
      {/* Header */}
      <div style={{background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(229,51,42,0.3)', padding:'16px 32px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div style={{display:'flex', alignItems:'center', gap:24}}>
          <Link href="/customer/dashboard" style={{fontSize:24, fontWeight:900, color:'#e5332a', textDecoration:'none'}}>FixTray</Link>
          <div>
            <div style={{fontSize:20, fontWeight:700, color:'#e5e7eb'}}>Customer Portal</div>
            <div style={{fontSize:12, color:'#9aa3b2'}}>Reviews</div>
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
        <h1 style={{fontSize:32, fontWeight:700, color:'#e5e7eb', marginBottom:32}}>My Reviews</h1>

        <div style={{display:'flex', flexDirection:'column', gap:24}}>
          {reviews.map(review => (
            <div key={review.id} style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16}}>
                <div>
                  <h3 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:4}}>{review.shop}</h3>
                  <div style={{fontSize:16, color:'#e5332a', fontWeight:600, marginBottom:4}}>{review.service}</div>
                  <div style={{fontSize:14, color:'#9aa3b2', marginBottom:8}}>{review.vehicle} - {review.date}</div>
                  <div style={{fontSize:18, marginBottom:12}}>{renderStars(review.rating)}</div>
                  <div style={{fontSize:14, color:'#e5e7eb', lineHeight:1.5}}>{review.review}</div>
                </div>
              </div>
              <div style={{display:'flex', gap:12}}>
                <button style={{
                  padding:'8px 16px',
                  background:'#e5332a',
                  color:'white',
                  border:'none',
                  borderRadius:6,
                  fontSize:14,
                  fontWeight:600,
                  cursor:'pointer'
                }}>
                  Edit Review
                </button>
                <button style={{
                  padding:'8px 16px',
                  background:'rgba(239,68,68,0.1)',
                  color:'#ef4444',
                  border:'1px solid rgba(239,68,68,0.3)',
                  borderRadius:6,
                  fontSize:14,
                  fontWeight:600,
                  cursor:'pointer'
                }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {reviews.length === 0 && (
          <div style={{textAlign:'center', padding:40, color:'#9aa3b2'}}>
            No reviews yet. Complete a service to leave your first review!
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
