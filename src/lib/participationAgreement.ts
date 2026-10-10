export const SETTINGS_PROMPT = 'Please complete these in settings';

export type AgreementShop = {
  shopName?: string | null;
  entityType?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  email?: string | null;
  signedBy?: string | null;
  signedAt?: string | null;
  dateLabel?: string | null;
};

function filled(value: string | null | undefined, label: string, missing: string[]): string {
  const trimmed = String(value || '').trim();
  if (trimmed) return trimmed;
  missing.push(label);
  return SETTINGS_PROMPT;
}

/** Fill shop placeholders from saved settings. FixTray has no public street address, so its party line is not given a made-up one. */
export function renderParticipationAgreement(template: string, shop: AgreementShop): { text: string; missing: string[] } {
  const missing: string[] = [];
  const address = [shop.address, shop.city, shop.state, shop.zipCode]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ');
  let text = template.replace(
    'FixTray, Inc., a [STATE] corporation with a principal place of business at [ADDRESS] (FixTray)',
    'FixTray, Inc. (FixTray)',
  );
  const replacements: Array<[string, string]> = [
    ['[DATE]', shop.dateLabel || new Date().toLocaleDateString()],
    ['[LEGAL SHOP NAME]', filled(shop.shopName, 'legal shop name', missing)],
    ['[SHOP_LEGAL_NAME]', filled(shop.shopName, 'legal shop name', missing)],
    ['[ENTITY TYPE]', filled(shop.entityType, 'entity type', missing)],
    ['[STATE/COUNTRY]', filled(shop.state, 'state', missing)],
    ['[ADDRESS]', address || filled('', 'shop address', missing)],
    ['[SHOP_ADMIN_FULL_NAME]', filled(shop.signedBy, 'signature', missing)],
    ['[SHOP_ADMIN_EMAIL]', filled(shop.email, 'email', missing)],
    ['[SHOP_ADMIN_ESIGN_UTC]', shop.signedAt || SETTINGS_PROMPT],
  ];
  for (const [token, value] of replacements) {
    text = text.split(token).join(value);
  }
  text = text.replace(/\[(STATE|ADDRESS|ENTITY TYPE|STATE\/COUNTRY)\]/g, SETTINGS_PROMPT);
  return { text, missing: [...new Set(missing)] };
}
