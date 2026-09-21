function asText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function clip(value: string, max = 80): string {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export function shortWorkOrderLabel(id?: string | null): string {
  const raw = asText(id);
  if (!raw) return '';
  return `WO-${raw.slice(-8).toUpperCase()}`;
}

/** Pull a human service name. Never invent the word "Service" when nothing was stored. */
export function workOrderServiceName(input: {
  serviceType?: unknown;
  issueDescription?: unknown;
}): string {
  if (Array.isArray(input.serviceType)) {
    const joined = input.serviceType.map(asText).filter((part) => part && part.toLowerCase() !== 'service').join(', ');
    if (joined) return clip(joined);
  }
  const direct = asText(input.serviceType);
  if (direct && direct.toLowerCase() !== 'service') return clip(direct);

  const issue = input.issueDescription;
  if (typeof issue === 'string') {
    const text = issue.trim();
    if (text && text.toLowerCase() !== 'service') return clip(text);
    return '';
  }
  if (issue && typeof issue === 'object') {
    const record = issue as Record<string, unknown>;
    const nested = asText(record.serviceType) || asText(record.service) || asText(record.symptoms) || asText(record.description);
    if (nested && nested.toLowerCase() !== 'service') return clip(nested);
  }
  return '';
}

export function workOrderNotificationCopy(input: {
  id?: string | null;
  serviceType?: unknown;
  issueDescription?: unknown;
  customerName?: string | null;
  vehicle?: string | null;
  status?: string | null;
  kind?: 'created' | 'status';
}): { title: string; body: string } {
  const label = shortWorkOrderLabel(input.id);
  const service = workOrderServiceName(input);
  const kind = input.kind || 'created';
  const who = asText(input.customerName);
  const vehicle = asText(input.vehicle);

  let title: string;
  if (kind === 'status') {
    const status = asText(input.status).replace(/-/g, ' ');
    const head = label ? `Work order ${label}` : 'Work order';
    title = status ? `${head} is now ${status}` : `${head} updated`;
    if (service) title = `${title}: ${service}`;
  } else if (label && service) {
    title = `New work order ${label}: ${service}`;
  } else if (label) {
    title = `New work order ${label}`;
  } else if (service) {
    title = `New work order: ${service}`;
  } else {
    title = 'New work order';
  }

  const bodyParts = [who, vehicle].filter(Boolean);
  const body = bodyParts.length > 0
    ? bodyParts.join(' — ')
    : (service ? service : (label ? `Open ${label} for details` : 'Open the work order for details'));

  return { title, body };
}
