'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { resolveShopContactEmail, shopContactMailto } from '@/lib/shopContact';
import { FaArrowLeft, FaArrowRight, FaCheck, FaEnvelope, FaMapMarkerAlt, FaMedal, FaPhone, FaStar, FaStore, FaTimes } from 'react-icons/fa';

export const dynamic = 'force-dynamic';

type AcceptedShop = {
  id: string;
  name: string;
  location: string;
  address: string;
  phone: string;
  email: string;
  ownerEmail?: string;
  revenue: string;
  jobs: number;
  rating: number;
  status: string;
  services: number;
  shopName: string;
  ownerName: string;
  businessLicense: string;
  insurancePolicy: string;
  joinedDate: Date;
  completionRate: number;
  averageResponseTime: string;
};

export default function AcceptedShops() {
  const say = usePhrase();
  const { user, isLoading } = useRequireAuth(['admin', 'superadmin']);
  const [acceptedShops, setAcceptedShops] = useState<AcceptedShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShop, setSelectedShop] = useState<AcceptedShop | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactShop, setContactShop] = useState<AcceptedShop | null>(null);
  const [sortBy, setSortBy] = useState<'revenue' | 'rating' | 'jobs'>('revenue');
  async function fetchAcceptedShops() {
    try {
      const response = await fetch('/api/shops/accepted');
      if (response.ok) {
        const data = await response.json();
        setAcceptedShops(data);
      }
    } catch (error) {
      console.error('Error fetching accepted shops:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user || isLoading) return;
    fetchAcceptedShops();
  }, [user, isLoading]);

  const handleViewDetails = (shop: AcceptedShop) => {
    setSelectedShop(shop);
    setShowDetails(true);
  };

  const handleContactShop = (shop: AcceptedShop) => {
    setContactShop(shop);
    setShowContactModal(true);
  };

  const contactEmail = resolveShopContactEmail(contactShop?.email, contactShop?.ownerEmail);
  const contactMailto = shopContactMailto(contactEmail);

  const getSortedShops = () => {
    const sorted = [...acceptedShops];
    switch (sortBy) {
      case 'revenue':
        return sorted.sort((a, b) => {
          const revenueA = parseInt((a.revenue ?? '0').replace(/[$,]/g, '')) || 0;
          const revenueB = parseInt((b.revenue ?? '0').replace(/[$,]/g, '')) || 0;
          return revenueB - revenueA;
        });
      case 'rating':
        return sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      case 'jobs':
        return sorted.sort((a, b) => (b.jobs ?? 0) - (a.jobs ?? 0));
      default:
        return sorted.sort((a, b) =>
          (a.name ?? '').toLowerCase().localeCompare((b.name ?? '').toLowerCase())
        );
    }
  };

  const getTimeActive = (date: Date) => {
    const now = new Date();
    const joined = new Date(date);
    const months = Math.floor((now.getTime() - joined.getTime()) / (1000 * 60 * 60 * 24 * 30));
    
    if (months < 1) return 'Less than a month';
    if (months === 1) return '1 month';
    return `${months} months`;
  };

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#e5e7eb',
        fontSize: '18px'
      }}>
        {say("Loading...")}{' '}</div>
    );
  }

  // If no user, the useRequireAuth hook will handle redirect
  if (!user) {
    return null;
  }

  return (
    <div style={{minHeight:'100vh', background: 'transparent'}}>
      {/* Header */}
      <div style={{background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(34,197,94,0.3)', padding:'20px 32px'}}>
        <div style={{maxWidth:1400, margin:'0 auto'}}>
          <Link href="/admin/home" style={{color:'#e5332a', textDecoration:'none', fontSize:14, fontWeight:600, marginBottom:16, display:'inline-block'}}>
            <FaArrowLeft style={{marginRight:4}} /> {say("Back to Dashboard")}{' '}</Link>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div>
              <h1 style={{fontSize:28, fontWeight:700, color:'#e5e7eb', marginBottom:8}}>{say("Accepted Shops")}</h1>
              <p style={{fontSize:14, color:'#9aa3b2'}}>{say("All verified and active shop partners")}</p>
            </div>
            <div style={{display:'flex', alignItems:'center', gap:16}}>
              <div style={{padding:'8px 16px', background:'rgba(34,197,94,0.2)', color:'#22c55e', borderRadius:8, fontSize:14, fontWeight:700}}>
                {say(acceptedShops.length)} {say("Active Shops")}{' '}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{maxWidth:1400, margin:'0 auto', padding:32}}>
        {/* Sort Controls */}
        <div style={{marginBottom:24, display:'flex', gap:12}}>
          <button 
            onClick={() => setSortBy('revenue')}
            style={{padding:'10px 20px', background:sortBy === 'revenue' ? 'rgba(34,197,94,0.2)' : 'rgba(0,0,0,0.3)', color:sortBy === 'revenue' ? '#22c55e' : '#9aa3b2', border:`1px solid ${sortBy === 'revenue' ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}
          >
            {say("Sort by Revenue")}{' '}</button>
          <button 
            onClick={() => setSortBy('rating')}
            style={{padding:'10px 20px', background:sortBy === 'rating' ? 'rgba(34,197,94,0.2)' : 'rgba(0,0,0,0.3)', color:sortBy === 'rating' ? '#22c55e' : '#9aa3b2', border:`1px solid ${sortBy === 'rating' ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}
          >
            {say("Sort by Rating")}{' '}</button>
          <button 
            onClick={() => setSortBy('jobs')}
            style={{padding:'10px 20px', background:sortBy === 'jobs' ? 'rgba(34,197,94,0.2)' : 'rgba(0,0,0,0.3)', color:sortBy === 'jobs' ? '#22c55e' : '#9aa3b2', border:`1px solid ${sortBy === 'jobs' ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}
          >
            {say("Sort by Jobs")}{' '}</button>
        </div>

        {loading ? (
          <div style={{textAlign:'center', padding:80, color:'#9aa3b2', fontSize:16}}>{say("Loading...")}</div>
        ) : acceptedShops.length === 0 ? (
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:80, textAlign:'center'}}>
            <div style={{fontSize:48, marginBottom:16}}><FaStore style={{marginRight:4}} /></div>
            <div style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:8}}>{say("No Accepted Shops")}</div>
            <div style={{fontSize:14, color:'#9aa3b2'}}>{say("No shops have been approved yet")}</div>
          </div>
        ) : (
          <div style={{display:'grid', gap:16}}>
            {getSortedShops().map((shop, index) => (
              <div key={shop.id} style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:12, padding:24, position:'relative'}}>
                {/* Rank Badge */}
                {index < 3 && (
                  <div style={{position:'absolute', top:16, right:16, padding:'6px 12px', background:index === 0 ? 'linear-gradient(135deg, #fbbf24, #f59e0b)' : index === 1 ? 'linear-gradient(135deg, #9ca3af, #6b7280)' : 'linear-gradient(135deg, #cd7f32, #b87333)', color:'white', borderRadius:8, fontSize:12, fontWeight:700}}>
                  {index === 0 ? <><FaMedal style={{marginRight:4}} /> #1</> : index === 1 ? <><FaMedal style={{marginRight:4}} /> #2</> : <><FaMedal style={{marginRight:4}} /> #3</>}
                </div>
                )}

                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20}}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:8}}>
                      <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb'}}>{say(shop.name)}</h2>
                      <span style={{padding:'4px 12px', background:'rgba(34,197,94,0.2)', color:'#22c55e', borderRadius:8, fontSize:11, fontWeight:600}}>
                        <FaCheck style={{marginRight:4}} /> {say("VERIFIED")}{' '}</span>
                    </div>
                    <div style={{fontSize:14, color:'#9aa3b2', marginBottom:8}}>
                      <FaMapMarkerAlt style={{marginRight:4}} /> {say(shop.location)}
                    </div>
                    <div style={{fontSize:13, color:'#6b7280'}}>
                      {say("Active for")}{' '}{getTimeActive(shop.joinedDate)} - {say(shop.services)} services
                    </div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:12, marginBottom:20, padding:16, background:'rgba(255,255,255,0.05)', borderRadius:8}}>
                  <div>
                    <div style={{fontSize:11, color:'#6b7280', marginBottom:4}}>{say("Revenue")}</div>
                    <div style={{fontSize:18, color:'#22c55e', fontWeight:700}}>{say(shop.revenue)}</div>
                  </div>
                  <div>
                    <div style={{fontSize:11, color:'#6b7280', marginBottom:4}}>{say("Completed Jobs")}</div>
                    <div style={{fontSize:18, color:'#e5332a', fontWeight:700}}>{say(shop.jobs)}</div>
                  </div>
                  <div>
                    <div style={{fontSize:11, color:'#6b7280', marginBottom:4}}>{say("Rating")}</div>
                    <div style={{fontSize:18, color:'#fbbf24', fontWeight:700}}><FaStar style={{marginRight:4}} /> {say(shop.rating)}</div>
                  </div>
                  <div>
                    <div style={{fontSize:11, color:'#6b7280', marginBottom:4}}>{say("Completion Rate")}</div>
                    <div style={{fontSize:18, color:'#e5e7eb', fontWeight:700}}>{say(shop.completionRate)}%</div>
                  </div>
                  <div>
                    <div style={{fontSize:11, color:'#6b7280', marginBottom:4}}>{say("Avg Response")}</div>
                    <div style={{fontSize:18, color:'#e5e7eb', fontWeight:700}}>{say(shop.averageResponseTime)}</div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{display:'flex', gap:12}}>
                  <button 
                    onClick={() => handleViewDetails(shop)}
                    style={{flex:1, padding:'12px', background:'rgba(229,51,42,0.2)', color:'#e5332a', border:'1px solid rgba(229,51,42,0.3)', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}
                  >
                    {say("View Details")}{' '}</button>
                  <button 
                    onClick={() => handleContactShop(shop)}
                    style={{padding:'12px 24px', background:'rgba(255,255,255,0.1)', color:'#e5e7eb', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}
                  >
                    {say("Contact Shop")}{' '}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Details Modal */}
      {showDetails && selectedShop && (
        <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:32}}>
          <div style={{background:'#000000', border:'2px solid rgba(34,197,94,0.3)', borderRadius:16, padding:32, maxWidth:800, width:'100%', maxHeight:'90vh', overflowY:'auto'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24}}>
              <h2 style={{fontSize:24, fontWeight:700, color:'#e5e7eb'}}>{say("Shop Details")}</h2>
              <button 
                onClick={() => setShowDetails(false)}
                style={{padding:'8px 16px', background:'rgba(255,255,255,0.1)', color:'#e5e7eb', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}
              >
                <FaTimes style={{marginRight:4}} /> {say("Close")}{' '}</button>
            </div>

            <div style={{display:'flex', flexDirection:'column', gap:20}}>
              {/* Performance Metrics */}
              <div>
                <h3 style={{fontSize:18, fontWeight:700, color:'#e5e7eb', marginBottom:12}}>{say("Performance Metrics")}</h3>
                <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:16}}>
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
                    <div>
                      <div style={{fontSize:11, color:'#6b7280', marginBottom:4}}>{say("Total Revenue")}</div>
                      <div style={{fontSize:20, color:'#22c55e', fontWeight:700}}>{say(selectedShop.revenue)}</div>
                    </div>
                    <div>
                      <div style={{fontSize:11, color:'#6b7280', marginBottom:4}}>{say("Completed Jobs")}</div>
                      <div style={{fontSize:20, color:'#e5332a', fontWeight:700}}>{say(selectedShop.jobs)}</div>
                    </div>
                    <div>
                      <div style={{fontSize:11, color:'#6b7280', marginBottom:4}}>{say("Customer Rating")}</div>
                      <div style={{fontSize:20, color:'#fbbf24', fontWeight:700}}><FaStar style={{marginRight:4}} /> {say(selectedShop.rating)}</div>
                    </div>
                    <div>
                      <div style={{fontSize:11, color:'#6b7280', marginBottom:4}}>{say("Completion Rate")}</div>
                      <div style={{fontSize:20, color:'#e5e7eb', fontWeight:700}}>{say(selectedShop.completionRate)}%</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Business Information */}
              <div>
                <h3 style={{fontSize:18, fontWeight:700, color:'#e5e7eb', marginBottom:12}}>{say("Business Information")}</h3>
                <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:16}}>
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:11, color:'#6b7280', marginBottom:4}}>{say("Shop Name")}</div>
                    <div style={{fontSize:16, color:'#e5e7eb', fontWeight:600}}>{say(selectedShop.shopName)}</div>
                  </div>
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:11, color:'#6b7280', marginBottom:4}}>{say("Owner Name")}</div>
                    <div style={{fontSize:16, color:'#e5e7eb', fontWeight:600}}>{say(selectedShop.ownerName)}</div>
                  </div>
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:11, color:'#6b7280', marginBottom:4}}>{say("Full Address")}</div>
                    <div style={{fontSize:16, color:'#e5e7eb', fontWeight:600}}>{say(selectedShop.address)}</div>
                  </div>
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:11, color:'#6b7280', marginBottom:4}}>{say("Business License #")}</div>
                    <div style={{fontSize:16, color:'#e5e7eb', fontWeight:600}}>{say(selectedShop.businessLicense)}</div>
                  </div>
                  <div>
                    <div style={{fontSize:11, color:'#6b7280', marginBottom:4}}>{say("Insurance Policy #")}</div>
                    <div style={{fontSize:16, color:'#e5e7eb', fontWeight:600}}>{say(selectedShop.insurancePolicy)}</div>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div>
                <h3 style={{fontSize:18, fontWeight:700, color:'#e5e7eb', marginBottom:12}}>{say("Contact Information")}</h3>
                <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:16}}>
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:11, color:'#6b7280', marginBottom:4}}>{say("Email")}</div>
                    <div style={{fontSize:16, color:'#e5e7eb', fontWeight:600}}>{resolveShopContactEmail(selectedShop.email, selectedShop.ownerEmail) || say("Not provided")}</div>
                  </div>
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:11, color:'#6b7280', marginBottom:4}}>{say("Phone")}</div>
                    <div style={{fontSize:16, color:'#e5e7eb', fontWeight:600}}>{say(selectedShop.phone)}</div>
                  </div>
                  <div>
                    <div style={{fontSize:11, color:'#6b7280', marginBottom:4}}>{say("Services Offered")}</div>
                    <div style={{fontSize:16, color:'#e5e7eb', fontWeight:600}}>{say(selectedShop.services)} services</div>
                  </div>
                </div>
              </div>

              {/* Activity */}
              <div>
                <h3 style={{fontSize:18, fontWeight:700, color:'#e5e7eb', marginBottom:12}}>{say("Activity")}</h3>
                <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:16}}>
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:11, color:'#6b7280', marginBottom:4}}>{say("Joined Platform")}</div>
                    <div style={{fontSize:16, color:'#e5e7eb', fontWeight:600}}>
                      {new Date(selectedShop.joinedDate).toLocaleDateString()} ({getTimeActive(selectedShop.joinedDate)} {say("ago)")}{' '}</div>
                  </div>
                  <div>
                    <div style={{fontSize:11, color:'#6b7280', marginBottom:4}}>{say("Average Response Time")}</div>
                    <div style={{fontSize:16, color:'#e5e7eb', fontWeight:600}}>{say(selectedShop.averageResponseTime)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contact Shop Modal */}
      {showContactModal && contactShop && (
        <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:32}}>
          <div style={{background:'#000000', border:'2px solid rgba(229,51,42,0.3)', borderRadius:16, padding:32, maxWidth:600, width:'100%'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24}}>
              <h2 style={{fontSize:24, fontWeight:700, color:'#e5e7eb'}}>{say("Contact Information")}</h2>
              <button 
                onClick={() => setShowContactModal(false)}
                style={{padding:'8px 16px', background:'rgba(255,255,255,0.1)', color:'#e5e7eb', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}
              >
                <FaTimes style={{marginRight:4}} /> {say("Close")}{' '}</button>
            </div>

            {/* Shop Name */}
            <div style={{marginBottom:24}}>
              <div style={{fontSize:14, color:'#9aa3b2', marginBottom:8, fontWeight:600}}>{say("Shop Name")}</div>
              <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:16}}>
                <div style={{fontSize:20, fontWeight:700, color:'#e5e7eb'}}>{contactShop.shopName || contactShop.name}</div>
                {contactShop.ownerName && (
                  <div style={{fontSize:14, color:'#9aa3b2', marginTop:4}}>{say("Owner:")}{' '}{say(contactShop.ownerName)}</div>
                )}
              </div>
            </div>

            {/* Phone Number */}
            <div style={{marginBottom:24}}>
              <div style={{fontSize:14, color:'#9aa3b2', marginBottom:8, fontWeight:600}}>{say("Phone Number")}</div>
              <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:16}}>
                <div style={{display:'flex', alignItems:'center', gap:12}}>
                  <span style={{fontSize:20}}><FaPhone style={{marginRight:4}} /></span>
                  <a 
                    href={`tel:${contactShop.phone}`}
                    style={{fontSize:18, fontWeight:600, color:'#e5332a', textDecoration:'none'}}
                  >
                    {say(contactShop.phone)}
                  </a>
                </div>
              </div>
            </div>

            {/* Address */}
            <div style={{marginBottom:24}}>
              <div style={{fontSize:14, color:'#9aa3b2', marginBottom:8, fontWeight:600}}>{say("Address")}</div>
              <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:16}}>
                <div style={{display:'flex', alignItems:'start', gap:12}}>
                  <span style={{fontSize:20}}><FaMapMarkerAlt style={{marginRight:4}} /></span>
                  <div>
                    <div style={{fontSize:16, color:'#e5e7eb', fontWeight:600, marginBottom:4}}>
                      {contactShop.address || contactShop.location}
                    </div>
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contactShop.address || contactShop.location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{fontSize:13, color:'#e5332a', textDecoration:'none', fontWeight:600}}
                    >
                      {say("Open in Google Maps")}{' '}<FaArrowRight style={{marginRight:4}} />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Email */}
            <div style={{marginBottom:24}}>
              <div style={{fontSize:14, color:'#9aa3b2', marginBottom:8, fontWeight:600}}>{say("Email")}</div>
              <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:16}}>
                <div style={{display:'flex', alignItems:'center', gap:12}}>
                  <span style={{fontSize:20}}><FaEnvelope style={{marginRight:4}} /></span>
                  {contactMailto ? (
                    <a
                      href={contactMailto}
                      style={{fontSize:16, fontWeight:600, color:'#e5332a', textDecoration:'none'}}
                    >
                      {contactEmail}
                    </a>
                  ) : (
                    <span style={{fontSize:16, fontWeight:600, color:'#9aa3b2'}}>{say("Not provided")}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
              <a 
                href={`tel:${contactShop.phone}`}
                style={{padding:'12px', background:'rgba(34,197,94,0.2)', color:'#22c55e', border:'1px solid rgba(34,197,94,0.3)', borderRadius:8, fontSize:14, fontWeight:600, textAlign:'center', textDecoration:'none', display:'block'}}
              >
                <FaPhone style={{marginRight:4}} /> {say("Call Now")}{' '}</a>
              {contactMailto ? (
                <a
                  href={contactMailto}
                  style={{padding:'12px', background:'rgba(229,51,42,0.2)', color:'#e5332a', border:'1px solid rgba(229,51,42,0.3)', borderRadius:8, fontSize:14, fontWeight:600, textAlign:'center', textDecoration:'none', display:'block'}}
                >
                  <FaEnvelope style={{marginRight:4}} /> {say("Send Email")}{' '}</a>
              ) : (
                <span style={{padding:'12px', background:'rgba(255,255,255,0.06)', color:'#6b7280', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, fontSize:14, fontWeight:600, textAlign:'center', display:'block'}}>
                  <FaEnvelope style={{marginRight:4}} /> {say("Not provided")}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

