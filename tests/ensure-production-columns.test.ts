import { PRODUCTION_COLUMN_STATEMENTS } from '../src/lib/ensureProductionColumns';

describe('production column ensure', () => {
  const sql = PRODUCTION_COLUMN_STATEMENTS.join('\n');

  it('only adds columns and is safe to re-run', () => {
    for (const statement of PRODUCTION_COLUMN_STATEMENTS) {
      expect(statement.startsWith('ALTER TABLE ')).toBe(true);
      expect(statement).toContain('ADD COLUMN IF NOT EXISTS');
      expect(statement.toLowerCase()).not.toContain('drop ');
    }
  });

  it('covers the columns closeout, settings, catalog, and tax queries select', () => {
    expect(sql).toContain('"payment_links"');
    expect(sql).toContain('"customerName"');
    expect(sql).toContain('"shop_services"');
    expect(sql).toContain('"isActive"');
    expect(sql).toContain('"availableRoadside"');
    expect(sql).toContain('"shop_settings"');
    expect(sql).toContain('"require2FA"');
    expect(sql).toContain('"tax_rules"');
    expect(sql).toContain('"state"');
    expect(sql).toContain('"county"');
  });
});
