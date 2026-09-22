'use client';

import React, { useEffect, useRef } from 'react';
import { configureLeafletIcons } from '@/lib/leafletIcons';

interface Location { latitude: number; longitude: number; estimatedArrival?: string }

export default function TechLiveMap({ workOrderId, initialLocation, techName }: { workOrderId: string; initialLocation?: Location | null; techName?: string }) {
  const mapRef = useRef<any | null>(null);
  const markerRef = useRef<any | null>(null); // used for work-order/shop marker (shop stays fixed)
  const userMarkerRef = useRef<any | null>(null); // separate marker for sharing tech/user location
  const LRef = useRef<any | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Inject Leaflet CSS if missing
    if (!document.querySelector('#leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.crossOrigin = '';
      document.head.appendChild(link);
    }

    // Load Leaflet JS from CDN if not already present
    const ensureLeaflet = () => {
      return new Promise<void>((resolve, reject) => {
        if ((window as any).L) {
          LRef.current = (window as any).L;
          return resolve();
        }

        if (document.querySelector('#leaflet-js')) {
          (document.querySelector('#leaflet-js') as HTMLScriptElement).addEventListener('load', () => {
            LRef.current = (window as any).L;
            resolve();
          });
          return;
        }

        const script = document.createElement('script');
        script.id = 'leaflet-js';
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.async = true;
        script.defer = true;
        script.onload = () => {
          LRef.current = (window as any).L;
          resolve();
        };
        script.onerror = (e) => reject(e);
        document.body.appendChild(script);
      });
    };

    let mounted = true;

    // Initialize map and marker
    ensureLeaflet().then(() => {
      if (!mounted) return;
      const L = LRef.current;
      if (!L) return;
      configureLeafletIcons(L);

      const lat = initialLocation?.latitude ?? 39.9526;
      const lng = initialLocation?.longitude ?? -75.1652;

      const el = document.getElementById(`tech-map-${workOrderId}`);
      if (!el) return;

      // Force the map container to match its parent height (fixes flex sizing issues)
      try {
        const parent = el.parentElement as HTMLElement | null;
        if (parent) {
          const ph = parent.clientHeight;
          if (ph && ph > 0) el.style.height = ph + 'px';
        }
      } catch {}

      if (!mapRef.current) {
        const map = L.map(el).setView([lat, lng], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);
        mapRef.current = map;

        // Invalidate size multiple times to ensure Leaflet uses final container dimensions
        setTimeout(() => { try { map.invalidateSize(); } catch {} }, 100);
        setTimeout(() => { try { map.invalidateSize(); } catch {} }, 300);
        setTimeout(() => { try { map.invalidateSize(); } catch {} }, 600);

        // Observe container size changes and window resize to reflow Leaflet
        try {
          // ResizeObserver to handle layout changes
          const ro = new ResizeObserver(() => {
            try { map.invalidateSize(); } catch {}
          });
          ro.observe(el);
          // Save on element for cleanup
          (map as any).__resizeObserver = ro;

          const onResize = () => { try { map.invalidateSize(); } catch {} };
          window.addEventListener('resize', onResize);
          (map as any).__onResize = onResize;
        } catch {
          // ResizeObserver may not be available in some environments; ignore
        }
      } else {
        try { mapRef.current.setView([lat, lng], mapRef.current.getZoom()); } catch {}
      }

      if (initialLocation && initialLocation.latitude !== undefined) {
        // initialLocation represents the fixed map center for this map (shop or workorder origin)
        if (!markerRef.current) {
          markerRef.current = L.marker([initialLocation.latitude, initialLocation.longitude]).addTo(mapRef.current);
          if (techName) markerRef.current.bindPopup(techName).openPopup();
        } else {
          // keep the shop/workorder marker in place (do not overwrite with user location)
          try { markerRef.current.setLatLng([initialLocation.latitude, initialLocation.longitude]); } catch {}
        }
      }
    }).catch(() => {
    });

    // Handler for location updates; only update if workOrderId matches
    const handleUpdate = (e: any) => {
      try {
        const detail = e?.detail || e;
        if (!detail) return;
        if (detail.workOrderId && detail.workOrderId !== workOrderId) return;

        // If this is a "clear" for the shop map, only clear the user marker (do not remove the shop marker)
        if (detail.clear) {
          if (detail.workOrderId === 'shop-location') {
            if (userMarkerRef.current) {
              try { mapRef.current.removeLayer(userMarkerRef.current); } catch {}
              userMarkerRef.current = null;
            }
            return;
          }

          if (markerRef.current) {
            try { mapRef.current.removeLayer(markerRef.current); } catch {}
            markerRef.current = null;
          }
          return;
        }

        const loc = detail.location || detail;
        if (!loc || loc.latitude === undefined || loc.longitude === undefined) return;

        const lat = loc.latitude;
        const lng = loc.longitude;

        const L = LRef.current;
        if (!L) return;

        if (!mapRef.current) {
          const el = document.getElementById(`tech-map-${workOrderId}`);
          if (!el) return;

          // Ensure the map container has an explicit pixel height before creating the map
          try {
            const parent = el.parentElement as HTMLElement | null;
            if (parent) {
              const ph = parent.clientHeight;
              if (ph && ph > 0) el.style.height = ph + 'px';
            }
          } catch {}

          const map = L.map(el).setView([lat, lng], 13);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
          }).addTo(map);
          mapRef.current = map;

          // Wait a tick and invalidate size to ensure it expands to fill container
          setTimeout(() => { try { map.invalidateSize(); } catch {} }, 200);
        }

        // If this update is for the shop-location map (user sharing), use the user marker and DO NOT move the shop marker
        if (detail.workOrderId === 'shop-location') {
          if (!userMarkerRef.current) {
            userMarkerRef.current = L.marker([lat, lng], { title: 'You' }).addTo(mapRef.current);
            try { userMarkerRef.current.bindPopup('You').openPopup(); } catch {}
          } else {
            try { userMarkerRef.current.setLatLng([lat, lng]); } catch {}
          }
          // do not recenter the map  -  keep shop marker visible
          return;
        }

        // Default: update the main marker (work-order specific)
        if (!markerRef.current) {
          markerRef.current = L.marker([lat, lng]).addTo(mapRef.current);
          if (techName && markerRef.current.bindPopup) markerRef.current.bindPopup(techName).openPopup();
        } else {
          markerRef.current.setLatLng([lat, lng]);
        }

        // Center map smoothly for work-order updates
        try {
          mapRef.current.setView([lat, lng], mapRef.current.getZoom());
        } catch {}
      } catch {}
    };

    // Marker layer management (roadcall, parts, user)
    const markerLayersRef = new Map<string, any[]>();

    const routeLayerRef: any = { current: null };

    const clearRoute = () => {
      try {
        if (!mapRef.current) return;
        if (routeLayerRef.current) {
          try { mapRef.current.removeLayer(routeLayerRef.current); } catch {}
          routeLayerRef.current = null;
        }
      } catch {}
    };

    const drawRoute = (from: [number, number], to: [number, number]) => {
      try {
        const L = LRef.current;
        if (!L || !mapRef.current) return;

        clearRoute();
        const latlngs = [from, to];
        const poly = L.polyline(latlngs, { color: '#ef4444', weight: 4, opacity: 0.9, dashArray: '6,4' }).addTo(mapRef.current);
        routeLayerRef.current = poly;
        try { mapRef.current.fitBounds(poly.getBounds(), { padding: [40, 40] }); } catch {}

        // Estimate distance/ETA (straight-line) and show on popup at midpoint
        const toRad = (deg: number) => deg * Math.PI / 180;
        const R = 6371; // km
        const dLat = toRad(to[0] - from[0]);
        const dLon = toRad(to[1] - from[1]);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(from[0])) * Math.cos(toRad(to[0])) * Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distKm = R * c;
        const distMi = distKm * 0.621371;
        const avgMph = 30; // conservative estimate
        const etaMinutes = Math.round((distMi / avgMph) * 60);
        const mid = [(from[0]+to[0])/2, (from[1]+to[1])/2];
        L.popup({ closeButton: true, autoClose: true })
          .setLatLng(mid)
          .setContent(`<div style="font-weight:700;color:#111;padding:6px;">Route - ${distMi.toFixed(1)} mi - ETA ~ ${etaMinutes} min</div>`)
          .openOn(mapRef.current);
      } catch {}
    };

    const addMarkers = (type: string, markers: Array<{ latitude: number; longitude: number; title?: string; id?: string; popup?: string }>) => {
      try {
        const L = LRef.current;
        if (!L || !mapRef.current) return;
        const prev = markerLayersRef.get(type) || [];
        prev.forEach((m: any) => { try { mapRef.current.removeLayer(m); } catch {} });
        const added: any[] = [];
        markers.forEach((m) => {
          const mk = L.marker([m.latitude, m.longitude]).addTo(mapRef.current);
          // prefer explicit popup content when provided
          if (m.popup) mk.bindPopup(m.popup);
          else mk.bindPopup(m.title || type);

          // If these are roadcall markers, attach click handler to draw a route from the shop or user's marker
          if (type === 'roadcall') {
            mk.on('click', () => {
              try {
                // prefer user's current marker if present, otherwise use the initialLocation passed in (shop)
                let fromLatLng: any = null;
                if (markerRef.current && markerRef.current.getLatLng) {
                  fromLatLng = markerRef.current.getLatLng();
                } else if (initialLocation && initialLocation.latitude !== undefined) {
                  fromLatLng = { lat: initialLocation.latitude, lng: initialLocation.longitude };
                }
                if (fromLatLng) drawRoute([fromLatLng.lat, fromLatLng.lng], [m.latitude, m.longitude]);
                mk.openPopup();
              } catch (err) { console.error('Roadcall click handler error', err); }
            });
          }

          added.push(mk);
        });
        markerLayersRef.set(type, added);
      } catch {}
    };

    const clearMarkers = (type?: string) => {
      try {
        if (!mapRef.current) return;
        if (type) {
          const prev = markerLayersRef.get(type) || [];
          prev.forEach((m: any) => { try { mapRef.current.removeLayer(m); } catch {} });
          markerLayersRef.delete(type);
        } else {
          markerLayersRef.forEach((arr: any[]) => arr.forEach((m: any) => { try { mapRef.current.removeLayer(m); } catch {} }));
          markerLayersRef.clear();
        }
      } catch {}
    };

    const handleAddMarkersEvent = (e: any) => {
      const detail = e?.detail || e;
      if (!detail) return;
      const { type, markers } = detail;
      if (!type || !Array.isArray(markers)) return;
      addMarkers(type, markers);
    };

    const handleClearMarkersEvent = (e: any) => {
      const detail = e?.detail || e;
      if (!detail) return;
      const { type } = detail;
      clearMarkers(type);
    };

    window.addEventListener('map:add_markers', handleAddMarkersEvent as EventListener);
    window.addEventListener('map:clear_markers', handleClearMarkersEvent as EventListener);

    window.addEventListener('tech:location_updated', handleUpdate as EventListener);
    window.addEventListener('tech-location-updated', handleUpdate as EventListener);

    return () => {
      mounted = false;
      window.removeEventListener('map:add_markers', handleAddMarkersEvent as EventListener);
      window.removeEventListener('map:clear_markers', handleClearMarkersEvent as EventListener);
      window.removeEventListener('tech:location_updated', handleUpdate as EventListener);
      window.removeEventListener('tech-location-updated', handleUpdate as EventListener);

      // Disconnect any ResizeObserver and window resize listener attached to the map
      if (mapRef.current) {
        try {
          // clear marker layers
          const mapAny = mapRef.current as any;
          if (mapAny && mapAny.markerLayers) {
            try { mapAny.markerLayers.forEach((arr: any[]) => arr.forEach((m: any) => mapRef.current.removeLayer(m))); } catch {}
            try { mapAny.markerLayers.clear(); } catch {}
          }
        } catch {}
        try {
          const map = mapRef.current as any;
          if (map.__resizeObserver) {
            try { map.__resizeObserver.disconnect(); } catch {}
            map.__resizeObserver = null;
          }
          if (map.__onResize) {
            try { window.removeEventListener('resize', map.__onResize); } catch {}
            map.__onResize = null;
          }
        } catch {}

        try { mapRef.current.remove(); } catch {}
        mapRef.current = null;
      }

      // clean up both markers
      markerRef.current = null;
      userMarkerRef.current = null;
    };
  }, [workOrderId, initialLocation?.latitude, initialLocation?.longitude, techName]);

  return (
    <div style={{height:'100%', display:'flex'}}>
      <div id={`tech-map-${workOrderId}`} style={{flex:1, width:'100%', borderRadius:8, overflow:'hidden'}} />
    </div>
  );
}
