'use client';

import { useState } from 'react';

import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaBuilding, FaCheck, FaClipboardList, FaComments, FaMap, FaMapMarkerAlt, FaSyncAlt } from 'react-icons/fa';

export default function ShareLocation() {
  const { user, isLoading } = useRequireAuth(['tech']);
  const [location, setLocation] = useState<{lat: number; lng: number} | null>(null);
  const [address, setAddress] = useState('');
  const [sharing, setSharing] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [locationMsg, setLocationMsg] = useState<{type:'success'|'error';text:string}|null>(null);

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

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setLocation(coords);
          setAddress(`${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`);
        },
        () => {
          setLocationMsg({type:'error',text:'Unable to get location. Please check location permissions.'});
        }
      );
    } else {
      setLocationMsg({type:'error',text:'Geolocation is not supported by your browser'});
    }
  };

  const startSharing = () => {
    if (!location) {
      setLocationMsg({type:'error',text:'Please get your current location first'});
      return;
    }
    setSharing(true);
    const link = `https://maps.google.com/?q=${location.lat},${location.lng}`;
    setShareLink(link);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setLocationMsg({type:'success',text:'Location link copied to clipboard!'});
  };

  return (
    <div style={{minHeight:'100vh', background: 'transparent'}}>
      <div style={{background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(229,51,42,0.3)', padding:'20px 32px'}}>
        <div style={{maxWidth:900, margin:'0 auto'}}>
          <Link href="/tech/home" style={{color:'#e5332a', textDecoration:'none', fontSize:14, fontWeight:600, marginBottom:16, display:'inline-block'}}>
            <FaArrowLeft style={{marginRight:4}} /> Back to Dashboard
          </Link>
          <h1 style={{fontSize:28, fontWeight:700, color:'#e5e7eb', marginBottom:8}}><FaMapMarkerAlt style={{marginRight:4}} /> Share Location</h1>
          <p style={{fontSize:14, color:'#9aa3b2'}}>Share your current location with customers or dispatch</p>
        </div>
      </div>

      <div style={{maxWidth:900, margin:'0 auto', padding:32}}>
        {/* Get Location */}
        <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:32, marginBottom:24}}>
          <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:16}}>Current Location</h2>
          
          {!location ? (
            <div style={{textAlign:'center', padding:40}}>
              <div style={{fontSize:64, marginBottom:16}}><FaMapMarkerAlt style={{marginRight:4}} /></div>
              <p style={{fontSize:16, color:'#9aa3b2', marginBottom:24}}>Get your current GPS coordinates</p>
              <button onClick={getCurrentLocation} style={{padding:'14px 32px', background:'#e5332a', color:'white', border:'none', borderRadius:8, fontSize:15, fontWeight:600, cursor:'pointer'}}>
                Get Current Location
              </button>
            </div>
          ) : (
            <div>
              <div style={{background:'rgba(229,51,42,0.1)', border:'1px solid rgba(229,51,42,0.3)', borderRadius:8, padding:20, marginBottom:16}}>
                <div style={{fontSize:14, color:'#9aa3b2', marginBottom:8}}>GPS Coordinates</div>
                <div style={{fontSize:20, fontWeight:700, color:'#e5332a', fontFamily:'monospace'}}>{address}</div>
              </div>
              
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
                <div style={{background:'rgba(255,255,255,0.05)', borderRadius:8, padding:16}}>
                  <div style={{fontSize:12, color:'#9aa3b2', marginBottom:4}}>Latitude</div>
                  <div style={{fontSize:18, fontWeight:700, color:'#e5e7eb'}}>{location.lat.toFixed(6)}</div>
                </div>
                <div style={{background:'rgba(255,255,255,0.05)', borderRadius:8, padding:16}}>
                  <div style={{fontSize:12, color:'#9aa3b2', marginBottom:4}}>Longitude</div>
                  <div style={{fontSize:18, fontWeight:700, color:'#e5e7eb'}}>{location.lng.toFixed(6)}</div>
                </div>
              </div>

              <button onClick={getCurrentLocation} style={{width:'100%', marginTop:16, padding:'12px', background:'rgba(255,255,255,0.1)', color:'#e5e7eb', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}>
                <FaSyncAlt style={{marginRight:4}} /> Refresh Location
              </button>
            </div>
          )}
        </div>

        {/* Share Options */}
        {location && (
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:32}}>
            <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:16}}>Share Options</h2>
            
            {!sharing ? (
              <button onClick={startSharing} style={{width:'100%', padding:'16px', background:'#22c55e', color:'white', border:'none', borderRadius:8, fontSize:16, fontWeight:600, cursor:'pointer'}}>
                Start Sharing Location
              </button>
            ) : (
              <div>
                <div style={{background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:8, padding:20, marginBottom:16}}>
                  <div style={{fontSize:14, color:'#22c55e', marginBottom:8, fontWeight:600}}><FaCheck style={{marginRight:4}} /> Location Sharing Active</div>
                  <div style={{fontSize:13, color:'#9aa3b2', marginBottom:12}}>Share this link:</div>
                  <div style={{background:'rgba(0,0,0,0.3)', padding:12, borderRadius:6, fontSize:13, color:'#e5332a', wordBreak:'break-all', fontFamily:'monospace'}}>
                    {shareLink}
                  </div>
                </div>

                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                  <button onClick={copyLink} style={{padding:'14px', background:'rgba(229,51,42,0.2)', color:'#e5332a', border:'1px solid rgba(229,51,42,0.3)', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}>
                    <FaClipboardList style={{marginRight:4}} /> Copy Link
                  </button>
                  <a href={shareLink} target="_blank" rel="noopener noreferrer" style={{textDecoration:'none'}}>
                    <button style={{width:'100%', padding:'14px', background:'rgba(34,197,94,0.2)', color:'#22c55e', border:'1px solid rgba(34,197,94,0.3)', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}>
                      <FaMap style={{marginRight:4}} /> Open in Maps
                    </button>
                  </a>
                </div>

                <button onClick={() => setSharing(false)} style={{width:'100%', marginTop:12, padding:'14px', background:'rgba(229,51,42,0.2)', color:'#e5332a', border:'1px solid rgba(229,51,42,0.3)', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}>
                  Stop Sharing
                </button>
              </div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24, marginTop:24}}>
          <h3 style={{fontSize:16, fontWeight:700, color:'#e5e7eb', marginBottom:16}}>Quick Send To</h3>
          <div style={{display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:12}}>
            <button disabled={!location} style={{padding:'12px', background:'rgba(245,158,11,0.2)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.3)', borderRadius:8, fontSize:13, fontWeight:600, cursor:location ? 'pointer' : 'not-allowed', opacity:location ? 1 : 0.5}}>
              <FaComments style={{marginRight:4}} /> Send to Customer
            </button>
            <button disabled={!location} style={{padding:'12px', background:'rgba(139,92,246,0.2)', color:'#8b5cf6', border:'1px solid rgba(139,92,246,0.3)', borderRadius:8, fontSize:13, fontWeight:600, cursor:location ? 'pointer' : 'not-allowed', opacity:location ? 1 : 0.5}}>
              <FaBuilding style={{marginRight:4}} /> Send to Dispatch
            </button>
          </div>
        </div>
      </div>

      {locationMsg && (
        <div style={{position:'fixed',bottom:24,right:24,background:locationMsg.type==='success'?'#dcfce7':'#fde8e8',color:locationMsg.type==='success'?'#166534':'#991b1b',borderRadius:10,padding:'12px 20px',zIndex:9999,fontSize:14,fontWeight:600,boxShadow:'0 4px 12px rgba(0,0,0,0.3)'}}>
          {locationMsg.text}
          <button onClick={()=>setLocationMsg(null)} style={{marginLeft:12,background:'none',border:'none',cursor:'pointer',fontSize:16,color:'inherit'}}></button>
        </div>
      )}
    </div>
  );
}

