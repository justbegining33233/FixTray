const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&#160;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

/** Turn HTML entities that leaked into a label into real characters. */
export function decodeStatusText(value: string): string {
  return value
    .replace(/&nbsp;|&#160;|&amp;|&lt;|&gt;|&quot;|&#39;/g, (entity) => ENTITIES[entity] || '')
    .replace(/\s+/g, ' ')
    .trim();
}

const LABELS: Record<string, string> = {
  pending: 'Pending',
  assigned: 'Assigned',
  'in-progress': 'In Progress',
  'en-route': 'En Route',
  'waiting-estimate': 'Waiting Estimate',
  'estimate-submitted': 'Estimate Submitted',
  'waiting-for-payment': 'Waiting for Payment',
  completed: 'Completed',
  closed: 'Closed',
  cancelled: 'Cancelled',
  canceled: 'Cancelled',
  'denied-estimate': 'Denied Estimate',
  paid: 'Paid',
};

const TONES: Record<string, { bg: string; color: string }> = {
  pending: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
  assigned: { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
  'in-progress': { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
  'en-route': { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
  'waiting-estimate': { bg: 'rgba(139,92,246,0.15)', color: '#a78bfa' },
  'estimate-submitted': { bg: 'rgba(96,165,250,0.15)', color: '#60a5fa' },
  'waiting-for-payment': { bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
  completed: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
  closed: { bg: 'rgba(107,114,128,0.15)', color: '#9ca3af' },
  cancelled: { bg: 'rgba(107,114,128,0.15)', color: '#9ca3af' },
  canceled: { bg: 'rgba(107,114,128,0.15)', color: '#9ca3af' },
  'denied-estimate': { bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
  paid: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
};

function statusKey(status: string | null | undefined): string {
  return decodeStatusText(String(status || '').trim().toLowerCase());
}

/** English label for a work-order status. Pass it through say() for i18n. */
export function workOrderStatusLabel(status: string | null | undefined): string {
  const key = statusKey(status);
  if (LABELS[key]) return LABELS[key];
  const titled = key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  return titled || 'Pending';
}

export function workOrderStatusTone(status: string | null | undefined): { bg: string; color: string } {
  return TONES[statusKey(status)] || TONES.pending;
}
