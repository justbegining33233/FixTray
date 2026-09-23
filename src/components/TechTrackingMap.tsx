'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ShopOpsMap } from '@/lib/roadCallMap';
import { loadLeaflet, type LeafletLayerGroup, type LeafletMap } from '@/lib/loadLeaflet';

interface TechTrackingMapProps {
  shopId?: string;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; map: ShopOpsMap; stale?: boolean };

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char
  ));
}

function formatWhen(iso: string | null): string {
  if (!iso) return 'No timestamp';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'No timestamp';
  return date.toLocaleString();
}

export default function TechTrackingMap({ shopId = 'current' }: TechTrackingMapProps) {
  const say = usePhrase();
  const [data, setData] = useState<LoadState>({ status: 'loading' });
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<{ map: LeafletMap; layer: LeafletLayerGroup } | null>(null);
  const boundsKey = useRef('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/tech/tracking?shopId=${encodeURIComponent(shopId)}`, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || 'Could not load the shop map');
        }
        const payload = await response.json() as ShopOpsMap;
        if (cancelled) return;
        setData({ status: 'ready', map: payload });
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Could not load the shop map';
        setData((current) => (
          current.status === 'ready' ? { ...current, stale: true } : { status: 'error', message }
        ));
      }
    }

    load();
    const timer = window.setInterval(load, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [shopId]);

  const payload = data.status === 'ready' ? data.map : null;
  const markers = useMemo(() => markerList(payload), [payload]);
  const markerKey = markers.map((marker) => `${marker.key}:${marker.latitude}:${marker.longitude}`).join('|');
  const hasMap = markers.length > 0;

  useEffect(() => {
    if (!hasMap) {
      if (mapRef.current) {
        try { mapRef.current.map.remove(); } catch { /* already removed */ }
        mapRef.current = null;
        boundsKey.current = '';
      }
      return;
    }
    const el = mapElRef.current;
    if (!el) return;
    let cancelled = false;

    loadLeaflet().then((L) => {
      if (cancelled) return;
      const host = mapElRef.current;
      if (!host) return;
      if (!mapRef.current) {
        const map = L.map(host);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);
        const layer = L.layerGroup().addTo(map);
        mapRef.current = { map, layer };
      }
      drawMarkers(L, mapRef.current.map, mapRef.current.layer, markers, boundsKey);
      window.setTimeout(() => {
        try { mapRef.current?.map.invalidateSize(); } catch { /* container not visible yet */ }
      }, 150);
    }).catch(() => {
      if (!cancelled) {
        setData({ status: 'error', message: 'The map tiles could not be loaded.' });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [hasMap, markerKey, markers]);

  useEffect(() => () => {
    try { mapRef.current?.map.remove(); } catch { /* already removed */ }
    mapRef.current = null;
  }, []);

  const shop = payload?.shop;
  const techs = payload?.techs || [];
  const jobs = payload?.jobs || [];
  const locatedTechs = techs.filter((tech) => tech.latitude != null && tech.longitude != null);
  const unlocatedTechs = techs.filter((tech) => tech.latitude == null || tech.longitude == null);
  const unlocatedJobs = jobs.filter((job) => job.locationStatus !== 'pinned');

  return (
    <div data-testid="shop-ops-map" style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, color: '#e5e7eb', fontSize: 18 }}>{say('Technician Locations')}</h3>
          <p style={{ margin: '4px 0 0', color: '#9aa3b2', fontSize: 13 }}>{say('Real-time GPS tracking')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
          <Legend swatch="#e5332a" label="Shop" />
          <Legend swatch="#22c55e" label="Tech" />
          <Legend swatch="#f59e0b" label="Job" />
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {data.status === 'loading' && (
          <div style={{ minHeight: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9aa3b2' }}>
            {say('Loading map...')}
          </div>
        )}

        {data.status === 'error' && (
          <div data-testid="shop-ops-map-error" style={{ minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fca5a5', textAlign: 'center', padding: 16 }}>
            {data.message}
          </div>
        )}

        {payload && (
          <>
            {data.status === 'ready' && data.stale && (
              <p style={{ color: '#fbbf24', fontSize: 13, marginTop: 0 }}>Could not refresh. Showing the last map update.</p>
            )}

            <ShopStatus shop={shop} />

            {hasMap ? (
              <div
                ref={mapElRef}
                data-testid="shop-ops-map-canvas"
                style={{ height: 420, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}
              />
            ) : (
              <div data-testid="shop-ops-map-empty" style={{ minHeight: 180, borderRadius: 10, border: '1px dashed rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9aa3b2', textAlign: 'center', padding: 20 }}>
                {shop?.status === 'missing-address'
                  ? 'Add the shop street address in Shop Settings. No placeholder pin is shown.'
                  : shop?.status === 'ungeocoded'
                    ? 'The shop address is saved, but it could not be placed on the map. No placeholder pin is shown.'
                    : 'Nothing to pin yet.'}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginTop: 14 }}>
              <Panel title="Road-call technicians" testId="road-call-techs">
                {techs.length === 0 && <Muted>No active road calls. In-shop technicians are not tracked.</Muted>}
                {locatedTechs.map((tech) => (
                  <Row key={tech.id} testId="road-call-tech">
                    <strong style={{ color: '#e5e7eb' }}>{tech.name}</strong>
                    <span style={{ color: tech.locationStatus === 'live' ? '#22c55e' : '#fbbf24' }}>
                      {tech.locationStatus === 'live' ? 'Live' : 'Last known'} · {formatWhen(tech.lastUpdate)}
                    </span>
                    <span style={{ color: '#9aa3b2' }}>{tech.jobs.map((job) => job.label).join(', ')}</span>
                    {tech.phone && <a href={`tel:${tech.phone}`} style={{ color: '#67e8f9' }}>{tech.phone}</a>}
                  </Row>
                ))}
                {unlocatedTechs.map((tech) => (
                  <Row key={tech.id} testId="road-call-tech-unlocated">
                    <strong style={{ color: '#e5e7eb' }}>{tech.name}</strong>
                    <span style={{ color: '#fca5a5' }}>Location unavailable. Allow location sharing on an active road call.</span>
                    <span style={{ color: '#9aa3b2' }}>{tech.jobs.map((job) => job.label).join(', ')}</span>
                  </Row>
                ))}
              </Panel>

              <Panel title="Road-call stops" testId="road-call-jobs">
                {jobs.length === 0 && <Muted>{say('No active road calls')}</Muted>}
                {jobs.filter((job) => job.locationStatus === 'pinned').map((job) => (
                  <Row key={job.id} testId="road-call-job">
                    <strong style={{ color: '#e5e7eb' }}>{job.label}</strong>
                    <span style={{ color: '#9aa3b2' }}>{job.customerName}{job.address ? ` · ${job.address}` : ''}</span>
                    <span style={{ color: '#9aa3b2' }}>{job.assignedTechName || 'Unassigned'} · {job.status}</span>
                  </Row>
                ))}
                {unlocatedJobs.map((job) => (
                  <Row key={job.id} testId="road-call-job-unlocated">
                    <strong style={{ color: '#e5e7eb' }}>{job.label}</strong>
                    <span style={{ color: '#fca5a5' }}>
                      {job.locationStatus === 'ungeocoded'
                        ? `Address on file (${job.address}) could not be placed on the map.`
                        : 'Customer location is not set.'}
                    </span>
                  </Row>
                ))}
              </Panel>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ShopStatus({ shop }: { shop?: ShopOpsMap['shop'] }) {
  if (!shop) return null;
  if (shop.status === 'pinned') {
    return (
      <p data-testid="shop-pin-status" style={{ margin: '0 0 12px', color: '#e5e7eb', fontSize: 14 }}>
        <strong style={{ color: '#e5332a' }}>Shop</strong> · {shop.name}{shop.address ? ` · ${shop.address}` : ''}
      </p>
    );
  }
  if (shop.status === 'missing-address') {
    return (
      <p data-testid="shop-pin-status" style={{ margin: '0 0 12px', color: '#fca5a5', fontSize: 14 }}>
        Shop address is not set. Add a street, city, state, and ZIP in Shop Settings before the shop can be pinned.
      </p>
    );
  }
  return (
    <p data-testid="shop-pin-status" style={{ margin: '0 0 12px', color: '#fbbf24', fontSize: 14 }}>
      Shop address is on file ({shop.address}) but could not be placed on the map.
    </p>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#cbd5e1' }}>
      <span style={{ width: 10, height: 10, borderRadius: 99, background: swatch, display: 'inline-block' }} />
      {label}
    </span>
  );
}

function Panel({ title, testId, children }: { title: string; testId: string; children: ReactNode }) {
  return (
    <div data-testid={testId} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#e5e7eb', marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  );
}

function Row({ children, testId }: { children: ReactNode; testId: string }) {
  return (
    <div data-testid={testId} style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 13 }}>
      {children}
    </div>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <div style={{ color: '#9aa3b2', fontSize: 13 }}>{children}</div>;
}

type DrawnMarker = {
  key: string;
  latitude: number;
  longitude: number;
  kind: 'shop' | 'tech' | 'job';
  label: string;
  popup: string;
};

function markerList(payload: ShopOpsMap | null): DrawnMarker[] {
  if (!payload) return [];
  const markers: DrawnMarker[] = [];
  if (payload.shop.latitude != null && payload.shop.longitude != null) {
    markers.push({
      key: `shop:${payload.shop.id}`,
      latitude: payload.shop.latitude,
      longitude: payload.shop.longitude,
      kind: 'shop',
      label: 'Shop',
      popup: `<strong>Shop</strong><br/>${escapeHtml(payload.shop.name)}${payload.shop.address ? `<br/>${escapeHtml(payload.shop.address)}` : ''}`,
    });
  }
  for (const tech of payload.techs) {
    if (tech.latitude == null || tech.longitude == null) continue;
    const jobs = tech.jobs.map((job) => escapeHtml(job.label)).join('<br/>');
    markers.push({
      key: `tech:${tech.id}`,
      latitude: tech.latitude,
      longitude: tech.longitude,
      kind: 'tech',
      label: 'Tech',
      popup: `<strong>Tech · ${escapeHtml(tech.name)}</strong><br/>${tech.locationStatus === 'live' ? 'Live' : 'Last known'}${jobs ? `<br/>${jobs}` : ''}`,
    });
  }
  for (const job of payload.jobs) {
    if (job.latitude == null || job.longitude == null) continue;
    markers.push({
      key: `job:${job.id}`,
      latitude: job.latitude,
      longitude: job.longitude,
      kind: 'job',
      label: 'Job',
      popup: `<strong>Job · ${escapeHtml(job.label)}</strong><br/>${escapeHtml(job.customerName)}${job.address ? `<br/>${escapeHtml(job.address)}` : ''}`,
    });
  }
  return markers;
}

const PIN_COLOR = { shop: '#e5332a', tech: '#22c55e', job: '#f59e0b' };

function drawMarkers(
  L: Awaited<ReturnType<typeof loadLeaflet>>,
  map: LeafletMap,
  layer: LeafletLayerGroup,
  markers: DrawnMarker[],
  boundsKey: { current: string },
) {
  layer.clearLayers();
  const points: Array<[number, number]> = [];
  markers.forEach((marker) => {
    points.push([marker.latitude, marker.longitude]);
    const icon = L.divIcon({
      className: 'ft-ops-pin',
      html: `<div style="background:${PIN_COLOR[marker.kind]};color:white;font:700 11px/1 sans-serif;padding:4px 7px;border-radius:999px;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.45);white-space:nowrap;">${marker.label}</div>`,
      iconSize: [52, 24],
      iconAnchor: [26, 24],
    });
    L.marker([marker.latitude, marker.longitude], { icon, title: marker.label }).addTo(layer).bindPopup(marker.popup);
  });

  const key = markers.map((marker) => marker.key).join('|');
  if (key !== boundsKey.current) {
    boundsKey.current = key;
    if (points.length === 1) map.setView(points[0], 14);
    else if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 15 });
  }
  try { map.invalidateSize(); } catch { /* map still mounting */ }
}
