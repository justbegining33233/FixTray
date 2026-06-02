const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const APP_DIR = path.join(ROOT, 'src', 'app');

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripTags(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function roleFromText(text) {
  const t = text.toLowerCase();
  if (t.includes('admin')) return 'Admin';
  if (t.includes('shop')) return 'Shop';
  if (t.includes('tech')) return 'Technician';
  if (t.includes('customer')) return 'Customer';
  if (t.includes('manager')) return 'Manager';
  if (t.includes('superadmin')) return 'Superadmin';
  return 'General';
}

function extractPlaceholder(cellHtml) {
  const m = cellHtml.match(/placeholder\s*=\s*"([^"]*)"/i);
  return m ? stripTags(m[1]) : '';
}

function parseTableChecklistHtml(sourceName, html) {
  const title = stripTags((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || sourceName);
  const baseRole = roleFromText(title);
  const out = [];

  const sections = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2[^>]*>|<script|<\/body>)/gi)];
  for (const sec of sections) {
    const sectionTitle = stripTags(sec[1]);
    const block = sec[2];
    const rows = [...block.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];

    for (const row of rows) {
      const rowHtml = row[1];
      if (/<th[\s>]/i.test(rowHtml)) continue;

      const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
      if (!cells.length) continue;

      const nameCell = cells[0] || '';
      const typeMatch = nameCell.match(/<span[^>]*class\s*=\s*"[^"]*row-type[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
      const type = typeMatch ? stripTags(typeMatch[1]) : 'UI Element';
      const nameNoType = nameCell.replace(/<span[^>]*class\s*=\s*"[^"]*row-type[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '');
      const name = stripTags(nameNoType);

      if (!name) continue;

      let description = '';
      if (cells[3]) {
        description = extractPlaceholder(cells[3]);
        if (!description) description = stripTags(cells[3]);
      }
      if (!description) description = `Referenced in ${sectionTitle}.`;

      out.push({
        source: sourceName,
        page: sectionTitle,
        role: baseRole,
        name,
        type,
        description
      });
    }
  }

  return out;
}

function parseDetailedChecklistHtml(sourceName, html) {
  const out = [];
  const detailBlocks = [...html.matchAll(/<details>([\s\S]*?)<\/details>/gi)];

  for (const blockMatch of detailBlocks) {
    const block = blockMatch[1];
    const summary = stripTags((block.match(/<summary>([\s\S]*?)<\/summary>/i) || [])[1] || 'Checklist Page');
    const role = roleFromText(summary);

    const components = [...block.matchAll(/<span[^>]*class\s*=\s*"[^"]*component-name[^"]*"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<span[^>]*class\s*=\s*"[^"]*component-desc[^"]*"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<span[^>]*class\s*=\s*"[^"]*component-type[^"]*"[^>]*>([\s\S]*?)<\/span>/gi)];

    for (const c of components) {
      out.push({
        source: sourceName,
        page: summary,
        role,
        name: stripTags(c[1]),
        description: stripTags(c[2]) || `Referenced in ${summary}.`,
        type: stripTags(c[3]) || 'UI Element'
      });
    }
  }

  return out;
}

