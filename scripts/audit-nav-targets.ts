/**
 * One-off sweep: every in-app navigation literal vs the role that can see the file.
 * Run: npx jest scripts/audit-nav-targets.ts --watchAll=false
 * (jest testMatch is tests/ only — invoked via ts-jest from a tiny test instead)
 */
import fs from 'fs';
import path from 'path';
import { canOpenMenuPath, menuRoleFor, portalAccessDecision, type MenuRole } from '../src/lib/roleMenus';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');

const SKIP_DIR = new Set(['node_modules', 'api', '.next']);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const HREF_RE = /(?:href|to)\s*=\s*(?:\{[^}]*?)?['"`](\/[^'"`\s?#]+)(?:\?[^'"`\s]*)?['"`]/g;
const PUSH_RE = /(?:router|window\.location)\.(?:push|replace|assign|href)\s*(?:=|\()\s*['"`](\/[^'"`\s?#]+)/g;
const REDIRECT_RE = /\bredirect\(\s*['"`](\/[^'"`\s?#]+)/g;
const LOC_RE = /window\.location(?:\.href)?\s*=\s*['"`](\/[^'"`\s?#]+)/g;
const ROUTE_LIT_RE = /(?:href|route|destination|path)\s*:\s*['"`](\/[^'"`\s?#]+)/g;

function extract(source: string): { target: string; line: number }[] {
  const found: { target: string; line: number }[] = [];
  const lines = source.split('\n');
  lines.forEach((line, index) => {
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
    const patterns = [HREF_RE, PUSH_RE, REDIRECT_RE, LOC_RE, ROUTE_LIT_RE];
    for (const re of patterns) {
      re.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = re.exec(line))) {
        const target = match[1];
        if (target.startsWith('/api/') || target.startsWith('/_next')) continue;
        found.push({ target, line: index + 1 });
      }
    }
  });
  return found;
}

function fileRoles(rel: string): MenuRole[] {
  if (rel.startsWith('src/app/shop/')) return ['shop'];
  if (rel.startsWith('src/app/manager/')) return ['manager'];
  if (rel.startsWith('src/app/tech/')) return ['tech'];
  if (rel.startsWith('src/app/customer/')) return ['customer'];
  if (rel.startsWith('src/app/admin/') || rel.startsWith('src/app/superadmin/')) return ['superadmin'];
  if (rel.startsWith('src/app/workorders/')) return ['shop', 'manager', 'tech'];
  if (rel.includes('ShopPhone')) return ['shop'];
  if (rel.includes('ManagerPhone')) return ['manager'];
  if (rel.includes('TechPhone')) return ['tech'];
  if (rel.includes('CustomerPhone')) return ['customer'];
  if (rel.includes('AdminPhone')) return ['superadmin'];
  if (rel.includes('WorkOrderPhone')) return ['shop', 'manager', 'tech', 'customer'];
  return [];
}

function decision(role: MenuRole, target: string): string {
  const actor = role === 'superadmin' ? 'superadmin' : role;
  return portalAccessDecision(target, actor);
}

export function auditNavTargets(): { role: string; file: string; line: number; target: string; decision: string }[] {
  const files = walk(SRC);
  const broken: { role: string; file: string; line: number; target: string; decision: string }[] = [];
  for (const file of files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    if (rel.startsWith('src/lib/roleMenus') || rel.startsWith('src/lib/mobileRoleNav')) continue;
    const roles = fileRoles(rel);
    if (roles.length === 0) continue;
    const source = fs.readFileSync(file, 'utf8');
    for (const hit of extract(source)) {
      for (const role of roles) {
        const result = decision(role, hit.target);
        if (result === 'allow' || result === 'skip') continue;
        if (!menuRoleFor(role)) continue;
        if (canOpenMenuPath(role, hit.target) && result !== 'forbidden') continue;
        broken.push({ role, file: rel, line: hit.line, target: hit.target, decision: result });
      }
    }
  }
  return broken;
}
