import { describe, expect, it } from '@jest/globals';
import {
  acceptedShopContactPayload,
  canExposeShopContact,
  resolveShopContactEmail,
  shopContactMailto,
} from '../src/lib/shopContact';
import {
  OWNER_ADD_SHOP_HREF,
  OWNER_ADD_USER_HREF,
  manageShopsIdRedirect,
  shopDetailsBackTarget,
  shopDetailsHref,
  superadminMobileIsHome,
} from '../src/lib/ownerShell';

describe('accepted shop contact email', () => {
  it('uses the shop owner email for platform admins and omits it for everyone else', () => {
    const shop = { email: 'jose@audit.test', ownerName: 'Jose' };
    expect(canExposeShopContact('admin')).toBe(true);
    expect(canExposeShopContact('superadmin')).toBe(true);
    expect(canExposeShopContact('customer')).toBe(false);
    expect(acceptedShopContactPayload(shop, true)).toEqual({
      email: 'jose@audit.test',
      ownerName: 'Jose',
    });
    expect(acceptedShopContactPayload(shop, false)).toEqual({});
  });

  it('never builds a mailto link from a missing or undefined email', () => {
    expect(resolveShopContactEmail(undefined, null, 'undefined')).toBe('');
    expect(shopContactMailto(resolveShopContactEmail(undefined))).toBeNull();
    expect(resolveShopContactEmail('not-an-email', 'owner@shop.test')).toBe('owner@shop.test');
    expect(shopContactMailto('owner@shop.test')).toBe('mailto:owner@shop.test');
    expect(JSON.stringify({
      href: shopContactMailto(resolveShopContactEmail(undefined)),
    })).not.toContain('mailto:undefined');
  });
});

describe('owner shell routes', () => {
  it('renders analytics instead of the home tile grid', () => {
    expect(superadminMobileIsHome('/superadmin/analytics')).toBe(false);
    expect(superadminMobileIsHome('/superadmin/users')).toBe(false);
    expect(superadminMobileIsHome('/admin/home')).toBe(false);
  });

  it('opens create flows from the New menu', () => {
    expect(OWNER_ADD_SHOP_HREF).toBe('/admin/manage-shops/new');
    expect(OWNER_ADD_USER_HREF).toBe('/admin/user-management/new');
  });

  it('opens shop details from a manage-shops id and returns to shops', () => {
    const shopId = 'cmu39htty0005c3kp808c31h4';
    expect(manageShopsIdRedirect(null)).toBeNull();
    expect(manageShopsIdRedirect('  ')).toBeNull();
    expect(manageShopsIdRedirect(shopId)).toBe(shopDetailsHref(shopId, 'manage-shops'));
    expect(manageShopsIdRedirect(shopId)).toBe(
      `/admin/shop-details/${shopId}?from=manage-shops`,
    );
    expect(shopDetailsBackTarget('manage-shops')).toEqual({
      href: '/admin/manage-shops',
      label: 'Back to Manage Shops',
    });
  });

  it('sends shop details back to shops, not customers', () => {
    expect(shopDetailsBackTarget(null)).toEqual({
      href: '/admin/manage-shops',
      label: 'Back to Manage Shops',
    });
    expect(shopDetailsBackTarget('customers').href).toBe('/admin/manage-shops');
    expect(shopDetailsBackTarget('accepted')).toEqual({
      href: '/admin/accepted-shops',
      label: 'Back to Accepted Shops',
    });
    expect(shopDetailsBackTarget(undefined).href).not.toContain('manage-customers');
    expect(shopDetailsBackTarget('manage-shops').href).not.toContain('manage-customers');
  });
});
