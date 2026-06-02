const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const QA_FILE = path.join(ROOT, 'fixtray-qa-master-detailed.html');
const APP_DIR = path.join(ROOT, 'src', 'app');

function stripTags(value) {
  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getRoleFromPageTitle(title) {
  const t = title.toLowerCase();
  if (t.includes('/admin') || t.includes('admin')) return 'Admin';
  if (t.includes('/shop') || t.includes('shop owner') || t.includes('shop')) return 'Shop';
  if (t.includes('/tech') || t.includes('technician')) return 'Technician';
  if (t.includes('/customer') || t.includes('customer')) return 'Customer';
  return 'General';
}

function parseChecklist(html) {
  const detailsBlocks = [...html.matchAll(/<details>([\s\S]*?)<\/details>/gi)];
  const pages = [];

  for (const blockMatch of detailsBlocks) {
    const block = blockMatch[1];
    const summaryMatch = block.match(/<summary>([\s\S]*?)<\/summary>/i);
    if (!summaryMatch) continue;

    const pageTitle = stripTags(summaryMatch[1]);
    const rows = [...block.matchAll(/<div class="test-row">([\s\S]*?)<\/div>\s*<\/div>|<div class="test-row">([\s\S]*?)<\/div>\s*<div class="test-row">/gi)];

    // Fallback safer row parser scoped by opening/closing test-row blocks.
    const rowBlocks = [...block.matchAll(/<div class="test-row">([\s\S]*?)<\/div>\s*<\/div>|<div class="test-row">([\s\S]*?)<\/div>\s*$/gi)];

    const componentMatches = [...block.matchAll(/<span class="component-name">([\s\S]*?)<\/span>[\s\S]*?<span class="component-desc">([\s\S]*?)<\/span>[\s\S]*?<span class="component-type">([\s\S]*?)<\/span>/gi)];

    const components = componentMatches.map((m) => ({
      name: stripTags(m[1]),
      description: stripTags(m[2]),
      type: stripTags(m[3])
    }));

    if (components.length === 0) continue;

    pages.push({
      title: pageTitle,
      role: getRoleFromPageTitle(pageTitle),
      components,
      _rawCount: rows.length + rowBlocks.length
    });
  }

  return pages;
}

function walkPages(dir, base = '') {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('_')) continue;

    const abs = path.join(dir, entry.name);
    const rel = base ? path.join(base, entry.name) : entry.name;

    if (entry.isDirectory()) {
      out.push(...walkPages(abs, rel));
      continue;
    }

    if (entry.isFile() && entry.name === 'page.tsx') {
      const routePath = '/' + rel.replace(/\\/g, '/').replace(/\/page\.tsx$/, '');
      out.push(routePath === '/page.tsx' ? '/' : routePath);
    }
  }

  return out;
}

function buildRouteSummary(routes) {
  const buckets = {
    Public: [],
    Admin: [],
    Shop: [],
    Technician: [],
    Manager: [],
    Customer: [],
    Superadmin: [],
    Other: []
  };

  for (const route of routes) {
    if (route === '/' || route.startsWith('/auth/') || route.startsWith('/about') || route.startsWith('/features') || route.startsWith('/pricing') || route.startsWith('/contact') || route.startsWith('/privacy-policy') || route.startsWith('/terms-of-service')) {
      buckets.Public.push(route);
    } else if (route.startsWith('/admin/')) {
      buckets.Admin.push(route);
    } else if (route.startsWith('/shop/')) {
      buckets.Shop.push(route);
    } else if (route.startsWith('/tech/')) {
      buckets.Technician.push(route);
    } else if (route.startsWith('/manager/')) {
      buckets.Manager.push(route);
    } else if (route.startsWith('/customer/')) {
      buckets.Customer.push(route);
    } else if (route.startsWith('/superadmin/')) {
      buckets.Superadmin.push(route);
    } else {
      buckets.Other.push(route);
    }
  }

  return buckets;
}

