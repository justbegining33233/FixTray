'use client';
import { FaArrowLeft, FaBuilding, FaCalendarAlt, FaCheck, FaComments, FaDollarSign, FaEnvelope, FaHourglassHalf, FaMapMarkerAlt, FaPhone, FaRegStar, FaStar, FaStopwatch, FaStore, FaUsers, FaWrench } from 'react-icons/fa';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';

interface ShopDetails {
  id: string;
  shopName: string;
  ownerName?: string;
  email: string;
  phone: string;
  address: string;
  city?: string;
  state?: string;
  zipCode: string;
  shopType?: string;
  capacity?: number;
  slotDuration?: number;
  services: Array<{
    id: string;
    serviceName: string;
    category: string;
    price?: number;
    duration?: number;
    description?: string;
  }>;
  completedJobs: number;
  averageRating: number;
  totalReviews: number;
  isFavorite: boolean;
}

interface Props {
  params: Promise<{
    id: string;
  }>;
}

export default function ShopDetailsPage({ params }: Props) {
  useRequireAuth(['customer']);
  const [shop, setShop] = useState<ShopDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingFavorite, setTogglingFavorite] = useState(false);
  const [userName, setUserName] = useState('');
  const [shopId, setShopId] = useState<string>('');

  useEffect(() => {
    const initPage = async () => {
      const resolvedParams = await params;
      setShopId(resolvedParams.id);
      const name = localStorage.getItem('userName') || '';
      setUserName(name);
      fetchShopDetails(resolvedParams.id);
    };
    initPage();
  }, []);

  const fetchShopDetails = async (id: string) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/customers/shops/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        setShop(data.shop);
      } else {
        const errorText = await res.text();
        console.error('Failed to fetch shop details - Status:', res.status, 'Response:', errorText);
      }
    } catch (error) {
      console.error('Error fetching shop details:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async () => {
    if (!shop || togglingFavorite) return;

    setTogglingFavorite(true);
    try {
      const token = localStorage.getItem('token');
      const method = shop.isFavorite ? 'DELETE' : 'POST';
      const url = shop.isFavorite
        ? `/api/customers/favorites/${shop.id}`
        : '/api/customers/favorites';

      const body = shop.isFavorite ? null : JSON.stringify({ shopId: shopId });

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body
      });

      if (res.ok) {
        setShop(prev => prev ? { ...prev, isFavorite: !prev.isFavorite } : null);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    } finally {
      setTogglingFavorite(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userName');
    window.location.href = '/auth/login';
  };

  if (loading) {
    return (
      <div style={{minHeight:'100vh', background: 'transparent', display:'flex', alignItems:'center', justifyContent:'center'}}>
        <div style={{color:'#e5e7eb', fontSize:18}}>Loading shop details...</div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div style={{minHeight:'100vh', background: 'transparent', display:'flex', alignItems:'center', justifyContent:'center'}}>
        <div style={{color:'#e5e7eb', fontSize:18}}>Shop not found</div>
      </div>
    );
  }

  return (
    <div style={{minHeight:'100vh', background: 'transparent'}}>
      {/* Header */}
      <div style={{background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(229,51,42,0.3)', padding:'16px 32px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div style={{display:'flex', alignItems:'center', gap:24}}>
          <Link href="/customer/dashboard" style={{fontSize:24, fontWeight:900, color:'#e5332a', textDecoration:'none'}}>FixTray</Link>
          <div>
            <div style={{fontSize:20, fontWeight:700, color:'#e5e7eb'}}>Customer Portal</div>
            <div style={{fontSize:12, color:'#9aa3b2'}}>Shop Details</div>
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
        {/* Back Button */}
        <Link href="/customer/findshops" style={{
          display:'inline-flex',
          alignItems:'center',
          gap:8,
          color:'#3b82f6',
          textDecoration:'none',
          fontSize:14,
          fontWeight:600,
          marginBottom:24,
          padding:'8px 16px',
          background:'rgba(59,130,246,0.1)',
          borderRadius:8,
          border:'1px solid rgba(59,130,246,0.3)'
        }}>
          <FaArrowLeft style={{marginRight:4}} /> Back to Find Shops
        </Link>

        {/* Shop Header */}
        <div style={{background:'rgba(0,0,0,0.3)', border:`1px solid ${shop.isFavorite ? 'rgba(255,215,0,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius:16, padding:32, marginBottom:32}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24}}>
            <div>
              <div style={{display:'flex', alignItems:'center', gap:16, marginBottom:8}}>
                <h1 style={{fontSize:32, fontWeight:700, color:'#e5e7eb'}}>{shop.shopName}</h1>
                {shop.averageRating > 0 && (
                  <span style={{padding:'6px 12px', background:'rgba(245,158,11,0.2)', color:'#f59e0b', borderRadius:8, fontSize:14, fontWeight:700}}>
                    <FaStar style={{marginRight:4}} /> {shop.averageRating.toFixed(1)} ({shop.totalReviews} reviews)
                  </span>
                )}
              </div>
              {shop.ownerName && (
                <p style={{fontSize:16, color:'#9aa3b2', marginBottom:8}}>Owner: {shop.ownerName}</p>
              )}
              <div style={{display:'flex', alignItems:'center', gap:16, flexWrap:'wrap'}}>
                <span style={{fontSize:14, color:'#22c55e', fontWeight:600}}>
                  <FaCheck style={{marginRight:4}} /> {shop.completedJobs} jobs completed
                </span>
                {shop.shopType && (
                  <span style={{fontSize:14, color:'#9aa3b2'}}>
                    <FaStore style={{marginRight:4}} /> {shop.shopType}
                  </span>
                )}
                {shop.capacity && (
                  <span style={{fontSize:14, color:'#9aa3b2'}}>
                    <FaUsers style={{marginRight:4}} /> Capacity: {shop.capacity} vehicles
                  </span>
                )}
              </div>
            </div>

            {/* Favorite Button */}
            <button
              onClick={toggleFavorite}
              disabled={togglingFavorite}
              style={{
                padding:'12px 24px',
                background: shop.isFavorite ? 'rgba(255,215,0,0.2)' : 'rgba(255,255,255,0.1)',
                border: `1px solid ${shop.isFavorite ? 'rgba(255,215,0,0.5)' : 'rgba(255,255,255,0.2)'}`,
                borderRadius:12,
                cursor: togglingFavorite ? 'not-allowed' : 'pointer',
                fontSize:16,
                fontWeight:600,
                color: shop.isFavorite ? '#f59e0b' : '#e5e7eb',
                opacity: togglingFavorite ? 0.5 : 1,
                display:'flex',
                alignItems:'center',
                gap:8
              }}
            >
              {togglingFavorite ? <FaHourglassHalf style={{marginRight:4}} /> : (shop.isFavorite ? <FaStar style={{marginRight:4}} /> : <FaRegStar style={{marginRight:4}} />)}
              {shop.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
            </button>
          </div>

          {/* Action Buttons */}
          <div style={{display:'flex', gap:16}}>
            <Link href={`/customer/appointments/new?shopId=${shop.id}`} style={{
              flex:1,
              padding:'16px',
              background:'rgba(34,197,94,0.1)',
              color:'#22c55e',
              border:'1px solid rgba(34,197,94,0.3)',
              borderRadius:12,
              fontSize:16,
              fontWeight:600,
              cursor:'pointer',
              textDecoration:'none',
              textAlign:'center'
            }}>
              <FaCalendarAlt style={{marginRight:4}} /> Book Appointment
            </Link>
            <Link href={`/customer/messages?shopId=${shop.id}`} style={{
              flex:1,
              padding:'16px',
              background:'rgba(59,130,246,0.1)',
              color:'#3b82f6',
              border:'1px solid rgba(59,130,246,0.3)',
              borderRadius:12,
              fontSize:16,
              fontWeight:600,
              cursor:'pointer',
              textDecoration:'none',
              textAlign:'center'
            }}>
              <FaComments style={{marginRight:4}} /> Contact Shop
            </Link>
          </div>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(400px, 1fr))', gap:32}}>
          {/* Contact Information */}
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
            <h2 style={{fontSize:24, fontWeight:700, color:'#e5e7eb', marginBottom:20}}><FaMapMarkerAlt style={{marginRight:4}} /> Contact Information</h2>
            <div style={{display:'flex', flexDirection:'column', gap:16}}>
              <div>
                <div style={{fontSize:14, color:'#9aa3b2', marginBottom:4}}>Address</div>
                <div style={{fontSize:16, color:'#e5e7eb'}}>
                  {shop.address}
                  {shop.city && shop.state && (
                    <>, {shop.city}, {shop.state} {shop.zipCode}</>
                  )}
                </div>
              </div>
              <div>
                <div style={{fontSize:14, color:'#9aa3b2', marginBottom:4}}>Phone</div>
                <div style={{fontSize:16, color:'#e5e7eb'}}>
                  <FaPhone style={{marginRight:4}} /> {shop.phone}
                </div>
              </div>
              <div>
                <div style={{fontSize:14, color:'#9aa3b2', marginBottom:4}}>Email</div>
                <div style={{fontSize:16, color:'#e5e7eb'}}>
                  <FaEnvelope style={{marginRight:4}} /> {shop.email}
                </div>
              </div>
            </div>
          </div>

          {/* Services Offered */}
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
            <h2 style={{fontSize:24, fontWeight:700, color:'#e5e7eb', marginBottom:20}}><FaWrench style={{marginRight:4}} /> Services Offered</h2>
            {shop.services && shop.services.length > 0 ? (
              <div style={{display:'flex', flexDirection:'column', gap:12}}>
                {shop.services.map(service => (
                  <div key={service.id} style={{
                    padding:16,
                    background:'rgba(255,255,255,0.05)',
                    borderRadius:8,
                    border:'1px solid rgba(255,255,255,0.1)'
                  }}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8}}>
                      <h3 style={{fontSize:16, fontWeight:600, color:'#e5e7eb'}}>{service.serviceName}</h3>
                      <span style={{fontSize:12, color:'#9aa3b2', background:'rgba(229,51,42,0.2)', padding:'2px 8px', borderRadius:4}}>
                        {service.category}
                      </span>
                    </div>
                    {service.description && (
                      <p style={{fontSize:14, color:'#9aa3b2', marginBottom:8}}>{service.description}</p>
                    )}
                    <div style={{display:'flex', gap:16, fontSize:14, color:'#e5e7eb'}}>
                      {service.price && (
                        <span><FaDollarSign style={{marginRight:4}} /> ${service.price}</span>
                      )}
                      {service.duration && (
                        <span><FaStopwatch style={{marginRight:4}} /> {service.duration} min</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{fontSize:16, color:'#9aa3b2'}}>No services listed yet</p>
            )}
          </div>
        </div>

        {/* Business Information */}
        {shop.slotDuration && (
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24, marginTop:32}}>
            <h2 style={{fontSize:24, fontWeight:700, color:'#e5e7eb', marginBottom:20}}><FaBuilding style={{marginRight:4}} /> Business Information</h2>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:16}}>
              <div>
                <div style={{fontSize:14, color:'#9aa3b2', marginBottom:4}}>Appointment Duration</div>
                <div style={{fontSize:16, color:'#e5e7eb'}}>{shop.slotDuration} minutes</div>
              </div>
              {shop.capacity && (
                <div>
                  <div style={{fontSize:14, color:'#9aa3b2', marginBottom:4}}>Daily Capacity</div>
                  <div style={{fontSize:16, color:'#e5e7eb'}}>{shop.capacity} vehicles</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
