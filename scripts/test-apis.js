const http = require('http');

const tokens = {
  shop: process.env.SHOP_TOKEN,
  tech: process.env.TECH_TOKEN,
  manager: process.env.MGR_TOKEN,
  customer: process.env.CUST_TOKEN,
};

// API endpoints grouped by which token to use
const apis = {
  none: [
    'GET /api/health',
    'GET /api/contact',
  ],
  shop: [
    'GET /api/workorders',
    'GET /api/inventory',
    'GET /api/techs',
    'GET /api/services',
    'GET /api/appointments',
    'GET /api/bays',
    'GET /api/analytics',
    'GET /api/shop',
    'GET /api/shop/stats',
    'GET /api/shop/settings',
    'GET /api/shop/team',
    'GET /api/shop/schedule',
    'GET /api/shop/messages',
    'GET /api/shop/logs',
    'GET /api/shop/recent-activity',
    'GET /api/shop/urgent-alerts',
    'GET /api/shop/workorder-stats',
    'GET /api/shop/financial-summary',
    'GET /api/shop/eod-report',
    'GET /api/shop/team-performance',
    'GET /api/shop/team-schedule',
    'GET /api/shop/campaigns',
    'GET /api/shop/customer-reports',
    'GET /api/shop/templates',
    'GET /api/shop/vendors',
    'GET /api/shop/locations',
    'GET /api/shop/purchase-orders',
    'GET /api/shop/inventory-stock',
    'GET /api/shop/inventory-requests',
    'GET /api/shop/payroll',
    'GET /api/inventory/low-stock',
    'GET /api/inventory/shared',
    'GET /api/notifications',
    'GET /api/notifications-db',
    'GET /api/photos',
    'GET /api/dvi',
    'GET /api/condition-reports',
    'GET /api/core-returns',
    'GET /api/environmental-fees',
    'GET /api/loaners',
    'GET /api/fleet',
    'GET /api/state-inspections',
    'GET /api/recurring-workorders',
    'GET /api/time-tracking',
    'GET /api/timeclock/status',
    'GET /api/waiting-room',
    'GET /api/work-authorizations',
    'GET /api/branding',
    'GET /api/reviews',
    'GET /api/tax-rules',
    'GET /api/profit-margins',
    'GET /api/ar-aging',
    'GET /api/reports',
    'GET /api/automations',
    'GET /api/dtc-lookup',
    'GET /api/referrals',
    'GET /api/messages',
    'GET /api/messages/contacts',
    'GET /api/messages/unread-count',
    'GET /api/payment-links',
    'GET /api/purchase-orders',
    'GET /api/activity-logs',
    'GET /api/analytics/employee-performance',
    'GET /api/analytics/sla',
    'GET /api/payroll/employees',
    'GET /api/payroll/pay-periods',
    'GET /api/payroll/attendance',
    'GET /api/payroll/leave',
    'GET /api/payroll/overtime-rules',
    'GET /api/payroll/paystubs',
    'GET /api/payroll/schedule',
    'GET /api/api-keys',
    'GET /api/permissions',
    'GET /api/sessions',
    'GET /api/webhooks',
    'GET /api/integrations',
    'GET /api/enterprise',
  ],
  tech: [
    'GET /api/tech/tracking',
  ],
  manager: [
    'GET /api/manager/dashboard',
    'GET /api/manager/assignments',
  ],
  customer: [
    'GET /api/customers/profile',
    'GET /api/customers/vehicles',
    'GET /api/customers/estimates',
    'GET /api/customers/messages',
    'GET /api/customers/payments',
    'GET /api/customers/payment-methods',
    'GET /api/customers/favorites',
    'GET /api/customers/documents',
    'GET /api/customers/shops',
    'GET /api/customers/rewards',
    'GET /api/customers/insights',
    'GET /api/customers/recurring-approvals',
    'GET /api/customers/tracking',
    'GET /api/customers/search',
  ],
};

function testAPI(method, path, token) {
  return new Promise((resolve) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Cookie'] = 'sos_auth=' + token;
    const req = http.request({ hostname: 'localhost', port: 3000, path, method, headers }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(body); } catch { parsed = null; }
        const errorMsg = parsed && parsed.error ? parsed.error : '';
        resolve({ method, path, status: res.statusCode, error: errorMsg });
      });
    });
    req.on('error', e => resolve({ method, path, status: 'ERR', error: e.message }));
    req.setTimeout(15000, () => { req.destroy(); resolve({ method, path, status: 'TIMEOUT' }); });
    req.end();
  });
}

async function main() {
  const ok = [], clientErr = [], serverErr = [], notFound = [], errors = [];

  for (const [tokenKey, endpoints] of Object.entries(apis)) {
    const token = tokenKey === 'none' ? null : tokens[tokenKey];
    console.error('Testing ' + endpoints.length + ' ' + tokenKey + ' API endpoints...');
    
    for (let i = 0; i < endpoints.length; i += 5) {
      const batch = endpoints.slice(i, i + 5);
      const results = await Promise.all(batch.map(ep => {
        const [method, path] = ep.split(' ');
        return testAPI(method, path, token);
      }));
      for (const r of results) {
        if (r.status === 200 || r.status === 201) ok.push(r);
        else if (r.status === 404) notFound.push(r);
        else if (r.status >= 400 && r.status < 500) clientErr.push(r);
        else if (r.status >= 500) serverErr.push(r);
        else errors.push(r);
      }
    }
  }

  console.log('\n========== API ENDPOINT RESULTS ==========\n');
  console.log('OK (2xx): ' + ok.length);
  console.log('404 Not Found: ' + notFound.length);
  console.log('Client Errors (4xx): ' + clientErr.length);
  console.log('Server Errors (5xx): ' + serverErr.length);
  console.log('Other Errors: ' + errors.length);

  if (notFound.length > 0) {
    console.log('\n--- 404 NOT FOUND ---');
    notFound.forEach(r => console.log('  ' + r.method + ' ' + r.path));
  }
  if (serverErr.length > 0) {
    console.log('\n--- SERVER ERRORS (5xx) ---');
    serverErr.forEach(r => console.log('  ' + r.status + ' ' + r.method + ' ' + r.path + '  ' + r.error));
  }
  if (clientErr.length > 0) {
    console.log('\n--- CLIENT ERRORS (4xx, not 404) ---');
    clientErr.forEach(r => console.log('  ' + r.status + ' ' + r.method + ' ' + r.path + '  ' + r.error));
  }
  if (errors.length > 0) {
    console.log('\n--- OTHER ERRORS ---');
    errors.forEach(r => console.log('  ' + r.status + ' ' + r.method + ' ' + r.path + '  ' + r.error));
  }
  if (ok.length > 0) {
    console.log('\n--- OK (2xx) ---');
    ok.forEach(r => console.log('  ' + r.status + ' ' + r.method + ' ' + r.path));
  }
}

main();
