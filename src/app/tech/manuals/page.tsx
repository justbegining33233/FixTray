'use client';


import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaBook, FaCaretRight, FaCog, FaExternalLinkAlt, FaStopwatch, FaUniversity } from 'react-icons/fa';

export default function TechManuals() {
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
          <h1 style={{fontSize:28, fontWeight:700, color:'#e5e7eb', marginBottom:8}}><FaBook style={{marginRight:4}} /> Service Manuals</h1>
          <p style={{fontSize:14, color:'#9aa3b2'}}>Access technical documentation, repair guides, and service procedures</p>
        </div>
      </div>

      <div style={{maxWidth:1200, margin:'0 auto', padding:32}}>
        <h2 style={{fontSize:16, fontWeight:700, color:'#9aa3b2', marginBottom:12, textTransform:'uppercase', letterSpacing:1}}>Professional Services</h2>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:16, marginBottom:32}}>
          {[
            { label: 'ALLDATA DIY', desc: 'Factory OEM repair info  -  wiring diagrams, torque specs, TSBs', icon: <FaBook style={{marginRight:4}} />, href: 'https://alldatadiy.com', badge: 'Most Complete' },
            { label: 'Mitchell 1 ProDemand', desc: 'OEM + SureTrack real-fix repair procedures', icon: '', href: 'https://mitchell1.com', badge: 'Industry Standard' },
            { label: 'Identifix Direct-Hit', desc: 'Confirmed fixes, OEM recalls, and tech hotline', icon: '', href: 'https://identifix.com', badge: 'Fixed-First-Time' },
            { label: 'Autodata', desc: 'Timing, service intervals, labor times, wiring', icon: <FaStopwatch style={{marginRight:4}} />, href: 'https://autodata-group.com', badge: '' },
          ].map(s => (
            <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
              style={{background:'rgba(0,0,0,0.35)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:12, padding:20, textDecoration:'none', display:'block', position:'relative'}}>
              {s.badge && <span style={{position:'absolute', top:12, right:12, background:'rgba(245,158,11,0.2)', color:'#facc15', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:999}}>{s.badge}</span>}
              <div style={{fontSize:32, marginBottom:8}}>{s.icon}</div>
              <div style={{fontSize:15, fontWeight:700, color:'#e5e7eb', marginBottom:6}}>{s.label}</div>
              <div style={{fontSize:12, color:'#9aa3b2', lineHeight:1.5}}>{s.desc}</div>
              <div style={{fontSize:11, color:'#e5332a', marginTop:8}}><FaExternalLinkAlt style={{marginRight:4}} /> Open site</div>
            </a>
          ))}
        </div>

        <h2 style={{fontSize:16, fontWeight:700, color:'#9aa3b2', marginBottom:12, textTransform:'uppercase', letterSpacing:1}}>Free Resources</h2>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:16, marginBottom:32}}>
          {[
            { label: 'NHTSA TSB Search', desc: 'Official Technical Service Bulletins by VIN or YMME', icon: <FaUniversity style={{marginRight:4}} />, href: 'https://www.nhtsa.gov/vehicle/latest/#/' },
            { label: 'NHTSA Recall Search', desc: 'Check for open safety recalls by VIN', icon: '', href: 'https://www.nhtsa.gov/recalls' },
            { label: 'iATN TechHelp', desc: 'Free peer-to-peer tech discussion forums', icon: '', href: 'https://iatn.net' },
            { label: 'YouTube - EricTheCarGuy', desc: 'Free visual repair walkthroughs', icon: <FaCaretRight style={{marginRight:4}} />, href: 'https://youtube.com/@EricTheCarGuy' },
            { label: 'Gates Timing Guide', desc: 'Timing belt intervals & kits by vehicle', icon: '', href: 'https://www.gates.com/en-us/resources/tools-and-resources/timing-drive-component-kits' },
            { label: 'FCA ServiceInfo (Mopar)', desc: 'Stellantis/Mopar factory service info', icon: '', href: 'https://www.fcaserviceinfo.com' },
          ].map(r => (
            <a key={r.label} href={r.href} target="_blank" rel="noopener noreferrer"
              style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:20, textDecoration:'none', display:'block'}}>
              <div style={{fontSize:28, marginBottom:8}}>{r.icon}</div>
              <div style={{fontSize:14, fontWeight:700, color:'#e5e7eb', marginBottom:4}}>{r.label}</div>
              <div style={{fontSize:12, color:'#9aa3b2', lineHeight:1.5}}>{r.desc}</div>
              <div style={{fontSize:11, color:'#e5332a', marginTop:6}}><FaExternalLinkAlt style={{marginRight:4}} /> External site</div>
            </a>
          ))}
        </div>

        {/* Torque spec quick ref */}
        <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
          <h2 style={{fontSize:18, fontWeight:700, color:'#e5e7eb', marginBottom:16}}><FaCog style={{marginRight:4}} /> Common Torque Specs Quick Reference</h2>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:12}}>
            {[
              ['Lug Nuts (most passenger cars)', '80-100 ft-lb'],
              ['Lug Nuts (3/4-1 ton truck)', '120-165 ft-lb'],
              ['Brake Caliper Bracket Bolts', '44-88 ft-lb'],
              ['Wheel Hub Nut (FWD)', '150-200 ft-lb'],
              ['Spark Plugs (aluminum head)', '13-15 ft-lb'],
              ['Oil Drain Plug (average)', '20-30 ft-lb'],
              ['Valve Cover Bolts', '7-9 ft-lb'],
              ['Thermostat Housing Bolts', '8-10 ft-lb'],
            ].map(([item, spec]) => (
              <div key={item} style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, padding:'12px 14px'}}>
                <div style={{fontSize:12, color:'#9aa3b2', marginBottom:4}}>{item}</div>
                <div style={{fontSize:15, fontWeight:700, color:'#facc15'}}>{spec}</div>
              </div>
            ))}
          </div>
          <p style={{fontSize:11, color:'#6b7280', marginTop:12}}>* Always verify specs in the factory service manual for your specific vehicle.</p>
        </div>
      </div>
    </div>
  );
}

