'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useEffect, useRef, useState } from 'react';

import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { TRACKABLE_WORK_ORDER_STATUSES } from '@/lib/customerTracking';
import { waitingJobsQuery } from '@/lib/waitingJobQueue';
import { workOrderTitle } from '@/lib/workOrderMetrics';
import { FaArrowLeft, FaBuilding, FaCheck, FaClipboardList, FaComments, FaMap, FaMapMarkerAlt, FaSyncAlt } from 'react-icons/fa';

const LOCATION_TIMEOUT_MS = 12000;

type GeoFailure = 'insecure' | 'unsupported' | 'denied' | 'timeout' | 'error';

function requestCurrentPosition(timeoutMs = LOCATION_TIMEOUT_MS): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject({ code: 'timeout' });
    }, timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(position);
      },
      (error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        reject(error);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}

function geoFailureText(error: unknown): { failure: GeoFailure; text: string } {
  const code = error && typeof error === 'object' && 'code' in error
    ? (error as { code?: unknown }).code
    : undefined;
  if (code === 'timeout' || code === 3) {
    return { failure: 'timeout', text: 'Location request timed out. Try again.' };
  }
  if (code === 1) {
    return {
      failure: 'denied',
      text: 'Location permission was denied. In the browser address bar, open the lock or site settings, set Location to Allow, then use Retry.',
    };
  }
  if (code === 2) {
    return { failure: 'error', text: 'Location is unavailable on this device.' };
  }
  const message = error instanceof Error ? error.message : '';
  return { failure: 'error', text: message || 'Unable to get location. Please allow location access.' };
}

