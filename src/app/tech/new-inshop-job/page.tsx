'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft } from 'react-icons/fa';

export default function TechNewInShopJob() {
  const router = useRouter();
  const { user, isLoading } = useRequireAuth(['tech', 'shop', 'manager']);

  if (isLoading) return <div style={{minHeight:'100vh', background: '#000000', display:'flex', alignItems:'center', justifyContent:'center', color:'#e5e7eb'}}>Loading...</div>;
  if (!user) return null;

  // Redirect non-tech users to appropriate role page
  if (user.role === 'shop' || user.role === 'manager') {
    return <script>{`window.location.replace('/shop/new-inshop-job');`}</script>;
  }

  return (
    <div style={{minHeight:'100vh', background: '#000000'}}>
      <div style={{background:'rgba(34,197,94,0.1)', borderBottom:'1px solid rgba(34,197,94,0.2)', padding:'20px 32px'}}>
        <div style={{maxWidth:1200, margin:'0 auto'}}>
          <Link href="/tech/home" style={{color:'#22c55e', textDecoration:'none', fontSize:14, fontWeight:600, marginBottom:16, display:'inline-block'}}>
            <FaArrowLeft style={{marginRight:4}} /> Back to Dashboard
          </Link>
          <h1 style={{fontSize:28, fontWeight:700, color:'#e5e7eb', marginBottom:8}}>Create In-Shop Job (Tech Portal)</h1>
          <p style={{fontSize:14, color:'#9aa3b2'}}>Initiate a new in-shop service order</p>
        </div>
      </div>

      <div style={{maxWidth:1200, margin:'0 auto', padding:32}}>
        <div style={{background:'rgba(0,0,0,0.3)', padding:32, borderRadius:8, border:'1px solid rgba(255,255,255,0.08)', marginBottom:32}}>
          <p style={{color:'#9aa3b2', marginBottom:16}}>
            Tech users create work orders through the shop's work order system. You can:
          </p>
          <ul style={{color:'#9aa3b2', marginLeft:20, marginBottom:24}}>
            <li style={{marginBottom:8}}>Create new in-shop appointments</li>
            <li style={{marginBottom:8}}>Assign jobs to yourself or other techs</li>
            <li style={{marginBottom:8}}>Track customer vehicles</li>
            <li style={{marginBottom:8}}>Schedule service windows</li>
          </ul>
          
          <Link href="/shop/new-inshop-job" style={{background:'#22c55e', color:'#000000', padding:'12px 24px', borderRadius:6, textDecoration:'none', fontWeight:600, display:'inline-block'}}>
            Go to In-Shop Job Form
          </Link>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
          <Link href={"/shop/workorders" as any} style={{background:'rgba(34,197,94,0.15)', border:'1px solid rgba(34,197,94,0.3)', padding:20, borderRadius:8, textDecoration:'none', color:'#e5e7eb'}}>
            <h3 style={{marginBottom:8, fontWeight:600}}>View All Work Orders</h3>
            <p style={{fontSize:13, color:'#9aa3b2'}}>See jobs assigned to you</p>
          </Link>
          <Link href="/tech/timesheet" style={{background:'rgba(34,197,94,0.15)', border:'1px solid rgba(34,197,94,0.3)', padding:20, borderRadius:8, textDecoration:'none', color:'#e5e7eb'}}>
            <h3 style={{marginBottom:8, fontWeight:600}}>Time Tracking</h3>
            <p style={{fontSize:13, color:'#9aa3b2'}}>Clock in/out and track hours</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
