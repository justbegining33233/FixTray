// Test all pages with auth tokens
const http = require('http');

const tokens = {
  shop: process.env.SHOP_TOKEN,
  tech: process.env.TECH_TOKEN,
  manager: process.env.MGR_TOKEN,
  customer: process.env.CUST_TOKEN,
};

const pages = {
  public: [
    '/', '/about', '/contact', '/features', '/pricing', '/security', '/offline',
    '/auth/login', '/auth/register/shop', '/auth/register/shop/client', '/auth/reset',
    '/auth/pending-approval', '/auth/thank-you',
    '/register/customer', '/register/success', '/register/canceled',
    '/payment/success', '/payment/cancel',
  ],
  shop: [
    '/shop/home', '/shop/admin', '/shop/admin/branding', '/shop/admin/payroll',
    '/shop/admin/services', '/shop/admin/taxes', '/shop/analytics', '/shop/bays',
    '/shop/calendar', '/shop/campaigns', '/shop/condition-reports', '/shop/core-returns',
    '/shop/customers', '/shop/dashboard', '/shop/diagnostics', '/shop/dvi',
    '/shop/environmental-fees', '/shop/eod-report', '/shop/fleet',
    '/shop/inspections', '/shop/inventory', '/shop/loaners', '/shop/locations',
    '/shop/messages', '/shop/payroll', '/shop/purchase-orders',
    '/shop/recurring-workorders', '/shop/reports', '/shop/schedule',
    '/shop/settings', '/shop/state-inspections', '/shop/templates',
    '/shop/time-tracking', '/shop/vendors', '/shop/waiting-room',
    '/shop/work-authorizations',
  ],
  tech: [
    '/tech/home', '/tech/diagnostics', '/tech/dvi', '/tech/dvi/new',
    '/tech/inventory', '/tech/messages', '/tech/punch-clock', '/tech/schedule',
    '/tech/settings', '/tech/timeclock', '/tech/tracking',
    '/tech/work-authorizations', '/tech/workorders',
  ],
  manager: [
    '/manager/home', '/manager/dashboard', '/manager/estimates',
    '/manager/inventory', '/manager/assignments', '/manager/team',
    '/manager/overview', '/manager/work-orders', '/manager/inspections',
  ],
  customer: [
    '/customer/home', '/customer/appointments', '/customer/appointments/book',
    '/customer/dashboard', '/customer/documents', '/customer/favorites',
    '/customer/messages', '/customer/payments', '/customer/profile',
    '/customer/rewards', '/customer/settings', '/customer/vehicles',
    '/customer/workorders',
  ],
  workorders: [
    '/workorders/inshop', '/workorders/list', '/workorders/new',
  ],
  reports: ['/reports'],
};

function testPage(path, token) {
  return new Promise((resolve) => {
    const opts = {
      hostname: 'localhost', port: 3000, path, method: 'GET',
      headers: token ? { Cookie: `sos_auth=${token}` } : {},
    };
    const req = http.request(opts, (res) => {
      let body = '';
      res.on('data', (d) => body += d);
      res.on('end', () => {
        // Check if it's a real 404 (not auth redirect)
        const is404 = res.statusCode === 404;
        const isRedirect = res.statusCode >= 300 && res.statusCode < 400;
        const has404Content = body.includes('not-found') || body.includes('404') || body.includes('This page could not be found');
        // 200 with 404 content = soft 404
        const soft404 = res.statusCode === 200 && has404Content;
        resolve({ path, status: res.statusCode, is404, isRedirect, soft404, location: res.headers.location || '' });
      });
    });
    req.on('error', (e) => resolve({ path, status: 'ERR', error: e.message }));
    req.end();
  });
}

async function main() {
  const results = { ok: [], redirect: [], notFound: [], errors: [], soft404: [] };

  // Test public pages (no token)
  console.log('Testing public pages...');
  for (const p of pages.public) {
    const r = await testPage(p, null);
    if (r.is404 || r.soft404) results.notFound.push(r);
    else if (r.status === 200) results.ok.push(r);
    else if (r.isRedirect) results.redirect.push(r);
    else results.errors.push(r);
  }

  // Test role-based pages
  const roleMap = { shop: 'shop', tech: 'tech', manager: 'manager', customer: 'customer', workorders: 'shop', reports: 'shop' };
  for (const [section, tokenKey] of Object.entries(roleMap)) {
    const token = tokens[tokenKey];
    console.log(`Testing ${section} pages with ${tokenKey} token...`);
    for (const p of pages[section]) {
      const r = await testPage(p, token);
      if (r.is404 || r.soft404) results.notFound.push(r);
      else if (r.status === 200) results.ok.push(r);
      else if (r.isRedirect) results.redirect.push(r);
      else results.errors.push(r);
    }
  }

  console.log('\n========== RESULTS ==========\n');
  console.log(`OK (200): ${results.ok.length} pages`);
  console.log(`Redirects (307): ${results.redirect.length} pages`);
  console.log(`404 / Not Found: ${results.notFound.length} pages`);
  console.log(`Errors: ${results.errors.length} pages`);

  if (results.notFound.length > 0) {
    console.log('\n--- 404 / NOT FOUND PAGES ---');
    results.notFound.forEach(r => console.log(`  ${r.status}  ${r.path}${r.soft404 ? ' (soft 404)' : ''}`));
  }
  if (results.redirect.length > 0) {
    console.log('\n--- REDIRECTS (unexpected with auth) ---');
    results.redirect.forEach(r => console.log(`  ${r.status}  ${r.path}  -> ${r.location}`));
  }
  if (results.errors.length > 0) {
    console.log('\n--- ERRORS ---');
    results.errors.forEach(r => console.log(`  ${r.status}  ${r.path}  ${r.error || ''}`));
  }
  if (results.ok.length > 0) {
    console.log('\n--- OK PAGES ---');
    results.ok.forEach(r => console.log(`  200  ${r.path}`));
  }
}

main();