export default function ShareLocation() {
  const say = usePhrase();
  const { user, isLoading } = useRequireAuth(['tech']);
  const [location, setLocation] = useState<{lat: number; lng: number} | null>(null);
  const [address, setAddress] = useState('');
  const [sharing, setSharing] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [locationMsg, setLocationMsg] = useState<{type:'success'|'error';text:string}|null>(null);
  const [jobs, setJobs] = useState<Array<{ id: string; label: string }>>([]);
  const [locating, setLocating] = useState(false);
  const [geoFailure, setGeoFailure] = useState<{ failure: GeoFailure; text: string } | null>(null);
  const [sharingJobId, setSharingJobId] = useState<string | null>(null);
  const roadCallId = useRef<string | null>(null);
  const watchId = useRef<number | null>(null);

  useEffect(() => () => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const token = localStorage.getItem('token');
    const query = waitingJobsQuery({
      assignedTo: user.id,
      statuses: [...TRACKABLE_WORK_ORDER_STATUSES],
    });
    fetch(`/api/workorders?${query}`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (response) => {
        if (!response.ok || cancelled) return;
        const data = await response.json();
        const rows = Array.isArray(data.workOrders) ? data.workOrders : [];
        if (cancelled) return;
        setJobs(rows.map((row: { id: string; issueDescription?: unknown }) => ({
          id: row.id,
          label: workOrderTitle(row),
        })));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id]);

  const publishRoadCallFix = async (lat: number, lng: number) => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await fetch('/api/tech/tracking?shopId=current', { credentials: 'include', headers });
    if (!response.ok) return 'Location captured. The shop map could not be updated.';
    const data = await response.json();
    const mine = (data.techs || []).find((tech: { id?: string; jobs?: { id: string }[] }) => tech.id === user?.id);
    const jobId = mine?.jobs?.[0]?.id || null;
    roadCallId.current = jobId;
    if (!jobId) return 'Location captured. The shop map tracks you only during an active road call.';
    const post = await fetch('/api/tech/tracking', {
      method: 'POST',
      credentials: 'include',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ workOrderId: jobId, latitude: lat, longitude: lng }),
    });
    if (!post.ok) return 'Location captured, but the shop map did not accept it.';
    return 'Location sent to the shop road-call map.';
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

  const beginWatch = (jobId: string) => {
    if (!navigator.geolocation) return;
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    roadCallId.current = jobId;
    watchId.current = navigator.geolocation.watchPosition((position) => {
      const token = localStorage.getItem('token');
      fetch('/api/tech/tracking', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          workOrderId: jobId,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      }).catch(() => {});
    });
  };

  const postJobLocation = async (jobId: string, lat: number, lng: number) => {
    const token = localStorage.getItem('token');
    const post = await fetch('/api/tech/tracking', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ workOrderId: jobId, latitude: lat, longitude: lng }),
    });
    if (!post.ok) {
      const body = await post.json().catch(() => ({}));
      throw new Error(typeof body.error === 'string' ? body.error : 'Location captured, but the shop map did not accept it.');
    }
    return 'Location sent for this job.';
  };

  const locate = async (): Promise<{ lat: number; lng: number } | null> => {
    if (!window.isSecureContext) {
      const failure = { failure: 'insecure' as const, text: 'Location requires HTTPS. Open the secure site and try again.' };
      setGeoFailure(failure);
      setLocationMsg({ type: 'error', text: failure.text });
      return null;
    }
    if (!navigator.geolocation) {
      const failure = { failure: 'unsupported' as const, text: 'Geolocation is not supported by your browser' };
      setGeoFailure(failure);
      setLocationMsg({ type: 'error', text: failure.text });
      return null;
    }
    setLocating(true);
    setGeoFailure(null);
    setLocationMsg({ type: 'success', text: 'Requesting location permission…' });
    try {
      const position = await requestCurrentPosition();
      const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
      setLocation(coords);
      setAddress(`${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`);
      setGeoFailure(null);
      return coords;
    } catch (error) {
      const failure = geoFailureText(error);
      setGeoFailure(failure);
      setLocationMsg({ type: 'error', text: failure.text });
      return null;
    } finally {
      setLocating(false);
    }
  };

  const getCurrentLocation = () => {
    void locate().then((coords) => {
      if (!coords) return;
      publishRoadCallFix(coords.lat, coords.lng)
        .then((text) => setLocationMsg({ type: 'success', text }))
        .catch(() => setLocationMsg({ type: 'error', text: 'Location captured, but the shop map could not be updated.' }));
    });
  };

  const shareForJob = async (jobId: string) => {
    setSharingJobId(jobId);
    try {
      const coords = location || await locate();
      if (!coords) return;
      const note = await postJobLocation(jobId, coords.lat, coords.lng);
      setShareLink(`https://maps.google.com/?q=${coords.lat},${coords.lng}`);
      setSharing(true);
      beginWatch(jobId);
      setLocationMsg({ type: 'success', text: note });
    } catch (error) {
      setLocationMsg({ type: 'error', text: error instanceof Error ? error.message : 'Location captured, but the shop map did not accept it.' });
    } finally {
      setSharingJobId(null);
    }
  };

  const startSharing = async () => {
    if (!location) {
      setLocationMsg({type:'error',text:'Please get your current location first'});
      return;
    }
    setSharing(true);
    const link = `https://maps.google.com/?q=${location.lat},${location.lng}`;
    setShareLink(link);
    try {
      const note = await publishRoadCallFix(location.lat, location.lng);
      setLocationMsg({ type: 'success', text: note });
    } catch {
      setLocationMsg({ type: 'error', text: 'Location captured, but the shop map could not be updated.' });
      return;
    }
    if (!roadCallId.current || !navigator.geolocation) return;
    beginWatch(roadCallId.current);
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
            <FaArrowLeft style={{marginRight:4}} /> {say("Back to Dashboard")}{' '}</Link>
          <h1 style={{fontSize:28, fontWeight:700, color:'#e5e7eb', marginBottom:8}}><FaMapMarkerAlt style={{marginRight:4}} /> {say("Share Location")}</h1>
          <p style={{fontSize:14, color:'#9aa3b2'}}>{say("Share your current location with customers or dispatch")}</p>
        </div>
      </div>

      <div style={{maxWidth:900, margin:'0 auto', padding:32}}>
        {/* Get Location */}
        <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:32, marginBottom:24}}>
          <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:16}}>{say("Current Location")}</h2>
          
          {!location ? (
            <div style={{textAlign:'center', padding:40}}>
              <div style={{fontSize:64, marginBottom:16}}><FaMapMarkerAlt style={{marginRight:4}} /></div>
              <p style={{fontSize:16, color:'#9aa3b2', marginBottom:24}}>{say("Get your current GPS coordinates")}</p>
              <button onClick={getCurrentLocation} disabled={locating} style={{padding:'14px 32px', background:'#e5332a', color:'white', border:'none', borderRadius:8, fontSize:15, fontWeight:600, cursor: locating ? 'wait' : 'pointer'}}>
                {locating ? 'Requesting location permission…' : say("Get Current Location")}{' '}</button>
            </div>
          ) : (
            <div>
              <div style={{background:'rgba(229,51,42,0.1)', border:'1px solid rgba(229,51,42,0.3)', borderRadius:8, padding:20, marginBottom:16}}>
                <div style={{fontSize:14, color:'#9aa3b2', marginBottom:8}}>{say("GPS Coordinates")}</div>
                <div style={{fontSize:20, fontWeight:700, color:'#e5332a', fontFamily:'monospace'}}>{say(address)}</div>
              </div>
              
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
                <div style={{background:'rgba(255,255,255,0.05)', borderRadius:8, padding:16}}>
                  <div style={{fontSize:12, color:'#9aa3b2', marginBottom:4}}>{say("Latitude")}</div>
                  <div style={{fontSize:18, fontWeight:700, color:'#e5e7eb'}}>{location.lat.toFixed(6)}</div>
                </div>
                <div style={{background:'rgba(255,255,255,0.05)', borderRadius:8, padding:16}}>
                  <div style={{fontSize:12, color:'#9aa3b2', marginBottom:4}}>{say("Longitude")}</div>
                  <div style={{fontSize:18, fontWeight:700, color:'#e5e7eb'}}>{location.lng.toFixed(6)}</div>
                </div>
              </div>

              <button onClick={getCurrentLocation} disabled={locating} style={{width:'100%', marginTop:16, padding:'12px', background:'rgba(255,255,255,0.1)', color:'#e5e7eb', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, fontSize:14, fontWeight:600, cursor: locating ? 'wait' : 'pointer'}}>
                <FaSyncAlt style={{marginRight:4}} /> {locating ? 'Requesting location permission…' : say("Refresh Location")}{' '}</button>
            </div>
          )}
          {locating && <p role="status" style={{margin:'16px 0 0', color:'#e5e7eb'}}>Requesting location permission…</p>}
          {geoFailure && (
            <div role="alert" style={{marginTop:16}}>
              <p style={{margin:'0 0 12px', color:'#fca5a5'}}>{geoFailure.text}</p>
              <button type="button" onClick={getCurrentLocation} disabled={locating} style={{padding:'12px 20px', background:'#e5332a', color:'white', border:'none', borderRadius:8, fontSize:14, fontWeight:700, cursor: locating ? 'wait' : 'pointer'}}>
                {say("Retry")}
              </button>
            </div>
          )}
        </div>

        <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:32, marginBottom:24}}>
          <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:16}}>Share my location for this job</h2>
          {jobs.length === 0 ? (
            <p style={{fontSize:14, color:'#9aa3b2', margin:0}}>You have no assigned jobs right now.</p>
          ) : (
            <div style={{display:'grid', gap:12}}>
              {jobs.map((job) => (
                <div key={job.id} style={{display:'flex', justifyContent:'space-between', gap:12, alignItems:'center', flexWrap:'wrap'}}>
                  <div>
                    <div style={{color:'#e5e7eb', fontWeight:700}}>{job.label}</div>
                    <div style={{color:'#9aa3b2', fontSize:12}}>{job.id}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { void shareForJob(job.id); }}
                    disabled={locating || sharingJobId === job.id}
                    style={{padding:'12px 16px', background:'#22c55e', color:'white', border:'none', borderRadius:8, fontSize:14, fontWeight:700, cursor: locating || sharingJobId === job.id ? 'wait' : 'pointer'}}
                  >
                    Share my location for this job
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Share Options */}
        {location && (
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:32}}>
            <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:16}}>{say("Share Options")}</h2>
            
            {!sharing ? (
              <button onClick={startSharing} style={{width:'100%', padding:'16px', background:'#22c55e', color:'white', border:'none', borderRadius:8, fontSize:16, fontWeight:600, cursor:'pointer'}}>
                {say("Start Sharing Location")}{' '}</button>
            ) : (
              <div>
                <div style={{background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:8, padding:20, marginBottom:16}}>
                  <div style={{fontSize:14, color:'#22c55e', marginBottom:8, fontWeight:600}}><FaCheck style={{marginRight:4}} /> {say("Location Sharing Active")}</div>
                  <div style={{fontSize:13, color:'#9aa3b2', marginBottom:12}}>{say("Share this link:")}</div>
                  <div style={{background:'rgba(0,0,0,0.3)', padding:12, borderRadius:6, fontSize:13, color:'#e5332a', wordBreak:'break-all', fontFamily:'monospace'}}>
                    {say(shareLink)}
                  </div>
                </div>

                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                  <button onClick={copyLink} style={{padding:'14px', background:'rgba(229,51,42,0.2)', color:'#e5332a', border:'1px solid rgba(229,51,42,0.3)', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}>
                    <FaClipboardList style={{marginRight:4}} /> {say("Copy Link")}{' '}</button>
                  <a href={shareLink} target="_blank" rel="noopener noreferrer" style={{textDecoration:'none'}}>
                    <button style={{width:'100%', padding:'14px', background:'rgba(34,197,94,0.2)', color:'#22c55e', border:'1px solid rgba(34,197,94,0.3)', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}>
                      <FaMap style={{marginRight:4}} /> {say("Open in Maps")}{' '}</button>
                  </a>
                </div>

                <button onClick={() => {
                  setSharing(false);
                  if (watchId.current != null) {
                    navigator.geolocation.clearWatch(watchId.current);
                    watchId.current = null;
                  }
                }} style={{width:'100%', marginTop:12, padding:'14px', background:'rgba(229,51,42,0.2)', color:'#e5332a', border:'1px solid rgba(229,51,42,0.3)', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}>
                  {say("Stop Sharing")}{' '}</button>
              </div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24, marginTop:24}}>
          <h3 style={{fontSize:16, fontWeight:700, color:'#e5e7eb', marginBottom:16}}>{say("Quick Send To")}</h3>
          <div style={{display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:12}}>
            <button disabled={!location} style={{padding:'12px', background:'rgba(245,158,11,0.2)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.3)', borderRadius:8, fontSize:13, fontWeight:600, cursor:location ? 'pointer' : 'not-allowed', opacity:location ? 1 : 0.5}}>
              <FaComments style={{marginRight:4}} /> {say("Send to Customer")}{' '}</button>
            <button disabled={!location} style={{padding:'12px', background:'rgba(139,92,246,0.2)', color:'#8b5cf6', border:'1px solid rgba(139,92,246,0.3)', borderRadius:8, fontSize:13, fontWeight:600, cursor:location ? 'pointer' : 'not-allowed', opacity:location ? 1 : 0.5}}>
              <FaBuilding style={{marginRight:4}} /> {say("Send to Dispatch")}{' '}</button>
          </div>
        </div>
      </div>

      {locationMsg && (
        <div style={{position:'fixed',bottom:24,right:24,background:locationMsg.type==='success'?'#dcfce7':'#fde8e8',color:locationMsg.type==='success'?'#166534':'#991b1b',borderRadius:10,padding:'12px 20px',zIndex:9999,fontSize:14,fontWeight:600,boxShadow:'0 4px 12px rgba(0,0,0,0.3)'}}>
          {say(locationMsg.text)}
          <button aria-label={say("Dismiss")} onClick={()=>setLocationMsg(null)} style={{marginLeft:12,background:'none',border:'none',cursor:'pointer',fontSize:16,color:'inherit'}}>×</button>
        </div>
      )}
    </div>
  );
}

