const STATE_NAMES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO',
  montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH',
  oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
};

/** Two-letter code when we recognize the shop address state. Never invents NY. */
export function shopStateCode(state?: string | null): string {
  const raw = String(state ?? '').trim();
  if (!raw) return '';
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  return STATE_NAMES[raw.toLowerCase()] || raw;
}

export function defaultTaxRuleDraft(shop?: { state?: string | null; city?: string | null } | null) {
  const state = shopStateCode(shop?.state);
  return {
    name: state ? `${state} Sales Tax` : '',
    rate: '',
    state,
    county: '',
    appliesToParts: true,
    appliesToLabor: true,
    appliesToFees: false,
    isDefault: false,
    isActive: true,
  };
}
