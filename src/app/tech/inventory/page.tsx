'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaBox, FaCog, FaExternalLinkAlt, FaRulerCombined, FaBarcode } from 'react-icons/fa';
import BarcodeScanner from '@/components/BarcodeScanner';

export default function TechInventory() {
  const say = usePhrase();
  const { user, isLoading } = useRequireAuth(['tech']);
  const [showScanner, setShowScanner] = useState(false);
  const [scannedCode, setScannedCode] = useState('');

  const handleBarcodeScan = (barcode: string) => {
    setScannedCode(barcode);
    setShowScanner(false);
    // Auto-search for part or navigate
    window.open(`https://rockauto.com/catalog/carparts/search.html?q=${encodeURIComponent(barcode)}`, '_blank');
  };

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
          <h1 style={{fontSize:28, fontWeight:700, color:'#e5e7eb', marginBottom:8}}><FaCog style={{marginRight:4}} /> {say("Parts Inventory")}</h1>
          <p style={{fontSize:14, color:'#9aa3b2'}}>{say("Check parts availability, request orders, and track inventory levels")}</p>
        </div>
      </div>

      <div style={{maxWidth:1200, margin:'0 auto', padding:32}}>
        {/* Scanner Button */}
        <div style={{marginBottom:24}}>
          <button
            onClick={() => setShowScanner(true)}
            style={{
              display:'flex',
              alignItems:'center',
              gap:8,
              padding:'12px 20px',
              background:'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
              color:'white',
              border:'none',
              borderRadius:8,
              fontSize:16,
              fontWeight:600,
              cursor:'pointer',
              boxShadow:'0 4px 15px rgba(6,182,212,0.3)',
            }}
          >
            <FaBarcode /> {say("Scan Barcode")}{' '}</button>
          {scannedCode && (
            <div style={{marginTop:8, fontSize:13, color:'#22c55e'}}>
              {say("✓ Last scanned:")}{' '}{say(scannedCode)}
            </div>
          )}
        </div>

        {/* Scanner Modal */}
        {showScanner && (
          <BarcodeScanner
            onScan={handleBarcodeScan}
            onClose={() => setShowScanner(false)}
            label={say("Scan Part Barcode")}
          />
        )}

        {/* Quick links */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:16, marginBottom:32}}>
          {[
            { label: say("Parts Request"), desc: say("Submit a request to your shop manager"), icon: '', href: '/tech/parts-request', ext: false },
            { label: say("RockAuto"), desc: say("Low-cost OEM & aftermarket parts"), icon: '', href: 'https://rockauto.com', ext: true },
            { label: say("NAPA Online"), desc: say("Parts lookup & ordering"), icon: '', href: 'https://napaonline.com', ext: true },
            { label: say("AutoZone Pro"), desc: say("Commercial account parts lookup"), icon: '', href: 'https://autozonepro.com', ext: true },
            { label: say("O'Reilly Fleet"), desc: say("Fleet & commercial ordering"), icon: '', href: 'https://oreillyauto.com', ext: true },
            { label: say("OEMPartsPro"), desc: say("Factory OEM diagrams & part numbers"), icon: <FaRulerCombined style={{marginRight:4}} />, href: 'https://oempartspro.com', ext: true },
          ].map(card => (
            <a
              key={card.label}
              href={card.href}
              target={card.ext ? '_blank' : undefined}
              rel={card.ext ? 'noopener noreferrer' : undefined}
              style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:20, textDecoration:'none', display:'block'}}
            >
              <div style={{fontSize:32, marginBottom:8}}>{say(card.icon)}</div>
              <div style={{fontSize:15, fontWeight:700, color:'#e5e7eb', marginBottom:4}}>{say(card.label)}</div>
              <div style={{fontSize:12, color:'#9aa3b2'}}>{say(card.desc)}</div>
              {card.ext && <div style={{fontSize:11, color:'#e5332a', marginTop:6}}><FaExternalLinkAlt style={{marginRight:4}} /> {say("External site")}</div>}
            </a>
          ))}
        </div>

        {/* Common part brand quick-ref */}
        <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
          <h2 style={{fontSize:18, fontWeight:700, color:'#e5e7eb', marginBottom:16}}><FaBox style={{marginRight:4}} /> {say("Common Part Brands Quick Reference")}</h2>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:12}}>
            {[
              { brand: say("ACDelco"), info: say("GM OEM parts"), color: '#facc15' },
              { brand: say("Bosch"), info: say("Ignition, sensors, starters"), color: '#e5332a' },
              { brand: say("Denso"), info: say("O2 sensors, alternators"), color: '#10b981' },
              { brand: say("Monroe"), info: say("Shocks & struts"), color: '#f97316' },
              { brand: say("Gates"), info: say("Belts, hoses, timing kits"), color: '#8b5cf6' },
              { brand: say("Dorman"), info: say("Hard-to-find OE fix parts"), color: '#ef4444' },
              { brand: say("Motorcraft"), info: say("Ford OEM parts"), color: '#06b6d4' },
              { brand: say("Mopar"), info: say("Chrysler/Dodge/Jeep OEM"), color: '#ec4899' },
            ].map(b => (
              <div key={b.brand} style={{background:'rgba(255,255,255,0.05)', border:`1px solid ${b.color}40`, borderRadius:8, padding:12}}>
                <div style={{fontSize:13, fontWeight:700, color: b.color}}>{say(b.brand)}</div>
                <div style={{fontSize:11, color:'#9aa3b2', marginTop:2}}>{say(b.info)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

