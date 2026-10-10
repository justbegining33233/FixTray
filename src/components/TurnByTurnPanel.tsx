'use client';

import { useEffect, useRef, useState } from 'react';
import { usePhrase } from '@/lib/usePhrase';
import { configureLeafletIcons } from '@/lib/leafletIcons';
import { SHOP_ADDRESS_PROMPT, SHOP_ADDRESS_SETTINGS_HREF, shopMapEmptyMessage } from '@/lib/shopAddressPrompt';
import {
  activeStepIndex,
  formatTripDistance,
  formatTripDuration,
  nearestLineDistance,
  type TurnStep,
} from '@/lib/turnByTurn';

type Destination = {
  kind: 'job' | 'shop';
  label: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
};

type DirectionsPayload = {
  available?: boolean;
  destination?: Destination | null;
  steps?: TurnStep[];
  line?: Array<{ latitude: number; longitude: number }>;
  distanceMeters?: number | null;
  durationSeconds?: number | null;
  external?: { google: string; apple: string } | null;
  message?: string;
  reason?: 'missing-shop-address' | 'missing-job-address' | 'ungeocoded' | null;
};

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function ensureLeaflet(): Promise<any | null> {
  if (typeof window === 'undefined') return null;
  const existing = (window as unknown as { L?: unknown }).L;
  if (existing) return existing;
  if (!document.querySelector('#leaflet-css')) {
    const link = document.createElement('link');
    link.id = 'leaflet-css';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }
  await new Promise<void>((resolve, reject) => {
    const prior = document.querySelector('#leaflet-js') as HTMLScriptElement | null;
    if (prior) {
      if ((window as unknown as { L?: unknown }).L) resolve();
      else prior.addEventListener('load', () => resolve(), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.id = 'leaflet-js';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('map'));
    document.body.appendChild(script);
  });
  return (window as unknown as { L?: unknown }).L ?? null;
}

export default function TurnByTurnPanel({ workOrderId }: { workOrderId: string }) {
  const say = usePhrase();
  const [payload, setPayload] = useState<DirectionsPayload | null>(null);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [here, setHere] = useState<{ latitude: number; longitude: number } | null>(null);
  const [following, setFollowing] = useState(false);
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const watchRef = useRef<number | null>(null);

  const load = async (origin?: { latitude: number; longitude: number } | null) => {
    const params = new URLSearchParams();
    if (origin) {
      params.set('originLat', String(origin.latitude));
      params.set('originLng', String(origin.longitude));
    }
    const query = params.toString();
    const res = await fetch(`/api/workorders/${workOrderId}/directions${query ? `?${query}` : ''}`, {
      headers: authHeaders(),
    });
    if (res.status === 401 || res.status === 403) {
      setHidden(true);
      return null;
    }
    const data = await res.json().catch(() => null) as DirectionsPayload | null;
    if (!res.ok || !data || data.available === false) {
      setHidden(true);
      return null;
    }
    setPayload(data);
    return data;
  };

  useEffect(() => {
    let cancelled = false;
    load().catch(() => {
      if (!cancelled) setError('Directions could not be loaded.');
    });
    return () => {
      cancelled = true;
      if (watchRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
    };
  }, [workOrderId]);

  const steps = payload?.steps || [];
  const line = payload?.line || [];
  const active = here && steps.length ? activeStepIndex(steps, here) : 0;
  const offRoute = here && line.length ? (nearestLineDistance(line, here) || 0) > 80 : false;

  useEffect(() => {
    if (!mapNode.current || line.length < 2) return;
    let cancelled = false;
    ensureLeaflet().then((L) => {
      if (cancelled || !L || !mapNode.current) return;
      configureLeafletIcons(L);
      if (!mapRef.current) {
        mapRef.current = L.map(mapNode.current, { zoomControl: true, attributionControl: true });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap',
        }).addTo(mapRef.current);
      }
      const latLngs = line.map((point) => [point.latitude, point.longitude]);
      if (mapRef.current._fixtrayRoute) mapRef.current.removeLayer(mapRef.current._fixtrayRoute);
      mapRef.current._fixtrayRoute = L.polyline(latLngs, { color: '#e5332a', weight: 5 }).addTo(mapRef.current);
      const dest = payload?.destination;
      if (dest?.latitude != null && dest.longitude != null) {
        if (mapRef.current._fixtrayDest) mapRef.current.removeLayer(mapRef.current._fixtrayDest);
        mapRef.current._fixtrayDest = L.marker([dest.latitude, dest.longitude]).addTo(mapRef.current);
      }
      if (here) {
        if (mapRef.current._fixtrayHere) mapRef.current.removeLayer(mapRef.current._fixtrayHere);
        mapRef.current._fixtrayHere = L.circleMarker([here.latitude, here.longitude], {
          radius: 7,
          color: '#60a5fa',
          fillColor: '#60a5fa',
          fillOpacity: 0.9,
        }).addTo(mapRef.current);
      }
      mapRef.current.fitBounds(latLngs, { padding: [24, 24] });
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [line, here, payload?.destination]);

  useEffect(() => () => {
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
  }, []);

  const start = () => {
    if (!navigator.geolocation) {
      setError('This browser cannot share location. Open driving directions in the browser instead.');
      return;
    }
    setBusy(true);
    setError('');
    navigator.geolocation.getCurrentPosition(async (position) => {
      const origin = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setHere(origin);
      try {
        await load(origin);
        setFollowing(true);
        if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = navigator.geolocation.watchPosition((next) => {
          setHere({ latitude: next.coords.latitude, longitude: next.coords.longitude });
        }, () => {}, { enableHighAccuracy: true, maximumAge: 4000 });
      } catch {
        setError('Turn-by-turn steps did not load. Open driving directions in the browser.');
      } finally {
        setBusy(false);
      }
    }, () => {
      setBusy(false);
      setError('Location was blocked. Open driving directions in the browser, or allow location and try again.');
    }, { enableHighAccuracy: true, timeout: 12000 });
  };

  if (hidden) return null;
  if (!payload) {
    if (!error) return null;
    return (
      <section id="directions" style={{ marginTop: 16, background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(96,165,250,0.35)', borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#93c5fd' }}>{say('Turn-by-turn')}</div>
        <p style={{ margin: '8px 0 0', color: '#fca5a5', fontSize: 13 }}>{say(error)}</p>
      </section>
    );
  }

  const dest = payload.destination;
  const startReady = typeof dest?.latitude === 'number' && Number.isFinite(dest.latitude);
  const shopSettings = payload.reason === 'missing-shop-address'
    || (payload.reason === 'ungeocoded' && dest?.kind === 'shop');
  const summary = [
    formatTripDistance(payload.distanceMeters || 0),
    formatTripDuration(payload.durationSeconds || 0),
  ].filter(Boolean).join(' · ');

  return (
    <section id="directions" style={{ marginTop: 16, background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(96,165,250,0.35)', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#93c5fd' }}>{say('Turn-by-turn')}</div>
          <h2 style={{ margin: '4px 0 0', fontSize: 18, color: '#f8fafc' }}>{dest ? say(dest.label) : say('Directions')}</h2>
          {dest?.address ? <p style={{ margin: '4px 0 0', color: '#cbd5e1', fontSize: 13 }}>{dest.address}</p> : null}
          <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: 12 }}>{say('Follow the steps on this screen. Starting directions does not change the job.')}</p>
        </div>
        <button
          type="button"
          onClick={start}
          disabled={busy || !startReady}
          style={{ background: '#e5332a', color: '#fff', border: 0, borderRadius: 8, padding: '10px 14px', fontWeight: 700, cursor: startReady ? 'pointer' : 'not-allowed', opacity: startReady ? 1 : 0.5 }}
        >
          {busy ? say('Starting…') : following ? say('Reroute') : say('Start turn-by-turn')}
        </button>
      </div>
      {shopSettings ? (
        <div style={{ marginTop: 10 }}>
          <p style={{ margin: 0, color: '#fcd34d', fontSize: 13 }}>
            {payload.reason === 'ungeocoded' ? (shopMapEmptyMessage('ungeocoded') || SHOP_ADDRESS_PROMPT) : SHOP_ADDRESS_PROMPT}
          </p>
          <a href={SHOP_ADDRESS_SETTINGS_HREF} style={{ display: 'inline-block', marginTop: 8, background: '#e5332a', color: '#fff', borderRadius: 8, padding: '8px 12px', fontWeight: 700, textDecoration: 'none' }}>
            {SHOP_ADDRESS_PROMPT}
          </a>
        </div>
      ) : payload.message ? <p style={{ margin: '10px 0 0', color: '#fcd34d', fontSize: 13 }}>{say(payload.message)}</p> : null}
      {error ? <p style={{ margin: '10px 0 0', color: '#fca5a5', fontSize: 13 }}>{say(error)}</p> : null}
      {summary && steps.length > 0 ? <p style={{ margin: '10px 0 0', color: '#e5e7eb', fontSize: 13, fontWeight: 700 }}>{summary}</p> : null}
      {offRoute && following ? (
        <p style={{ margin: '8px 0 0', color: '#fcd34d', fontSize: 13 }}>{say('You may be off the route. Choose Reroute to refresh the steps.')}</p>
      ) : null}
      {line.length > 1 ? (
        <div ref={mapNode} style={{ marginTop: 12, height: 220, borderRadius: 10, overflow: 'hidden', background: '#0b1220' }} />
      ) : null}
      {steps.length > 0 ? (
        <ol style={{ margin: '12px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
          {steps.map((step, index) => {
            const current = following && index === active;
            return (
              <li key={`${step.instruction}-${index}`} style={{ display: 'flex', gap: 10, padding: '8px 10px', borderRadius: 8, background: current ? 'rgba(229,51,42,0.18)' : 'rgba(255,255,255,0.04)', border: current ? '1px solid rgba(229,51,42,0.45)' : '1px solid transparent' }}>
                <span style={{ width: 22, height: 22, borderRadius: 999, background: current ? '#e5332a' : '#1e293b', color: '#fff', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{index + 1}</span>
                <span>
                  <span style={{ display: 'block', color: '#f8fafc', fontWeight: 700, fontSize: 14 }}>{step.instruction}</span>
                  <span style={{ display: 'block', color: '#94a3b8', fontSize: 12 }}>{formatTripDistance(step.distanceMeters)}</span>
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}
      {payload.external ? (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
          <a href={payload.external.google} target="_blank" rel="noreferrer" style={{ color: '#93c5fd', fontSize: 13, fontWeight: 700 }}>{say('Open driving directions in the browser')}</a>
          <a href={payload.external.apple} target="_blank" rel="noreferrer" style={{ color: '#93c5fd', fontSize: 13, fontWeight: 700 }}>{say('Apple Maps in the browser')}</a>
        </div>
      ) : null}
    </section>
  );
}
