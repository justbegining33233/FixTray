import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import { inventoryRowsFromPayload, isShopInventoryLowStock } from '../src/lib/inventoryItem';
import { shopIdForStaffInventory } from '../src/lib/shopAccess';

const ownerStock = {
  inventory: [
    { id: 'oil', name: 'Oil filter', type: 'part', sku: 'OF-1', quantity: 1, price: 12, reorderPoint: 3, supplier: 'NAPA' },
    { id: 'pads', name: 'Brake pads', type: 'part', sku: 'BP-2', quantity: 8, price: 40, reorderPoint: 2, supplier: 'NAPA' },
  ],
};

describe('manager inventory uses the shop owner stock list', () => {
  it('returns the same items the owner page loads, including the low-stock item', () => {
    const rows = inventoryRowsFromPayload(ownerStock);
    expect(rows.map((row) => row.name)).toEqual(['Oil filter', 'Brake pads']);
    const low = rows.filter(isShopInventoryLowStock);
    expect(low).toHaveLength(1);
    expect(low[0].name).toBe('Oil filter');
  });

  it('does not replace the owner list with an empty inventory-stock payload', () => {
    const rows = inventoryRowsFromPayload({ inventory: ownerStock.inventory, items: [] });
    expect(rows).toHaveLength(2);
    expect(inventoryRowsFromPayload({ items: [] })).toHaveLength(0);
  });

  it('keeps a reorder point of zero from counting as low stock', () => {
    expect(isShopInventoryLowStock({ quantity: 0, reorderPoint: 0 })).toBe(false);
    expect(isShopInventoryLowStock({ quantity: 4, reorderPoint: null })).toBe(false);
    expect(isShopInventoryLowStock({ quantity: 3, reorderPoint: 3 })).toBe(true);
  });

  it('uses the manager token shop when a stored shop id points somewhere else', () => {
    expect(shopIdForStaffInventory({
      role: 'manager',
      tokenShopId: 'audit-shop-jose',
      storedShopId: 'other-shop',
    })).toBe('audit-shop-jose');
    expect(shopIdForStaffInventory({
      role: 'manager',
      tokenShopId: null,
      storedShopId: 'audit-shop-jose',
    })).toBe('audit-shop-jose');
    expect(shopIdForStaffInventory({
      role: 'shop',
      tokenShopId: 'token-shop',
      storedShopId: 'stored-shop',
    })).toBe('stored-shop');
  });

  it('loads manager inventory from the same API as the shop owner page', () => {
    const root = process.cwd();
    const manager = fs.readFileSync(path.join(root, 'src/app/manager/inventory/page.tsx'), 'utf8');
    const shop = fs.readFileSync(path.join(root, 'src/app/shop/inventory/page.tsx'), 'utf8');
    expect(shop).toContain('/api/inventory?shopId=');
    expect(manager).toContain('/api/inventory?shopId=');
    expect(manager).toContain('/api/inventory/${');
    expect(manager).not.toContain('inventory-stock');
  });
});
