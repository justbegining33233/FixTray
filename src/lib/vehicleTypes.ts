export const VEHICLE_TYPE_OPTIONS = [
  { value: 'personal-vehicle', label: 'Personal Vehicle' },
  { value: 'semi-truck', label: 'Semi Truck' },
  { value: 'trailer', label: 'Trailer' },
  { value: 'equipment', label: 'Equipment' },
] as const;

const ALIASES: Record<string, string> = {
  car: 'personal-vehicle',
  personal: 'personal-vehicle',
  'personal vehicle': 'personal-vehicle',
  'personal-vehicle': 'personal-vehicle',
  truck: 'semi-truck',
  'semi truck': 'semi-truck',
  'semi-truck': 'semi-truck',
  trailer: 'trailer',
  equipment: 'equipment',
};

export const DEFAULT_VEHICLE_TYPE = 'personal-vehicle';

export function normalizeVehicleType(value: unknown): string {
  const key = String(value ?? '').trim().toLowerCase();
  if (!key) return DEFAULT_VEHICLE_TYPE;
  return ALIASES[key] || DEFAULT_VEHICLE_TYPE;
}

export function vehicleTypeLabel(value: unknown): string {
  const normalized = normalizeVehicleType(value);
  return VEHICLE_TYPE_OPTIONS.find((option) => option.value === normalized)?.label || 'Personal Vehicle';
}
