const CATEGORY_LABELS: Record<string, string> = {
  gas: 'Gas',
  diesel: 'Diesel',
  'small-engine': 'Small engine',
  'heavy-equipment': 'Heavy equipment',
  resurfacing: 'Resurfacing',
  welding: 'Welding',
  tire: 'Tire',
  maintenance: 'Maintenance',
  repair: 'Repair',
  diagnostic: 'Diagnostic',
  diagnostics: 'Diagnostics',
};

/** Turn stored category keys into readable labels. Hide empty or duplicated names. */
export function serviceCategoryLabel(category: unknown, serviceName?: unknown): string {
  const raw = typeof category === 'string' ? category.trim() : '';
  if (!raw) return '';
  const name = typeof serviceName === 'string' ? serviceName.trim().toLowerCase() : '';
  if (name && raw.toLowerCase() === name) return '';
  const mapped = CATEGORY_LABELS[raw.toLowerCase()];
  if (mapped) return mapped;
  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
