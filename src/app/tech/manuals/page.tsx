'use client';


import { usePhrase } from '@/lib/usePhrase';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaBook, FaCaretRight, FaCog, FaExternalLinkAlt, FaStopwatch, FaUniversity } from 'react-icons/fa';

export default function TechManuals() {
  const say = usePhrase();
  const { user, isLoading } = useRequireAuth(['tech']);

  if (isLoading) {
    return (
      <div style={{minHeight:'100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{color: '#e5e7eb', fontSize: 18}}>{say("Loading...")}</div>
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
            <FaArrowLeft style={{marginRight:4}} /> {say("Back to Tools")}{' '}</Link>
          <h1 style={{fontSize:28, fontWeight:700, color:'#e5e7eb', marginBottom:8}}><FaBook style={{marginRight:4}} /> {say("Service Manuals")}</h1>
          <p style={{fontSize:14, color:'#9aa3b2'}}>{say("Access technical documentation, repair guides, and service procedures")}</p>
        </div>
      </div>

      <div style={{maxWidth:1200, margin:'0 auto', padding:32}}>
        <h2 style={{fontSize:16, fontWeight:700, color:'#9aa3b2', marginBottom:12, textTransform:'uppercase', letterSpacing:1}}>{say("Professional Services")}</h2>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:16, marginBottom:32}}>
          {[
            { label: say("ALLDATA DIY"), desc: say("Factory OEM repair info  -  wiring diagrams, torque specs, TSBs"), icon: <FaBook style={{marginRight:4}} />, href: 'https://alldatadiy.com', badge: say("Most Complete") },
            { label: say("Mitchell 1 ProDemand"), desc: say("OEM + SureTrack real-fix repair procedures"), icon: '', href: 'https://mitchell1.com', badge: say("Industry Standard") },
            { label: say("Identifix Direct-Hit"), desc: say("Confirmed fixes, OEM recalls, and tech hotline"), icon: '', href: 'https://identifix.com', badge: say("Fixed-First-Time") },
            { label: say("Autodata"), desc: say("Timing, service intervals, labor times, wiring"), icon: <FaStopwatch style={{marginRight:4}} />, href: 'https://autodata-group.com', badge: '' },
          ].map(s => (
            <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
              style={{background:'rgba(0,0,0,0.35)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:12, padding:20, textDecoration:'none', display:'block', position:'relative'}}>
              {s.badge && <span style={{position:'absolute', top:12, right:12, background:'rgba(245,158,11,0.2)', color:'#facc15', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:999}}>{say(s.badge)}</span>}
              <div style={{fontSize:32, marginBottom:8}}>{say(s.icon)}</div>
              <div style={{fontSize:15, fontWeight:700, color:'#e5e7eb', marginBottom:6}}>{say(s.label)}</div>
              <div style={{fontSize:12, color:'#9aa3b2', lineHeight:1.5}}>{say(s.desc)}</div>
              <div style={{fontSize:11, color:'#e5332a', marginTop:8}}><FaExternalLinkAlt style={{marginRight:4}} /> {say("Open site")}</div>
            </a>
          ))}
        </div>

        <h2 style={{fontSize:16, fontWeight:700, color:'#9aa3b2', marginBottom:12, textTransform:'uppercase', letterSpacing:1}}>{say("Free Resources")}</h2>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:16, marginBottom:32}}>
          {[
            { label: say("NHTSA TSB Search"), desc: say("Official Technical Service Bulletins by VIN or YMME"), icon: <FaUniversity style={{marginRight:4}} />, href: 'https://www.nhtsa.gov/vehicle/latest/#/' },
            { label: say("NHTSA Recall Search"), desc: say("Check for open safety recalls by VIN"), icon: '', href: 'https://www.nhtsa.gov/recalls' },
            { label: say("iATN TechHelp"), desc: say("Free peer-to-peer tech discussion forums"), icon: '', href: 'https://iatn.net' },
            { label: say("YouTube - EricTheCarGuy"), desc: say("Free visual repair walkthroughs"), icon: <FaCaretRight style={{marginRight:4}} />, href: 'https://youtube.com/@EricTheCarGuy' },
            { label: say("Gates Timing Guide"), desc: say("Timing belt intervals & kits by vehicle"), icon: '', href: 'https://www.gates.com/en-us/resources/tools-and-resources/timing-drive-component-kits' },
            { label: say("FCA ServiceInfo (Mopar)"), desc: say("Stellantis/Mopar factory service info"), icon: '', href: 'https://www.fcaserviceinfo.com' },
          ].map(r => (
            <a key={r.label} href={r.href} target="_blank" rel="noopener noreferrer"
              style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:20, textDecoration:'none', display:'block'}}>
              <div style={{fontSize:28, marginBottom:8}}>{say(r.icon)}</div>
              <div style={{fontSize:14, fontWeight:700, color:'#e5e7eb', marginBottom:4}}>{say(r.label)}</div>
              <div style={{fontSize:12, color:'#9aa3b2', lineHeight:1.5}}>{say(r.desc)}</div>
              <div style={{fontSize:11, color:'#e5332a', marginTop:6}}><FaExternalLinkAlt style={{marginRight:4}} /> {say("External site")}</div>
            </a>
          ))}
        </div>

        {/* Torque spec quick ref */}
        <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
          <h2 style={{fontSize:18, fontWeight:700, color:'#e5e7eb', marginBottom:16}}><FaCog style={{marginRight:4}} /> {say("Common Torque Specs Quick Reference")}</h2>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:12}}>
            {[
              [say("Lug Nuts (most passenger cars)"), say("80-100 ft-lb")],
              [say("Lug Nuts (3/4-1 ton truck)"), say("120-165 ft-lb")],
              [say("Brake Caliper Bracket Bolts"), say("44-88 ft-lb")],
              [say("Wheel Hub Nut (FWD)"), say("150-200 ft-lb")],
              [say("Spark Plugs (aluminum head)"), say("13-15 ft-lb")],
              [say("Oil Drain Plug (average)"), say("20-30 ft-lb")],
              [say("Valve Cover Bolts"), say("7-9 ft-lb")],
              [say("Thermostat Housing Bolts"), say("8-10 ft-lb")],
            ].map(([item, spec]) => (
              <div key={item} style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, padding:'12px 14px'}}>
                <div style={{fontSize:12, color:'#9aa3b2', marginBottom:4}}>{say(item)}</div>
                <div style={{fontSize:15, fontWeight:700, color:'#facc15'}}>{say(spec)}</div>
              </div>
            ))}
          </div>
          <p style={{fontSize:11, color:'#6b7280', marginTop:12}}>{say("* Always verify specs in the factory service manual for your specific vehicle.")}</p>
        </div>
      </div>
    </div>
  );
}

