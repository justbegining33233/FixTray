/** Same count and value the shop inventory page shows: quantity times price. */
export function inventoryPageTotals(items: Array<{ quantity?: number | null; price?: number | null }>): {
  totalItems: number;
  totalInventoryValue: number;
} {
  const totalItems = items.length;
  const totalInventoryValue = Number(
    items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.price) || 0), 0).toFixed(2),
  );
  return { totalItems, totalInventoryValue };
}
