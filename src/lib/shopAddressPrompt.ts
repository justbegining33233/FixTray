export const SHOP_ADDRESS_SETTINGS_HREF = '/shop/settings?tab=general#shop-address';
export const SHOP_ADDRESS_PROMPT = 'Add your shop address in Settings';

export function shopMapEmptyMessage(status: 'missing-address' | 'ungeocoded' | 'pinned' | string | null | undefined): string | null {
  if (status === 'missing-address') return SHOP_ADDRESS_PROMPT;
  if (status === 'ungeocoded') return 'The shop address is saved, but it could not be placed on the map. Update it in Settings.';
  return null;
}
