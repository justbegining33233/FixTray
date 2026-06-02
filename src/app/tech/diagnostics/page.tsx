'use client';


import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaBolt, FaExternalLinkAlt, FaIdCard, FaWrench } from 'react-icons/fa';

export default function TechDiagnostics() {
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
          <h1 style={{fontSize:28, fontWeight:700, color:'#e5e7eb', marginBottom:8}}><FaWrench style={{marginRight:4}} /> Diagnostic Tools</h1>
          <p style={{fontSize:14, color:'#9aa3b2'}}>Vehicle diagnostic tools, code readers, and troubleshooting guides</p>
        </div>
      </div>

      <div style={{maxWidth:1200, margin:'0 auto', padding:32}}>
        {/* External tools */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:16, marginBottom:32}}>
          {[
            { label: 'OBD Codes', desc: 'Full P/B/C/U code library with causes & fixes', icon: '', href: 'https://obd-codes.com' },
            { label: 'Engine Light Help', desc: 'Free OBD-II code lookup & repair guides', icon: '', href: 'https://engine-light-help.com' },
            { label: 'NHTSA VIN Decoder', desc: 'Official VIN decode  -  year, make, model, specs', icon: <FaIdCard style={{marginRight:4}} />, href: 'https://vpic.nhtsa.dot.gov/decoder/' },
            { label: 'CarMD', desc: 'Code severity ratings & repair cost estimates', icon: '', href: 'https://carmd.com' },
            { label: 'iATN TechHelp', desc: 'Peer tech help & diagnostic discussions', icon: '', href: 'https://iatn.net' },
            { label: 'TIS2Web / ACDelco TDS', desc: 'GM factory scan tool & programming', icon: '', href: 'https://tis2web.service.gm.com' },
          ].map(card => (
            <a key={card.label} href={card.href} target="_blank" rel="noopener noreferrer"
              style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:20, textDecoration:'none', display:'block'}}>
              <div style={{fontSize:32, marginBottom:8}}>{card.icon}</div>
              <div style={{fontSize:15, fontWeight:700, color:'#e5e7eb', marginBottom:4}}>{card.label}</div>
              <div style={{fontSize:12, color:'#9aa3b2'}}>{card.desc}</div>
              <div style={{fontSize:11, color:'#e5332a', marginTop:6}}><FaExternalLinkAlt style={{marginRight:4}} /> External site</div>
            </a>
          ))}
        </div>

        {/* Quick OBD-II reference table */}
        <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
          <h2 style={{fontSize:18, fontWeight:700, color:'#e5e7eb', marginBottom:16}}><FaBolt style={{marginRight:4}} /> Common OBD-II Codes Quick Reference</h2>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
              <thead>
                <tr style={{borderBottom:'1px solid rgba(255,255,255,0.15)'}}>
                  {['Code','Description','Likely Cause','Severity'].map(h => (
                    <th key={h} style={{textAlign:'left', padding:'8px 12px', color:'#9aa3b2', fontWeight:600}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['P0300','Random/Multiple Cylinder Misfire','Spark plugs, coils, injectors',' High'],
                  ['P0420','Catalyst System Efficiency Below Threshold','Catalytic converter, O2 sensor',' Medium'],
                  ['P0171','System Too Lean (Bank 1)','MAF sensor, vacuum leak, fuel pump',' Medium'],
                  ['P0442','EVAP System Small Leak','Gas cap, EVAP purge valve, hose',' Low'],
                  ['P0101','MAF Sensor Range/Performance','Dirty/failed MAF, air intake leak',' Medium'],
                  ['P0128','Coolant Temp Below Thermostat Regulating','Thermostat stuck open',' Medium'],
                  ['P0455','EVAP System Large Leak','Gas cap, EVAP vent solenoid',' Low'],
                  ['P0700','Transmission Control System MIL Request','TCM fault  -  check trans codes',' High'],
                  ['B0001','Driver Frontal Stage 1 Deployment','Airbag module, clock spring',' Critical'],
                  ['C0035','Left Front Wheel Speed Sensor','Wheel speed sensor, wiring, ABS ring',' High'],
                ].map(([code, desc, cause, sev]) => (
                  <tr key={code} style={{borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                    <td style={{padding:'10px 12px', color:'#facc15', fontWeight:700, fontFamily:'monospace'}}>{code}</td>
                    <td style={{padding:'10px 12px', color:'#e5e7eb'}}>{desc}</td>
                    <td style={{padding:'10px 12px', color:'#9aa3b2'}}>{cause}</td>
                    <td style={{padding:'10px 12px'}}>{sev}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

