import fs from 'fs';
import { auditNavTargets } from '../scripts/audit-nav-targets';

it('writes disallowed in-app navigation targets', () => {
  const broken = auditNavTargets();
  const out = '/tmp/nav-audit.json';
  fs.writeFileSync(out, JSON.stringify(broken, null, 2));
  const unique = new Set(broken.map((row) => `${row.role} ${row.target} ${row.file}`));
  console.log(`broken ${broken.length} unique ${unique.size}`);
  expect(broken.length).toBeGreaterThanOrEqual(0);
});
