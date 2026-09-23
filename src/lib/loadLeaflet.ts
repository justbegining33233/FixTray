import { configureLeafletIcons } from '@/lib/leafletIcons';

type LeafletGlobal = {
  map: (el: HTMLElement, options?: Record<string, unknown>) => LeafletMap;
  tileLayer: (url: string, options?: Record<string, unknown>) => { addTo: (map: LeafletMap) => void };
  layerGroup: () => LeafletLayerGroup;
  divIcon: (options: Record<string, unknown>) => unknown;
  latLngBounds: (points: Array<[number, number]>) => unknown;
  marker: (latlng: [number, number], options?: Record<string, unknown>) => LeafletMarker;
};

type LeafletMap = {
  setView: (latlng: [number, number], zoom: number) => void;
  fitBounds: (bounds: unknown, options?: Record<string, unknown>) => void;
  invalidateSize: () => void;
  remove: () => void;
};

type LeafletMarker = {
  addTo: (layer: LeafletLayerGroup) => LeafletMarker;
  bindPopup: (html: string) => LeafletMarker;
  on: (event: string, handler: () => void) => void;
  openPopup: () => void;
};

type LeafletLayerGroup = {
  addTo: (map: LeafletMap) => LeafletLayerGroup;
  clearLayers: () => void;
  addLayer: (marker: LeafletMarker) => void;
};

function ensureStylesheet() {
  if (document.querySelector('#leaflet-css')) return;
  const link = document.createElement('link');
  link.id = 'leaflet-css';
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  link.crossOrigin = '';
  document.head.appendChild(link);
  if (!document.querySelector('#ft-ops-pin-style')) {
    const style = document.createElement('style');
    style.id = 'ft-ops-pin-style';
    style.textContent = '.ft-ops-pin{background:transparent;border:none;}';
    document.head.appendChild(style);
  }
}

/** Leaflet is already loaded from the CDN elsewhere in the app. Share that script. */
export function loadLeaflet(): Promise<LeafletGlobal> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Leaflet requires a browser'));
  ensureStylesheet();
  const existing = (window as unknown as { L?: LeafletGlobal }).L;
  if (existing) {
    configureLeafletIcons(existing as never);
    return Promise.resolve(existing);
  }

  return new Promise((resolve, reject) => {
    const finish = () => {
      const L = (window as unknown as { L?: LeafletGlobal }).L;
      if (!L) {
        reject(new Error('Leaflet failed to load'));
        return;
      }
      configureLeafletIcons(L as never);
      resolve(L);
    };
    const prior = document.querySelector('#leaflet-js') as HTMLScriptElement | null;
    if (prior) {
      prior.addEventListener('load', finish);
      return;
    }
    const script = document.createElement('script');
    script.id = 'leaflet-js';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = finish;
    script.onerror = () => reject(new Error('Leaflet failed to load'));
    document.body.appendChild(script);
  });
}

export type { LeafletGlobal, LeafletMap, LeafletLayerGroup, LeafletMarker };