function renderHtml(pages, routes, routeBuckets) {
  const totalComponents = pages.reduce((sum, p) => sum + p.components.length, 0);
  const totalPages = pages.length;
  const generatedAt = new Date().toLocaleString('en-US', { hour12: true });

  const roleCounts = ['Admin', 'Shop', 'Technician', 'Manager', 'Customer', 'Superadmin', 'Public', 'Other']
    .map((name) => `${name}: ${(routeBuckets[name] || []).length}`)
    .join(' | ');

  const pageSections = pages
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((page) => {
      const rows = page.components
        .map((c) => `
          <tr>
            <td>${escapeHtml(c.name)}</td>
            <td>${escapeHtml(c.type)}</td>
            <td>${escapeHtml(c.description)}</td>
          </tr>
        `)
        .join('');

      return `
        <section class="page-block">
          <h3>${escapeHtml(page.title)}</h3>
          <p class="meta">Role: ${escapeHtml(page.role)} | Components documented: ${page.components.length}</p>
          <table>
            <thead>
              <tr>
                <th>Button / Card / Element</th>
                <th>Type</th>
                <th>What It Does</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </section>
      `;
    })
    .join('\n');

  const routeSections = Object.entries(routeBuckets)
    .filter(([, list]) => list.length > 0)
    .map(([name, list]) => `
      <section class="route-group">
        <h4>${escapeHtml(name)} Routes (${list.length})</h4>
        <div class="route-list">${list.sort().map((r) => `<div>${escapeHtml(r)}</div>`).join('')}</div>
      </section>
    `)
    .join('\n');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>FixTray In-Depth Information Report</title>
  <style>
    @page { size: Letter; margin: 0.45in; }
    * { box-sizing: border-box; }
    body { font-family: "Segoe UI", Arial, sans-serif; color: #111827; margin: 0; font-size: 10.2pt; }
    .wrap { max-width: 1000px; margin: 0 auto; }
    .header { border: 2px solid #0f172a; border-radius: 10px; padding: 14px 16px; margin-bottom: 14px; background: #f8fafc; }
    h1 { margin: 0; font-size: 19pt; color: #0f172a; }
    .sub { margin-top: 4px; color: #334155; font-size: 10pt; }
    .stats { margin-top: 8px; font-weight: 600; color: #0f172a; font-size: 9.4pt; }
    .note { margin-top: 8px; font-size: 9pt; color: #475569; }
    h2 { margin: 14px 0 8px; font-size: 13pt; border-left: 4px solid #2563eb; padding-left: 8px; color: #0f172a; }
    .page-block { margin-bottom: 14px; page-break-inside: avoid; }
    h3 { margin: 8px 0 4px; font-size: 11.2pt; color: #1e293b; }
    .meta { margin: 0 0 6px; color: #475569; font-size: 8.8pt; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 7px; vertical-align: top; }
    th { background: #e2e8f0; text-align: left; font-size: 8.8pt; }
    td { font-size: 8.8pt; line-height: 1.3; }
    th:nth-child(1), td:nth-child(1) { width: 31%; }
    th:nth-child(2), td:nth-child(2) { width: 20%; }
    th:nth-child(3), td:nth-child(3) { width: 49%; }
    .routes { margin-top: 18px; page-break-before: always; }
    .route-group { margin-bottom: 10px; }
    .route-group h4 { margin: 0 0 4px; font-size: 10pt; color: #0f172a; }
    .route-list { columns: 2; column-gap: 18px; }
    .route-list div { font-family: Consolas, monospace; font-size: 8.2pt; color: #334155; margin: 0 0 2px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>FixTray In-Depth Information Report</h1>
      <div class="sub">Comprehensive UI reference for buttons, cards, controls, and expected behaviors.</div>
      <div class="stats">Generated: ${escapeHtml(generatedAt)} | Documented pages: ${totalPages} | Documented UI elements: ${totalComponents} | Route files: ${routes.length}</div>
      <div class="note">Source basis: [fixtray-qa-master-detailed.html] component matrix + live app route inventory from src/app/page.tsx files.</div>
      <div class="note">Role route counts: ${escapeHtml(roleCounts)}</div>
    </div>

    <h2>UI Components (Buttons, Cards, Inputs, Actions)</h2>
    ${pageSections}

    <div class="routes">
      <h2>Route Inventory</h2>
      ${routeSections}
    </div>
  </div>
</body>
</html>`;
}

async function main() {
  const outputHtml = process.argv[2] || 'c:/Users/Owner/Desktop/FixTray-In-Depth-Information-Report.html';
  const outputPdf = process.argv[3] || 'c:/Users/Owner/Desktop/FixTray-In-Depth-Information-Report.pdf';

  const qaHtml = fs.readFileSync(QA_FILE, 'utf8');
  const pages = parseChecklist(qaHtml);
  const routes = walkPages(APP_DIR).sort();
  const routeBuckets = buildRouteSummary(routes);
  const reportHtml = renderHtml(pages, routes, routeBuckets);

  fs.writeFileSync(outputHtml, reportHtml, 'utf8');

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(reportHtml, { waitUntil: 'networkidle' });
  await page.pdf({
    path: outputPdf,
    format: 'Letter',
    printBackground: true,
    margin: { top: '0.45in', right: '0.45in', bottom: '0.45in', left: '0.45in' }
  });
  await browser.close();

  console.log(`Report HTML: ${outputHtml}`);
  console.log(`Report PDF: ${outputPdf}`);
  console.log(`Checklist pages: ${pages.length}`);
  console.log(`UI elements: ${pages.reduce((sum, p) => sum + p.components.length, 0)}`);
  console.log(`Routes: ${routes.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
