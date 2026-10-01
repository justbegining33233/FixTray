import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from '@jest/globals';
import { buildEstimateSave } from '../src/lib/estimateAuthorization';
import {
  inventorySearchMatches,
  partsPickerRows,
  partsPickerShopId,
  quantityAfterUse,
  stockDeltasForPartUse,
  usageQuantityFromOrders,
} from '../src/lib/partStockUse';

const auditPart = {
  id: 'part-r7k2',
  name: 'AUDIT TEST PART r7k2',
  sku: 'r7k2',
  quantity: 1,
  price: 1,
  type: 'part',
};

describe('work order parts picker and stock use', () => {
  it('lists the owner inventory part when searching its name or SKU', () => {
    const rows = partsPickerRows({ inventory: [auditPart], items: [] });
    expect(rows).toHaveLength(1);
    expect(rows.filter((row) => inventorySearchMatches(row, 'AUDIT TEST PART'))).toEqual(rows);
    expect(rows.filter((row) => inventorySearchMatches(row, 'r7k2'))).toEqual(rows);
    expect(partsPickerRows({ items: [] })).toHaveLength(0);
  });

  it('uses the work order shop, not a stored id from another shop', () => {
    expect(partsPickerShopId({
      workOrderShopId: 'audit-shop-jose',
      role: 'shop',
      storedShopId: 'other-shop',
    })).toBe('audit-shop-jose');
  });

  it('reduces on-hand quantity only for a line linked to that inventory row', () => {
    const linked = buildEstimateSave([{
      description: auditPart.name,
      quantity: 1,
      unitPrice: 1,
      kind: 'part',
      partNumber: auditPart.sku,
      inventoryItemId: auditPart.id,
    }]);
    const custom = buildEstimateSave([{
      description: 'Custom hose',
      quantity: 1,
      unitPrice: 1,
      kind: 'part',
    }]);

    expect(linked.partsUsed).toEqual([
      expect.objectContaining({ name: auditPart.name, quantity: 1, sku: 'r7k2', inventoryItemId: 'part-r7k2' }),
    ]);
    expect(custom.partsUsed[0]).not.toHaveProperty('inventoryItemId');

    const firstUse = stockDeltasForPartUse([], linked.partsUsed);
    expect(firstUse).toEqual([{ inventoryItemId: 'part-r7k2', delta: 1 }]);
    expect(quantityAfterUse(1, firstUse[0].delta)).toBe(0);
    expect(stockDeltasForPartUse(linked.partsUsed, linked.partsUsed)).toEqual([]);
    expect(stockDeltasForPartUse([], custom.partsUsed)).toEqual([]);
  });

  it('counts a linked part toward Parts Used before the job is closed', () => {
    expect(usageQuantityFromOrders([
      { status: 'in-progress', partsUsed: [{ name: 'AUDIT TEST PART r7k2', quantity: 1, inventoryItemId: 'part-r7k2' }] },
      { status: 'in-progress', partsUsed: [{ name: 'Custom hose', quantity: 1 }] },
    ])).toBe(1);
  });

  it('reads the owner inventory payload on the work order page', () => {
    const source = readFileSync(join(__dirname, '../src/app/workorders/[id]/page.tsx'), 'utf8');
    expect(source).toContain('partsPickerRows');
    expect(source).toContain('partsPickerShopId');
    expect(source).not.toContain('d.items');
    const route = readFileSync(join(__dirname, '../src/app/api/workorders/[id]/route.ts'), 'utf8');
    expect(route).toContain('stockDeltasForPartUse');
    expect(route).not.toContain('part?.sku');
  });
});
