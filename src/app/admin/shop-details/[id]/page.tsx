'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Route } from 'next';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import {
  formatShopCount,
  formatShopDateTime,
  formatShopMoney,
  formatShopRating,
  normalizeShopDetails,
  shopDetailsMetrics,
  type ShopDetailsView,
} from '@/lib/shopDetailsView';
import { FaArrowLeft, FaBuilding, FaCalendarAlt, FaCheck, FaExclamationTriangle, FaHourglassHalf, FaPhone, FaStar, FaTimesCircle } from 'react-icons/fa';

export default function ShopDetailsPage() {
  const say = usePhrase();
  const params = useParams();
  const router = useRouter();
  const { user, isLoading } = useRequireAuth(['admin']);
  const [shop, setShop] = useState<ShopDetailsView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [shopMsg, setShopMsg] = useState<{type:'success'|'error';text:string}|null>(null);
  const [statusConfirm, setStatusConfirm] = useState<string|null>(null);
  
  const shopId = params?.id as string;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('token');
      setToken(storedToken);
    }
  }, []);

  useEffect(() => {
    if (isLoading || !user || !shopId || !token) return;

    const fetchShopDetails = async () => {
      try {
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const res = await fetch(`/api/admin/shops/${shopId}`, {
          credentials: 'include',
          headers
        });
        
        if (!res.ok) {
          if (res.status === 404) {
            setError('Shop not found');
          } else if (res.status === 401) {
            setError('Session expired. Please log in again.');
            router.push('/auth/login' as Route);
          } else {
            setError('Failed to load shop details');
          }
          setLoading(false);
          return;
        }
        
        const data = await res.json();
        const view = normalizeShopDetails(data);
        if (!view) {
          setError('Failed to load shop details');
          setLoading(false);
          return;
        }
        setShop(view);
      } catch (err) {
        console.error('Error fetching shop:', err);
        setError('Failed to load shop details');
      } finally {
        setLoading(false);
      }
    };

    fetchShopDetails();
  }, [isLoading, user, shopId, token, router]);

  const handleStatusChange = async (newStatus: string) => {
    if (!shop) return;
    setStatusConfirm(null);
    const action = newStatus === 'suspended' ? 'suspend' : newStatus === 'approved' ? 'approve' : 'update';
    
    setActionLoading(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const res = await fetch(`/api/admin/shops/${shop.id}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers,
        body: JSON.stringify({ status: newStatus })
      });
      
      if (res.ok) {
        setShop(prev => prev ? { ...prev, status: newStatus } : null);
        setShopMsg({type:'success',text:`Shop has been ${action === 'suspend' ? 'suspended' : action === 'approve' ? 'approved' : 'updated'}.`});
      } else {
        const data = await res.json();
        setShopMsg({type:'error',text:data.error || 'Failed to update shop status'});
      }
    } catch (err) {
      console.error('Error updating shop status:', err);
      setShopMsg({type:'error',text:'Failed to update shop status'});
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading || loading) {
    return (
      <div style={{ minHeight: "100vh", background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}><FaHourglassHalf style={{marginRight:4}} /></div>
          <div>{say("Loading shop details...")}</div>
        </div>
      </div>
    );
  }

  if (error || !shop) {
    return (
      <div style={{ minHeight: "100vh", background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}><FaTimesCircle style={{marginRight:4}} /></div>
          <div style={{ fontSize: 20, marginBottom: 16 }}>{error || say("Shop not found")}</div>
          <Link href="/admin/manage-customers" style={{ color: '#3b82f6', textDecoration: 'none' }}>
            <FaArrowLeft style={{marginRight:4}} /> {say("Back to Manage Customers")}{' '}</Link>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#22c55e';
      case 'pending': return '#f59e0b';
      case 'suspended': return '#e5332a';
      default: return '#9aa3b2';
    }
  };

  const metrics = shopDetailsMetrics(shop);

  return (
    <div style={{ minHeight: "100vh", background: 'transparent' }}>
      {/* Header */}
      <div style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(34,197,94,0.3)', padding: '20px 32px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <Link href="/admin/manage-customers" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'inline-block' }}>
            <FaArrowLeft style={{marginRight:4}} /> {say("Back to Manage Customers")}{' '}</Link>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
                <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb' }}>{say(shop.shopName)}</h1>
                <span style={{ padding: '6px 16px', background: `${getStatusColor(shop.status)}20`, color: getStatusColor(shop.status), borderRadius: 8, fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>
                  {say(shop.status)}
                </span>
              </div>
              <p style={{ fontSize: 14, color: '#9aa3b2' }}>{say("Owner:")}{' '}{shop.ownerName || say("N/A")} - {shop.shopType || say("Auto")} {say("Shop")}</p>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              {shop.status === 'approved' && (
                <button
                  onClick={() => setStatusConfirm('suspended')}
                  disabled={actionLoading}
                  style={{ padding: '10px 20px', background: 'rgba(229,51,42,0.2)', color: '#e5332a', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: actionLoading ? 'not-allowed' : 'pointer', opacity: actionLoading ? 0.6 : 1 }}
                >
                  {actionLoading ? say("Processing...") : say("Suspend Shop")}
                </button>
              )}
              {shop.status === 'suspended' && (
                <button
                  onClick={() => setStatusConfirm('approved')}
                  disabled={actionLoading}
                  style={{ padding: '10px 20px', background: 'rgba(34,197,94,0.2)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: actionLoading ? 'not-allowed' : 'pointer', opacity: actionLoading ? 0.6 : 1 }}
                >
                  {actionLoading ? say("Processing...") : say("Reactivate Shop")}
                </button>
              )}
              {shop.status === 'pending' && (
                <button
                  onClick={() => setStatusConfirm('approved')}
                  disabled={actionLoading}
                  style={{ padding: '10px 20px', background: 'rgba(34,197,94,0.2)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: actionLoading ? 'not-allowed' : 'pointer', opacity: actionLoading ? 0.6 : 1 }}
                >
                  {actionLoading ? say("Processing...") : say("Approve Shop")}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: 32 }}>
        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 12, color: '#9aa3b2', marginBottom: 8 }}>{say("Total Work Orders")}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#3b82f6' }}>{formatShopCount(metrics.totalWorkOrders)}</div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 12, color: '#9aa3b2', marginBottom: 8 }}>{say("Completed Jobs")}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#22c55e' }}>{formatShopCount(metrics.completedWorkOrders)}</div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 12, color: '#9aa3b2', marginBottom: 8 }}>{say("Total Revenue")}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#22c55e' }}>{formatShopMoney(metrics.totalRevenue)}</div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 12, color: '#9aa3b2', marginBottom: 8 }}>{say("Technicians")}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#f97316' }}>{formatShopCount(metrics.technicians)}</div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 12, color: '#9aa3b2', marginBottom: 8 }}>{say("Customers")}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#a855f7' }}>{formatShopCount(metrics.customers)}</div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 12, color: '#9aa3b2', marginBottom: 8 }}>{say("Avg Rating")}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#fbbf24' }}><FaStar style={{marginRight:4}} /> {formatShopRating(metrics.avgRating)}</div>
          </div>
        </div>

        {/* Details Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 }}>
          {/* Contact Information */}
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#e5e7eb', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FaPhone style={{marginRight:4}} /> {say("Contact Information")}{' '}</h3>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase' }}>{say("Email")}</div>
                <div style={{ fontSize: 14, color: '#e5e7eb' }}>{say(shop.email)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase' }}>{say("Phone")}</div>
                <div style={{ fontSize: 14, color: '#e5e7eb' }}>{say(shop.phone)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase' }}>{say("Address")}</div>
                <div style={{ fontSize: 14, color: '#e5e7eb' }}>
                  {shop.address || say("N/A")}<br />
                  {say(shop.city)}, {say(shop.state)} {say(shop.zipCode)}
                </div>
              </div>
            </div>
          </div>

          {/* Business Information */}
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#e5e7eb', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FaBuilding style={{marginRight:4}} /> {say("Business Information")}{' '}</h3>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase' }}>{say("Shop Type")}</div>
                <div style={{ fontSize: 14, color: '#e5e7eb', textTransform: 'capitalize' }}>{shop.shopType || say("Auto")}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase' }}>{say("Business License")}</div>
                <div style={{ fontSize: 14, color: '#e5e7eb' }}>{shop.businessLicense || say("Not provided")}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase' }}>{say("Insurance Policy")}</div>
                <div style={{ fontSize: 14, color: '#e5e7eb' }}>{shop.insurancePolicy || say("Not provided")}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase' }}>{say("Profile Complete")}</div>
                <div style={{ fontSize: 14, color: shop.profileComplete ? '#22c55e' : '#f59e0b' }}>
                  {shop.profileComplete ? <><FaCheck style={{marginRight:4}} /> {say("Complete")}</> : <><FaExclamationTriangle style={{marginRight:4}} /> {say("Incomplete")}</>}
                </div>
              </div>
            </div>
          </div>

          {/* Account Dates */}
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#e5e7eb', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FaCalendarAlt style={{marginRight:4}} /> {say("Account Timeline")}{' '}</h3>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase' }}>{say("Created")}</div>
                <div style={{ fontSize: 14, color: '#e5e7eb' }}>{formatShopDateTime(shop.createdAt)}</div>
              </div>
              {shop.approvedAt && (
                <div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase' }}>{say("Approved")}</div>
                  <div style={{ fontSize: 14, color: '#22c55e' }}>{formatShopDateTime(shop.approvedAt)}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {statusConfirm && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
          <div style={{background:'#1e2533',borderRadius:14,padding:32,minWidth:300,maxWidth:420,boxShadow:'0 8px 32px rgba(0,0,0,0.5)'}}>
            <h3 style={{fontSize:18,fontWeight:700,color:'#e5e7eb',marginBottom:12}}>{say("Confirm Action")}</h3>
            <p style={{fontSize:14,color:'#9aa3b2',marginBottom:24}}>{say("Are you sure you want to")}{' '}{statusConfirm === 'suspended' ? 'suspend' : 'approve'} {say("this shop?")}</p>
            <div style={{display:'flex',gap:12}}>
              <button onClick={()=>handleStatusChange(statusConfirm)} disabled={actionLoading} style={{flex:1,padding:'10px 0',background:statusConfirm==='suspended'?'#ef4444':'#22c55e',color:'#fff',border:'none',borderRadius:8,fontSize:14,fontWeight:700,cursor:'pointer'}}>{say("Confirm")}</button>
              <button onClick={()=>setStatusConfirm(null)} style={{flex:1,padding:'10px 0',background:'transparent',color:'#9aa3b2',border:'1px solid rgba(255,255,255,0.15)',borderRadius:8,fontSize:14,cursor:'pointer'}}>{say("Cancel")}</button>
            </div>
          </div>
        </div>
      )}
      {shopMsg && (
        <div style={{position:'fixed',bottom:24,right:24,background:shopMsg.type==='success'?'#dcfce7':'#fde8e8',color:shopMsg.type==='success'?'#166534':'#991b1b',borderRadius:10,padding:'12px 20px',zIndex:9999,fontSize:14,fontWeight:600,boxShadow:'0 4px 12px rgba(0,0,0,0.3)'}}>
          {say(shopMsg.text)}
          <button onClick={()=>setShopMsg(null)} style={{marginLeft:12,background:'none',border:'none',cursor:'pointer',fontSize:16,color:'inherit'}}>├ù</button>
        </div>
      )}
    </div>
  );
}
