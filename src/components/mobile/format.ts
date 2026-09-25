export function money(value: number | string | null | undefined, digits = 0): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed === 'Unavailable') return digits > 0 ? '$0.00' : '$0';
    if (trimmed.startsWith('$')) return trimmed;
  }
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(n)) return digits > 0 ? '$0.00' : '$0';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function parseMoney(value: number | string | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const n = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function count(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '0';
}

export function firstName(name: string | null | undefined): string {
  const part = String(name || '').trim().split(/\s+/)[0];
  return part || 'there';
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '•';
}

export function vehicleLabel(record: {
  vehicleType?: string | null;
  vehicle?: { year?: number | string | null; make?: string | null; model?: string | null; vehicleType?: string | null } | null;
} | null | undefined): string {
  const vehicle = record?.vehicle;
  const named = [vehicle?.year, vehicle?.make, vehicle?.model].filter(Boolean).join(' ');
  return named || vehicle?.vehicleType || record?.vehicleType || 'Vehicle';
}
