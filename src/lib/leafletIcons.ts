export const LEAFLET_ICON_URLS = {
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
};

/** Leaflet's default icon URLs resolve against the page origin and 404. Point them at the CDN assets. */
export function configureLeafletIcons(leaflet: {
  Icon?: { Default?: { prototype?: { _getIconUrl?: unknown }; mergeOptions?: (options: typeof LEAFLET_ICON_URLS) => void } };
} | null | undefined) {
  const defaults = leaflet?.Icon?.Default;
  if (!defaults?.mergeOptions) return;
  if (defaults.prototype) delete defaults.prototype._getIconUrl;
  defaults.mergeOptions(LEAFLET_ICON_URLS);
}
