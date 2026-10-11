export const SETTINGS_PROMPT = 'Please complete these in settings';

/**
 * The signed agreement names the fee by the platform fee schedule.
 * PlatformConfig.serviceFee is a net amount in cents and is not printed here.
 * Weekly billing follows the Monday fee invoice already used for in-person fees.
 */
export const FEE_SCHEDULE_REFERENCE =
  'the per-work-order FixTray service fee stated in the FixTray platform fee schedule';

export const AGREEMENT_PLACEHOLDER = /\[[A-Z_]+\]/;

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
  /** Shop owner / shop admin title from settings. Blank becomes Owner. */
  ownerTitle?: string | null;
};

function filled(value: string | null | undefined, label: string, missing: string[]): string {
  const trimmed = String(value || '').trim();
  if (trimmed) return trimmed;
  missing.push(label);
  return SETTINGS_PROMPT;
}

function shopAddress(shop: AgreementShop): string {
  return [shop.address, shop.city, shop.state, shop.zipCode]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ');
}

/** Fill shop placeholders from saved settings. FixTray has no public street address, so its party line is not given a made-up one. */
export function renderParticipationAgreement(template: string, shop: AgreementShop): { text: string; missing: string[] } {
  const missing: string[] = [];
  const address = shopAddress(shop);
  const state = filled(shop.state, 'state', missing);
  const noticeAddress = address || filled('', 'shop address', missing);
  const title = String(shop.ownerTitle || '').trim() || (String(shop.shopName || '').trim() ? 'Owner' : filled('', 'owner title', missing));
  let text = template.replace(
    'FixTray, Inc., a [STATE] corporation with a principal place of business at [ADDRESS] (FixTray)',
    'FixTray, Inc. (FixTray)',
  );
  const replacements: Array<[string, string]> = [
    ['[DATE]', shop.dateLabel || new Date().toLocaleDateString()],
    ['[LEGAL SHOP NAME]', filled(shop.shopName, 'legal shop name', missing)],
    ['[SHOP_LEGAL_NAME]', filled(shop.shopName, 'legal shop name', missing)],
    ['[ENTITY TYPE]', filled(shop.entityType, 'entity type', missing)],
    ['[STATE/COUNTRY]', state],
    ['[ADDRESS]', noticeAddress],
    ['[GOVERNING_STATE]', state],
    ['[VENUE_COUNTY_STATE]', state === SETTINGS_PROMPT ? SETTINGS_PROMPT : `the state courts of ${state}`],
    ['[ARBITRATION_FORUM]', 'the forum named in the FixTray platform policies'],
    ['[ARBITRATION_CITY_STATE]', state === SETTINGS_PROMPT ? SETTINGS_PROMPT : state],
    ['[FIXTRAY_NOTICE_ADDRESS]', 'FixTray, Inc., as published at fixtray.app'],
    ['[FIXTRAY_LEGAL_EMAIL]', 'support@fixtray.app'],
    ['[SHOP_NOTICE_ADDRESS]', noticeAddress],
    ['[SHOP_NOTICE_CONTACT_TITLE]', title],
    ['[SHOP_LEGAL_EMAIL]', filled(shop.email, 'email', missing)],
    ['[SHOP_ADMIN_FULL_NAME]', filled(shop.signedBy, 'signature', missing)],
    ['[SHOP_ADMIN_EMAIL]', filled(shop.email, 'email', missing)],
    ['[SHOP_ADMIN_TITLE]', title],
    ['[SHOP_ADMIN_ESIGN_UTC]', shop.signedAt || SETTINGS_PROMPT],
    ['[SHOP_ADMIN_ESIGN_IP]', 'recorded by FixTray at signing'],
    ['[X]', 'Yes'],
    ['$[AMOUNT]', FEE_SCHEDULE_REFERENCE],
    ['[BILLING_FREQUENCY]', 'Weekly'],
    ['[PAYMENT_DUE_DAYS]', 'the period in the FixTray platform fee schedule'],
    ['[INVOICE_DISPUTE_WINDOW_DAYS]', 'the window in the FixTray platform fee schedule'],
  ];
  for (const [token, value] of replacements) {
    text = text.split(token).join(value);
  }
  text = text.replace(
    /Payment Due: the period in the FixTray platform fee schedule days from invoice/,
    'Payment Due: as stated in the FixTray platform fee schedule',
  );
  text = text.replace(
    /Dispute Window on Invoices: the window in the FixTray platform fee schedule days/,
    'Dispute Window on Invoices: as stated in the FixTray platform fee schedule',
  );
  text = text.replace(/\[(STATE|ADDRESS|ENTITY TYPE|STATE\/COUNTRY)\]/g, SETTINGS_PROMPT);
  text = text.replace(/\[[A-Z_]+\]/g, SETTINGS_PROMPT);
  return { text, missing: [...new Set(missing)] };
}
