'use client';


import { usePhrase } from '@/lib/usePhrase';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaBolt, FaExternalLinkAlt, FaIdCard, FaWrench } from 'react-icons/fa';

export default function TechDiagnostics() {
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
          <h1 style={{fontSize:28, fontWeight:700, color:'#e5e7eb', marginBottom:8}}><FaWrench style={{marginRight:4}} /> {say("Diagnostic Tools")}</h1>
          <p style={{fontSize:14, color:'#9aa3b2'}}>{say("Vehicle diagnostic tools, code readers, and troubleshooting guides")}</p>
        </div>
      </div>

      <div style={{maxWidth:1200, margin:'0 auto', padding:32}}>
        {/* External tools */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:16, marginBottom:32}}>
          {[
            { label: say("OBD Codes"), desc: say("Full P/B/C/U code library with causes & fixes"), icon: '', href: 'https://obd-codes.com' },
            { label: say("Engine Light Help"), desc: say("Free OBD-II code lookup & repair guides"), icon: '', href: 'https://engine-light-help.com' },
            { label: say("NHTSA VIN Decoder"), desc: say("Official VIN decode  -  year, make, model, specs"), icon: <FaIdCard style={{marginRight:4}} />, href: 'https://vpic.nhtsa.dot.gov/decoder/' },
            { label: say("CarMD"), desc: say("Code severity ratings & repair cost estimates"), icon: '', href: 'https://carmd.com' },
            { label: say("iATN TechHelp"), desc: say("Peer tech help & diagnostic discussions"), icon: '', href: 'https://iatn.net' },
            { label: say("TIS2Web / ACDelco TDS"), desc: say("GM factory scan tool & programming"), icon: '', href: 'https://tis2web.service.gm.com' },
          ].map(card => (
            <a key={card.label} href={card.href} target="_blank" rel="noopener noreferrer"
              style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:20, textDecoration:'none', display:'block'}}>
              <div style={{fontSize:32, marginBottom:8}}>{say(card.icon)}</div>
              <div style={{fontSize:15, fontWeight:700, color:'#e5e7eb', marginBottom:4}}>{say(card.label)}</div>
              <div style={{fontSize:12, color:'#9aa3b2'}}>{say(card.desc)}</div>
              <div style={{fontSize:11, color:'#e5332a', marginTop:6}}><FaExternalLinkAlt style={{marginRight:4}} /> {say("External site")}</div>
            </a>
          ))}
        </div>

        {/* Quick OBD-II reference table */}
        <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
          <h2 style={{fontSize:18, fontWeight:700, color:'#e5e7eb', marginBottom:16}}><FaBolt style={{marginRight:4}} /> {say("Common OBD-II Codes Quick Reference")}</h2>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
              <thead>
                <tr style={{borderBottom:'1px solid rgba(255,255,255,0.15)'}}>
                  {[say("Code"),say("Description"),say("Likely Cause"),say("Severity")].map(h => (
                    <th key={h} style={{textAlign:'left', padding:'8px 12px', color:'#9aa3b2', fontWeight:600}}>{say(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  [say("P0300"),say("Random/Multiple Cylinder Misfire"),say("Spark plugs, coils, injectors"),say(" High")],
                  [say("P0420"),say("Catalyst System Efficiency Below Threshold"),say("Catalytic converter, O2 sensor"),say(" Medium")],
                  [say("P0171"),say("System Too Lean (Bank 1)"),say("MAF sensor, vacuum leak, fuel pump"),say(" Medium")],
                  [say("P0442"),say("EVAP System Small Leak"),say("Gas cap, EVAP purge valve, hose"),say(" Low")],
                  [say("P0101"),say("MAF Sensor Range/Performance"),say("Dirty/failed MAF, air intake leak"),say(" Medium")],
                  [say("P0128"),say("Coolant Temp Below Thermostat Regulating"),say("Thermostat stuck open"),say(" Medium")],
                  [say("P0455"),say("EVAP System Large Leak"),say("Gas cap, EVAP vent solenoid"),say(" Low")],
                  [say("P0700"),say("Transmission Control System MIL Request"),say("TCM fault  -  check trans codes"),say(" High")],
                  [say("B0001"),say("Driver Frontal Stage 1 Deployment"),say("Airbag module, clock spring"),say(" Critical")],
                  [say("C0035"),say("Left Front Wheel Speed Sensor"),say("Wheel speed sensor, wiring, ABS ring"),say(" High")],
                ].map(([code, desc, cause, sev]) => (
                  <tr key={code} style={{borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                    <td style={{padding:'10px 12px', color:'#facc15', fontWeight:700, fontFamily:'monospace'}}>{say(code)}</td>
                    <td style={{padding:'10px 12px', color:'#e5e7eb'}}>{say(desc)}</td>
                    <td style={{padding:'10px 12px', color:'#9aa3b2'}}>{say(cause)}</td>
                    <td style={{padding:'10px 12px'}}>{say(sev)}</td>
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

