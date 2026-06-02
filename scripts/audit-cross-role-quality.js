const fs = require('fs');
const path = require('path');

const ROOT = path.join(process.cwd(), 'src', 'app');
const OUT_DIR = path.join(process.cwd(), 'docs', 'reports');
const OUT_JSON = path.join(OUT_DIR, 'cross-role-quality-report.json');
const OUT_MD = path.join(OUT_DIR, 'cross-role-quality-report.md');

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

function run() {
  const pages = walk(ROOT).map((file) => {
    const rel = file.replace(process.cwd() + path.sep, '').replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');
    const role = getRole(rel);
    const audit = scorePage(content);

    if (hasInheritedShell(file)) {
      audit.checks.hasViewportShell = true;
      audit.checks.usesBlackShell = true;
      audit.checks.hasTouchSafePattern = true;

      if (audit.score < 100) {
        // Restore penalties for inherited shell checks because this role is covered by layout.
        if (!/min-h-screen|minHeight\s*:\s*['\"]100vh['\"]|100dvh/.test(content)) audit.score += 20;
        if (!/bg-black|#000000|background\s*:\s*['\"]#000000['\"]|backgroundColor\s*:\s*['\"]#000000['\"]/.test(content)) audit.score += 20;
        if (!/env\(safe-area-inset|MobileShell|useIsMobile/.test(content)) audit.score += 15;
        if (audit.score > 100) audit.score = 100;
      }
    }

    if (audit.checks.usesMarketingShell) {
      audit.checks.hasViewportShell = true;
      audit.checks.usesBlackShell = true;
      audit.checks.hasTouchSafePattern = true;

      if (audit.score < 100) {
        if (!/min-h-screen|minHeight\s*:\s*['\"]100vh['\"]|100dvh/.test(content)) audit.score += 20;
        if (!/bg-black|#000000|background\s*:\s*['\"]#000000['\"]|backgroundColor\s*:\s*['\"]#000000['\"]/.test(content)) audit.score += 20;
        if (!/env\(safe-area-inset|MobileShell|useIsMobile/.test(content)) audit.score += 15;
        if (audit.score > 100) audit.score = 100;
      }
    }

    return { file: rel, role, ...audit };
  });

  const roles = {};
  for (const role of ROLE_ORDER) roles[role] = [];
  for (const page of pages) roles[page.role].push(page);

  const roleSummary = ROLE_ORDER.map((role) => {
    const list = roles[role] || [];
    const scores = list.map((p) => p.score);
    const failing = list.filter((p) => p.score < 85).sort((a, b) => a.score - b.score).slice(0, 15);
    return {
      role,
      pages: list.length,
      averageScore: avg(scores),
      failingPages: failing,
    };
  });

  const overall = {
    pages: pages.length,
    averageScore: avg(pages.map((p) => p.score)),
    byRole: roleSummary,
    worstPages: [...pages].sort((a, b) => a.score - b.score).slice(0, 25),
    generatedAt: new Date().toISOString(),
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(overall, null, 2));

  const lines = [];
  lines.push('# Cross-Role Quality Report');
  lines.push('');
  lines.push(`Generated: ${overall.generatedAt}`);
  lines.push(`Total pages audited: ${overall.pages}`);
  lines.push(`Overall average score: ${overall.averageScore}`);
  lines.push('');
  lines.push('## Role Scores');
  lines.push('');
  lines.push('| Role | Pages | Average |');
  lines.push('| --- | ---: | ---: |');
  for (const r of roleSummary) {
    lines.push(`| ${r.role} | ${r.pages} | ${r.averageScore} |`);
  }
  lines.push('');
  lines.push('## Lowest-Scoring Pages');
  lines.push('');
  for (const p of overall.worstPages) {
    lines.push(`- ${p.score} - ${p.file}`);
  }
  lines.push('');
  lines.push('## Notes');
  lines.push('');
  lines.push('- Target 10/10 baseline: each role average >= 92, no page below 85.');
  lines.push('- Focus on shared shell/layout changes first to lift all pages at once.');

  fs.writeFileSync(OUT_MD, lines.join('\n'));

  console.log(`Audited ${overall.pages} pages.`);
  console.log(`Overall score: ${overall.averageScore}`);
  console.log(`Report written: ${OUT_MD}`);
}

run();
