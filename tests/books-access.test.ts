import { mobileNavForActor } from '../src/lib/mobileRoleNav';
import {
  booksAccess,
  isPlatformFeeYearAccount,
  isPlatformFeeYearPath,
  PLATFORM_FEE_YEAR_HREF,
  shopIdForBooks,
} from '../src/lib/books/access';
import { portalAccessDecision, renderedMenuHrefs } from '../src/lib/roleMenus';

describe('books access', () => {
  it('keeps the fee year-end page on the exact platform owner login', () => {
    expect(isPlatformFeeYearAccount('SupAdm1006')).toBe(true);
    expect(isPlatformFeeYearAccount('  SupAdm1006  ')).toBe(true);
    expect(isPlatformFeeYearAccount('supadm1006')).toBe(false);
    expect(isPlatformFeeYearAccount('SUPADM1006')).toBe(false);
    expect(isPlatformFeeYearPath('/admin/fee-year-end')).toBe(true);
    expect(isPlatformFeeYearPath('/admin/fee-year-end/export')).toBe(true);
    expect(booksAccess('superadmin', 'SupAdm1006').platformFeeYear).toBe(true);
    expect(booksAccess('shop', 'SupAdm1006').platformFeeYear).toBe(false);
    expect(booksAccess('customer', 'SupAdm1006').platformFeeYear).toBe(false);
    expect(booksAccess('superadmin', 'supadm1006').platformFeeYear).toBe(false);
  });

  it('gives shops and managers the ledger and techs only their clock', () => {
    expect(booksAccess('shop')).toMatchObject({ shopLedger: true, staffTotals: true, shopRevenue: true, quickBooks: true, quickBooksConnect: true, ownClock: true });
    expect(booksAccess('manager')).toMatchObject({ shopLedger: true, parts: true, shopRevenue: false, quickBooks: true, quickBooksConnect: false });
    expect(booksAccess('tech')).toMatchObject({ shopLedger: false, staffTotals: false, ownClock: true, platformFeeYear: false });
    expect(booksAccess('customer')).toMatchObject({ shopLedger: false, ownClock: false, platformFeeYear: false });
    expect(shopIdForBooks({ role: 'shop', id: 'shop-1' })).toBe('shop-1');
    expect(shopIdForBooks({ role: 'manager', id: 'mgr', shopId: 'shop-1' })).toBe('shop-1');
    expect(shopIdForBooks({ role: 'customer', id: 'c1' })).toBeNull();
  });

  it('puts books on shop menus and the fee year only on SupAdm1006', () => {
    expect(renderedMenuHrefs('shop', 'shop', false)).toContain('/shop/books');
    expect(renderedMenuHrefs('manager', 'manager', false)).toContain('/manager/books');
    expect(renderedMenuHrefs('tech', 'tech', false)).toContain('/tech/clocks');
    expect(renderedMenuHrefs('customer', 'customer', false)).not.toContain(PLATFORM_FEE_YEAR_HREF);
    expect(renderedMenuHrefs('shop', 'shop', false, 'SupAdm1006')).not.toContain(PLATFORM_FEE_YEAR_HREF);
    expect(renderedMenuHrefs('admin', 'superadmin', true, 'supadm1006')).not.toContain(PLATFORM_FEE_YEAR_HREF);
    expect(renderedMenuHrefs('admin', 'superadmin', true, 'SupAdm1006')).toContain(PLATFORM_FEE_YEAR_HREF);

    expect(portalAccessDecision('/shop/books', 'shop')).toBe('allow');
    expect(portalAccessDecision('/manager/books', 'manager')).toBe('allow');
    expect(portalAccessDecision('/tech/clocks', 'tech')).toBe('allow');
    expect(portalAccessDecision('/shop/books', 'customer')).toBe('home');
    expect(portalAccessDecision('/admin/fee-year-end', 'customer')).toBe('forbidden');
    expect(portalAccessDecision('/admin/fee-year-end', 'shop')).toBe('forbidden');
    expect(portalAccessDecision('/admin/fee-year-end', { role: 'superadmin', username: 'supadm1006' })).toBe('home');
    expect(portalAccessDecision('/admin/fee-year-end', { role: 'superadmin', username: 'SupAdm1006' })).toBe('allow');
    expect(portalAccessDecision('/shop/books', { role: 'superadmin', username: 'SupAdm1006' })).toBe('home');

    const ownerNav = mobileNavForActor('admin', { role: 'superadmin', username: 'SupAdm1006', isOwner: true });
    const otherNav = mobileNavForActor('admin', { role: 'superadmin', username: 'supadm1006', isOwner: true });
    const hrefs = (nav: typeof ownerNav) => nav?.more.flatMap((group) => group.items.map((item) => item.href)) || [];
    expect(hrefs(ownerNav)).toContain(PLATFORM_FEE_YEAR_HREF);
    expect(hrefs(otherNav)).not.toContain(PLATFORM_FEE_YEAR_HREF);
  });
});