function dedupeItems(items) {
  const seen = new Set();
  const out = [];

  for (const item of items) {
    const key = `${item.role}|${item.page}|${item.name}|${item.type}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function walkRoutes(dir, base = '') {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('_')) continue;

    const abs = path.join(dir, entry.name);
    const rel = base ? path.join(base, entry.name) : entry.name;

    if (entry.isDirectory()) {
      out.push(...walkRoutes(abs, rel));
      continue;
    }

    if (entry.isFile() && entry.name === 'page.tsx') {
      let route = '/' + rel.replace(/\\/g, '/').replace(/\/page\.tsx$/, '');
      if (route === '/page.tsx') route = '/';
      out.push(route);
    }
  }

  return out;
}

function buildRouteBuckets(routes) {
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
    if (route === '/' || route.startsWith('/auth/') || route.startsWith('/register/') || route.startsWith('/about') || route.startsWith('/features') || route.startsWith('/pricing') || route.startsWith('/contact') || route.startsWith('/privacy-policy') || route.startsWith('/terms-of-service') || route.startsWith('/payment/')) {
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

function buildHtml(items, routes, buckets) {
  const generatedAt = new Date().toLocaleString('en-US', { hour12: true });
  const byPage = new Map();

  for (const item of items) {
    const key = `${item.role} | ${item.page}`;
    if (!byPage.has(key)) byPage.set(key, []);
    byPage.get(key).push(item);
  }

  const sortedPages = [...byPage.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const pageHtml = sortedPages.map(([pageKey, list]) => {
    const rows = list
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((i) => `
        <tr>
          <td>${escapeHtml(i.name)}</td>
          <td>${escapeHtml(i.type)}</td>
          <td>${escapeHtml(i.description)}</td>
          <td>${escapeHtml(i.source)}</td>
        </tr>
      `)
      .join('');

    return `
      <section class="page-block">
        <h3>${escapeHtml(pageKey)} (${list.length})</h3>
        <table>
          <thead>
            <tr>
              <th>Button/Card/Element</th>
              <th>Type</th>
              <th>Behavior / Explanation</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </section>
    `;
  }).join('\n');

  const routeCounts = Object.entries(buckets)
    .map(([k, v]) => `${k}: ${v.length}`)
    .join(' | ');

  const routeHtml = Object.entries(buckets)
    .filter(([, v]) => v.length)
    .map(([name, list]) => `
      <section class="route-group">
        <h4>${escapeHtml(name)} Routes (${list.length})</h4>
        <div class="route-list">${list.sort().map((r) => `<div>${escapeHtml(r)}</div>`).join('')}</div>
      </section>
    `).join('\n');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>FixTray In-Depth Information Report</title>
  <style>
    @page { size: Letter; margin: 0.45in; }
    * { box-sizing: border-box; }
    body { font-family: "Segoe UI", Arial, sans-serif; color: #111827; margin: 0; font-size: 10pt; }
    .wrap { max-width: 1020px; margin: 0 auto; }
    .header { border: 2px solid #0f172a; border-radius: 10px; padding: 14px 16px; margin-bottom: 14px; background: #f8fafc; }
    h1 { margin: 0; font-size: 18pt; color: #0f172a; }
    .sub { margin-top: 4px; color: #334155; font-size: 10pt; }
    .stats { margin-top: 8px; font-weight: 600; color: #0f172a; font-size: 9.4pt; }
    .note { margin-top: 7px; font-size: 8.8pt; color: #475569; }
    h2 { margin: 14px 0 8px; font-size: 12.8pt; border-left: 4px solid #2563eb; padding-left: 8px; color: #0f172a; }
    h3 { margin: 8px 0 6px; font-size: 10.8pt; color: #1e293b; }
    .page-block { margin-bottom: 14px; page-break-inside: avoid; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 7px; vertical-align: top; }
    th { background: #e2e8f0; text-align: left; font-size: 8.5pt; }
    td { font-size: 8.3pt; line-height: 1.3; }
    th:nth-child(1), td:nth-child(1) { width: 27%; }
    th:nth-child(2), td:nth-child(2) { width: 18%; }
    th:nth-child(3), td:nth-child(3) { width: 40%; }
    th:nth-child(4), td:nth-child(4) { width: 15%; }
    .routes { page-break-before: always; margin-top: 18px; }
    .route-group { margin-bottom: 10px; }
    .route-group h4 { margin: 0 0 4px; font-size: 10pt; color: #0f172a; }
    .route-list { columns: 2; column-gap: 18px; }
    .route-list div { font-family: Consolas, monospace; font-size: 8pt; color: #334155; margin: 0 0 2px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>FixTray In-Depth Information Report</h1>
      <div class="sub">Comprehensive explanation of documented UI buttons, cards, links, and actions across QA role checklists.</div>
      <div class="stats">Generated: ${escapeHtml(generatedAt)} | Documented UI elements: ${items.length} | Distinct UI sections: ${sortedPages.length} | Route files: ${routes.length}</div>
      <div class="note">Role route counts: ${escapeHtml(routeCounts)}</div>
      <div class="note">Sources: fixtray-qa-admin.html, fixtray-qa-shopowner.html, fixtray-qa-tech.html, fixtray-qa-customer.html, fixtray-qa-master-checklist.html, fixtray-qa-master-detailed.html, fixtray-qa-checklist.html.</div>
    </div>

    <h2>UI Elements and Behaviors</h2>
    ${pageHtml}

    <div class="routes">
      <h2>Route Inventory (src/app pages)</h2>
      ${routeHtml}
    </div>
  </div>
</body>
</html>`;
}

async function main() {
  const outputHtml = process.argv[2] || 'c:/Users/Owner/Desktop/FixTray-In-Depth-Information-Report.html';
  const outputPdf = process.argv[3] || 'c:/Users/Owner/Desktop/FixTray-In-Depth-Information-Report.pdf';

  const qaFiles = [
    'fixtray-qa-admin.html',
    'fixtray-qa-shopowner.html',
    'fixtray-qa-tech.html',
    'fixtray-qa-customer.html',
    'fixtray-qa-master-checklist.html',
    'fixtray-qa-master-detailed.html',
    'fixtray-qa-checklist.html'
  ];

  const allItems = [];

  for (const file of qaFiles) {
    const fullPath = path.join(ROOT, file);
    if (!fs.existsSync(fullPath)) continue;

    const html = fs.readFileSync(fullPath, 'utf8');
    if (file.includes('master-detailed')) {
      allItems.push(...parseDetailedChecklistHtml(file, html));
    }
    allItems.push(...parseTableChecklistHtml(file, html));
  }

  const items = dedupeItems(allItems);
  const routes = walkRoutes(APP_DIR).sort();
  const buckets = buildRouteBuckets(routes);
  const reportHtml = buildHtml(items, routes, buckets);

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
  console.log(`UI elements documented: ${items.length}`);
  console.log(`Route files: ${routes.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
