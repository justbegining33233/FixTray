'use client';


import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaBox, FaCog, FaExternalLinkAlt, FaRulerCombined } from 'react-icons/fa';

export default function TechInventory() {
  const { user, isLoading } = useRequireAuth(['tech']);

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

  return (
    <div style={{minHeight:'100vh', background: 'transparent'}}>
      <div style={{background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(245,158,11,0.3)', padding:'20px 32px'}}>
        <div style={{maxWidth:1200, margin:'0 auto'}}>
          <Link href="/tech/all-tools" style={{color:'#e5332a', textDecoration:'none', fontSize:14, fontWeight:600, marginBottom:16, display:'inline-block'}}>
            <FaArrowLeft style={{marginRight:4}} /> Back to Tools
          </Link>
          <h1 style={{fontSize:28, fontWeight:700, color:'#e5e7eb', marginBottom:8}}><FaCog style={{marginRight:4}} /> Parts Inventory</h1>
          <p style={{fontSize:14, color:'#9aa3b2'}}>Check parts availability, request orders, and track inventory levels</p>
        </div>
      </div>

      <div style={{maxWidth:1200, margin:'0 auto', padding:32}}>
        {/* Quick links */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:16, marginBottom:32}}>
          {[
            { label: 'Parts Request', desc: 'Submit a request to your shop manager', icon: '', href: '/tech/work-orders', ext: false },
            { label: 'RockAuto', desc: 'Low-cost OEM & aftermarket parts', icon: '', href: 'https://rockauto.com', ext: true },
            { label: 'NAPA Online', desc: 'Parts lookup & ordering', icon: '', href: 'https://napaonline.com', ext: true },
            { label: 'AutoZone Pro', desc: 'Commercial account parts lookup', icon: '', href: 'https://autozonepro.com', ext: true },
            { label: "O'Reilly Fleet", desc: 'Fleet & commercial ordering', icon: '', href: 'https://oreillyauto.com', ext: true },
            { label: 'OEMPartsPro', desc: 'Factory OEM diagrams & part numbers', icon: <FaRulerCombined style={{marginRight:4}} />, href: 'https://oempartspro.com', ext: true },
          ].map(card => (
            <a
              key={card.label}
              href={card.href}
              target={card.ext ? '_blank' : undefined}
              rel={card.ext ? 'noopener noreferrer' : undefined}
              style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:20, textDecoration:'none', display:'block'}}
            >
              <div style={{fontSize:32, marginBottom:8}}>{card.icon}</div>
              <div style={{fontSize:15, fontWeight:700, color:'#e5e7eb', marginBottom:4}}>{card.label}</div>
              <div style={{fontSize:12, color:'#9aa3b2'}}>{card.desc}</div>
              {card.ext && <div style={{fontSize:11, color:'#e5332a', marginTop:6}}><FaExternalLinkAlt style={{marginRight:4}} /> External site</div>}
            </a>
          ))}
        </div>

        {/* Common part brand quick-ref */}
        <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
          <h2 style={{fontSize:18, fontWeight:700, color:'#e5e7eb', marginBottom:16}}><FaBox style={{marginRight:4}} /> Common Part Brands Quick Reference</h2>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:12}}>
            {[
              { brand: 'ACDelco', info: 'GM OEM parts', color: '#facc15' },
              { brand: 'Bosch', info: 'Ignition, sensors, starters', color: '#e5332a' },
              { brand: 'Denso', info: 'O2 sensors, alternators', color: '#10b981' },
              { brand: 'Monroe', info: 'Shocks & struts', color: '#f97316' },
              { brand: 'Gates', info: 'Belts, hoses, timing kits', color: '#8b5cf6' },
              { brand: 'Dorman', info: 'Hard-to-find OE fix parts', color: '#ef4444' },
              { brand: 'Motorcraft', info: 'Ford OEM parts', color: '#06b6d4' },
              { brand: 'Mopar', info: 'Chrysler/Dodge/Jeep OEM', color: '#ec4899' },
            ].map(b => (
              <div key={b.brand} style={{background:'rgba(255,255,255,0.05)', border:`1px solid ${b.color}40`, borderRadius:8, padding:12}}>
                <div style={{fontSize:13, fontWeight:700, color: b.color}}>{b.brand}</div>
                <div style={{fontSize:11, color:'#9aa3b2', marginTop:2}}>{b.info}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

