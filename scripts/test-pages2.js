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
  workorders_shop: [
    '/workorders/inshop', '/workorders/list', '/workorders/new',
  ],
  reports_shop: ['/reports'],
};

function testPage(path, token) {
  return new Promise((resolve) => {
    const headers = {};
    if (token) headers['Cookie'] = 'sos_auth=' + token;
    const req = http.request({ hostname: 'localhost', port: 3000, path, method: 'GET', headers }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        const loc = res.headers.location || '';
        resolve({ path, status: res.statusCode, location: loc, bodyLen: body.length });
      });
    });
    req.on('error', e => resolve({ path, status: 'ERR', error: e.message }));
    req.setTimeout(30000, () => { req.destroy(); resolve({ path, status: 'TIMEOUT' }); });
    req.end();
  });
}

async function main() {
  const notFound = [];
  const errors = [];
  const ok = [];
  const redirects = [];

  const roleMap = {
    public: null,
    shop: 'shop',
    tech: 'tech',
    manager: 'manager',
    customer: 'customer',
    workorders_shop: 'shop',
    reports_shop: 'shop',
  };

  for (const [section, tokenKey] of Object.entries(roleMap)) {
    const token = tokenKey ? tokens[tokenKey] : null;
    const sectionPages = pages[section];
    console.error('Testing ' + section + ' (' + sectionPages.length + ' pages)...');
    
    // Test 3 at a time for speed
    for (let i = 0; i < sectionPages.length; i += 3) {
      const batch = sectionPages.slice(i, i + 3);
      const results = await Promise.all(batch.map(p => testPage(p, token)));
      for (const r of results) {
        if (r.status === 200) ok.push(r);
        else if (r.status === 404) notFound.push(r);
        else if (r.status >= 300 && r.status < 400) redirects.push(r);
        else errors.push(r);
      }
    }
  }

  console.log('\n========== PAGE TEST RESULTS ==========\n');
  console.log('OK (200): ' + ok.length);
  console.log('404 Not Found: ' + notFound.length);
  console.log('Redirects (auth?): ' + redirects.length);
  console.log('Errors/Other: ' + errors.length);

  if (notFound.length > 0) {
    console.log('\n--- 404 NOT FOUND ---');
    notFound.forEach(r => console.log('  ' + r.status + '  ' + r.path));
  }
  if (redirects.length > 0) {
    console.log('\n--- REDIRECTS ---');
    redirects.forEach(r => console.log('  ' + r.status + '  ' + r.path + '  -> ' + r.location));
  }
  if (errors.length > 0) {
    console.log('\n--- ERRORS ---');
    errors.forEach(r => console.log('  ' + r.status + '  ' + r.path + '  ' + (r.error || '')));
  }
  if (ok.length > 0) {
    console.log('\n--- OK (200) ---');
    ok.forEach(r => console.log('  200  ' + r.path));
  }
}

main();
