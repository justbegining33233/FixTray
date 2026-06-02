'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaCar } from 'react-icons/fa';

export default function NewRoadsideJob() {
  const router = useRouter();
  const { user, isLoading } = useRequireAuth(['tech']);
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    location: '',
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
    issue: '',
    serviceType: 'towing',
    urgency: 'normal',
    notes: '',
  });

  if (isLoading) {
    return (
      <div style={{minHeight:'100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{color: '#e5e7eb', fontSize: 18}}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null; // useRequireAuth handles redirect
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push('/tech/home' as Route);
  };

  return (
    <div style={{minHeight:'100vh', background: 'transparent'}}>
      <div style={{background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(229,51,42,0.3)', padding:'20px 32px'}}>
        <div style={{maxWidth:900, margin:'0 auto'}}>
          <Link href="/tech/home" style={{color:'#e5332a', textDecoration:'none', fontSize:14, fontWeight:600, marginBottom:16, display:'inline-block'}}>
            <FaArrowLeft style={{marginRight:4}} /> Back to Dashboard
          </Link>
          <h1 style={{fontSize:28, fontWeight:700, color:'#e5e7eb', marginBottom:8}}><FaCar style={{marginRight:4}} /> New Roadside Job</h1>
          <p style={{fontSize:14, color:'#9aa3b2'}}>Create a new roadside assistance work order</p>
        </div>
      </div>

      <div style={{maxWidth:900, margin:'0 auto', padding:32}}>
        <form onSubmit={handleSubmit} style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:32}}>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, marginBottom:24}}>
            <div>
              <label style={{display:'block', fontSize:14, color:'#e5e7eb', marginBottom:8, fontWeight:600}}>Customer Name</label>
              <input type="text" required value={formData.customerName} onChange={(e) => setFormData({...formData, customerName: e.target.value})} style={{width:'100%', padding:'12px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}} />
            </div>
            <div>
              <label style={{display:'block', fontSize:14, color:'#e5e7eb', marginBottom:8, fontWeight:600}}>Customer Phone</label>
              <input type="tel" required value={formData.customerPhone} onChange={(e) => setFormData({...formData, customerPhone: e.target.value})} style={{width:'100%', padding:'12px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}} />
            </div>
          </div>

          <div style={{marginBottom:24}}>
            <label style={{display:'block', fontSize:14, color:'#e5e7eb', marginBottom:8, fontWeight:600}}>Location (Address or GPS)</label>
            <input type="text" required value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} placeholder="Street address or coordinates" style={{width:'100%', padding:'12px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}} />
          </div>

          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom:24}}>
            <div>
              <label style={{display:'block', fontSize:14, color:'#e5e7eb', marginBottom:8, fontWeight:600}}>Vehicle Year</label>
              <input type="text" required value={formData.vehicleYear} onChange={(e) => setFormData({...formData, vehicleYear: e.target.value})} style={{width:'100%', padding:'12px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}} />
            </div>
            <div>
              <label style={{display:'block', fontSize:14, color:'#e5e7eb', marginBottom:8, fontWeight:600}}>Make</label>
              <input type="text" required value={formData.vehicleMake} onChange={(e) => setFormData({...formData, vehicleMake: e.target.value})} style={{width:'100%', padding:'12px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}} />
            </div>
            <div>
              <label style={{display:'block', fontSize:14, color:'#e5e7eb', marginBottom:8, fontWeight:600}}>Model</label>
              <input type="text" required value={formData.vehicleModel} onChange={(e) => setFormData({...formData, vehicleModel: e.target.value})} style={{width:'100%', padding:'12px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}} />
            </div>
          </div>

          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, marginBottom:24}}>
            <div>
              <label style={{display:'block', fontSize:14, color:'#e5e7eb', marginBottom:8, fontWeight:600}}>Service Type</label>
              <select value={formData.serviceType} onChange={(e) => setFormData({...formData, serviceType: e.target.value})} style={{width:'100%', padding:'12px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14, cursor:'pointer'}}>
                <option value="towing">Towing</option>
                <option value="jumpstart">Jump Start</option>
                <option value="tire">Tire Change</option>
                <option value="lockout">Vehicle Lockout</option>
                <option value="fuel">Fuel Delivery</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label style={{display:'block', fontSize:14, color:'#e5e7eb', marginBottom:8, fontWeight:600}}>Urgency Level</label>
              <select value={formData.urgency} onChange={(e) => setFormData({...formData, urgency: e.target.value})} style={{width:'100%', padding:'12px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14, cursor:'pointer'}}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
          </div>

          <div style={{marginBottom:24}}>
            <label style={{display:'block', fontSize:14, color:'#e5e7eb', marginBottom:8, fontWeight:600}}>Issue Description</label>
            <textarea required value={formData.issue} onChange={(e) => setFormData({...formData, issue: e.target.value})} rows={4} style={{width:'100%', padding:'12px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14, resize:'vertical'}} />
          </div>

          <div style={{marginBottom:32}}>
            <label style={{display:'block', fontSize:14, color:'#e5e7eb', marginBottom:8, fontWeight:600}}>Additional Notes</label>
            <textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} rows={3} placeholder="Optional notes..." style={{width:'100%', padding:'12px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14, resize:'vertical'}} />
          </div>

          <div style={{display:'flex', gap:12}}>
            <button type="submit" style={{flex:1, padding:'14px', background:'#e5332a', color:'white', border:'none', borderRadius:8, fontSize:15, fontWeight:600, cursor:'pointer'}}>
              Create Roadside Job
            </button>
            <Link href="/tech/home" style={{flex:1, textDecoration:'none'}}>
              <button type="button" style={{width:'100%', padding:'14px', background:'rgba(255,255,255,0.1)', color:'#e5e7eb', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, fontSize:15, fontWeight:600, cursor:'pointer'}}>
                Cancel
              </button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

