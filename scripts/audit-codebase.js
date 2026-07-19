#!/usr/bin/env node
/**
 * audit-codebase.js
 * Unified audit utility for codebase quality and consistency checks.
 * 
 * Usage:
 *   node scripts/audit-codebase.js syntax      # Check role-check syntax
 *   node scripts/audit-codebase.js quality     # Score UI quality across roles
 *   node scripts/audit-codebase.js all         # Run all audits
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const mode = args[0] || 'all';

// ─── Syntax Audit ─────────────────────────────────────────────────────────

function auditSyntax() {
  console.log('\n🔍 SYNTAX AUDIT: Checking role-check syntax...\n');
  
  function walk(dir) {
    let out = [];
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (fs.statSync(full).isDirectory()) out = out.concat(walk(full));
      else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) out.push(full);
    }
    return out;
  }

  const ROOT = path.join(__dirname, '..', 'src');
  const files = walk(ROOT);

  // Patterns that indicate broken code from the mass replacement
  const PATTERNS = [
    { re: /if\s*\(\((?:auth|decoded)\.role\b/, label: 'double-open-paren in if' },
    { re: /\((?:auth|decoded)\.role\s*[!=]==\s*'superadmin',/, label: 'role check ends with comma' },
    { re: /(?:auth|decoded)\.role/, label: 'COUNT_CHECK' },
  ];

  let issues = 0;
  const results = [];

  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    const rel = file.replace(ROOT + path.sep, '').replace(/\\/g, '/');

    lines.forEach((line, idx) => {
      const lineNo = idx + 1;

      for (const p of PATTERNS) {
        if (p.label === 'COUNT_CHECK') {
          if (!p.re.test(line)) continue;
          if (!/[{;,]$/.test(line.trim())) continue;
          const opens  = (line.match(/\(/g) || []).length;
          const closes = (line.match(/\)/g) || []).length;
          if (opens !== closes) {
            results.push({ file: rel, lineNo, label: `unbalanced parens (${opens}o/${closes}c)`, line: line.trim() });
            issues++;
          }
        } else {
          if (p.re.test(line)) {
            results.push({ file: rel, lineNo, label: p.label, line: line.trim() });
            issues++;
          }
        }
      }
    });
  }

  if (results.length === 0) {
    console.log('✅ No syntax issues found.\n');
  } else {
    console.log(`⚠️  ${issues} syntax issue(s) found:\n`);
    for (const r of results) {
      console.log(`  ${r.file}:${r.lineNo}  [${r.label}]`);
      console.log(`    ${r.line.substring(0, 120)}\n`);
    }
  }

  return results.length === 0;
}

// ─── Quality Audit ────────────────────────────────────────────────────────

function auditQuality() {
  console.log('\n📊 QUALITY AUDIT: Scoring UI quality across roles...\n');
  
  const ROOT = path.join(process.cwd(), 'src', 'app');
  const ROLE_ORDER = ['admin', 'superadmin', 'shop', 'manager', 'tech', 'customer', 'public'];

  function walk(dir, files = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, files);
        continue;
      }
      if (/page\.(tsx|ts)$/.test(entry.name)) files.push(full);
    }
    return files;
  }

  function getRole(relPath) {
    const first = relPath.split('/')[2] || '';
    if (['admin', 'superadmin', 'shop', 'manager', 'tech', 'customer'].includes(first)) return first;
    return 'public';
  }

  function scorePage(content) {
    const usesMarketingShell = /<MarketingShell\b|from ['\"]@\/components\/MarketingShell['\"]/.test(content);
    const checks = {
      hasViewportShell: /min-h-screen|minHeight\s*:\s*['\"]100vh['\"]|100dvh/.test(content),
      usesBlackShell: /bg-black|#000000|background\s*:\s*['\"]#000000['\"]|backgroundColor\s*:\s*['\"]#000000['\"]/.test(content),
      hasSemanticHeading: /<h1\b|<h2\b/.test(content),
      hasTouchSafePattern: /env\(safe-area-inset|MobileShell|useIsMobile/.test(content),
      avoidsLegacyBlue: !/#2563eb|text-blue-|bg-blue-/.test(content),
      avoidsSlateShell: !/bg-slate|#0f172a|#111827|#09090b|bg-zinc|bg-gray-/.test(content),
      usesMarketingShell,
    };

    let score = 100;
    if (!checks.hasViewportShell) score -= 20;
    if (!checks.usesBlackShell) score -= 20;
    if (!checks.hasSemanticHeading) score -= 10;
    if (!checks.hasTouchSafePattern) score -= 15;
    if (!checks.avoidsLegacyBlue) score -= 20;
    if (!checks.avoidsSlateShell) score -= 15;

    return { score: Math.max(0, score), checks };
  }

  function hasInheritedShell(pageFile) {
    let currentDir = path.dirname(pageFile);
    while (currentDir.startsWith(ROOT)) {
      const layoutPath = path.join(currentDir, 'layout.tsx');
      if (fs.existsSync(layoutPath)) {
        const txt = fs.readFileSync(layoutPath, 'utf8');
        if (/role-route-shell|<MobileShell\b/.test(txt)) {
          return true;
        }
      }
      if (currentDir === ROOT) break;
      currentDir = path.dirname(currentDir);
    }
    return false;
  }

  function avg(nums) {
    if (!nums.length) return 0;
    return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
  }

  const pages = walk(ROOT).map((file) => {
    const rel = file.replace(process.cwd() + path.sep, '').replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');
    const role = getRole(rel);
    const audit = scorePage(content);
    const inherited = hasInheritedShell(file);
    const finalScore = inherited ? Math.min(100, audit.score + 15) : audit.score;

    return { file: rel, role, score: finalScore, ...audit, inherited };
  });

  const byRole = {};
  ROLE_ORDER.forEach(r => byRole[r] = []);
  pages.forEach(p => {
    if (byRole[p.role]) byRole[p.role].push(p);
  });

  for (const role of ROLE_ORDER) {
    const pages = byRole[role];
    if (!pages.length) continue;

    const scores = pages.map(p => p.score);
    const avgScore = avg(scores);
    const emoji = avgScore >= 90 ? '✅' : avgScore >= 70 ? '⚠️ ' : '❌';

    console.log(`${emoji} ${role.toUpperCase()}: ${avgScore}% (${pages.length} pages)`);

    // Show low-scoring pages
    const low = pages.filter(p => p.score < 80).sort((a, b) => a.score - b.score);
    if (low.length > 0) {
      for (const p of low.slice(0, 3)) {
        console.log(`     ${p.file.split('/').slice(-2).join('/')}: ${p.score}%`);
      }
      if (low.length > 3) console.log(`     ... and ${low.length - 3} more`);
    }
  }

  const allScores = pages.map(p => p.score);
  console.log(`\n📈 Overall Average: ${avg(allScores)}% across ${pages.length} pages\n`);

  return true;
}

// ─── Main ─────────────────────────────────────────────────────────────────

const syntaxOK = (mode === 'syntax' || mode === 'all') ? auditSyntax() : true;
const qualityOK = (mode === 'quality' || mode === 'all') ? auditQuality() : true;

if (!syntaxOK || !qualityOK) {
  process.exit(1);
}
