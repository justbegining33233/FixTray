// Test all page routes for blank/error content
const http = require('http');

const tokens = {
  shop: process.env.SHOP_TOKEN,
  tech: process.env.TECH_TOKEN,
  manager: process.env.MGR_TOKEN,
  customer: process.env.CUST_TOKEN,
};

const routes = {
  public: [
    '/', '/offline', '/pricing', '/features', '/contact', '/security', '/reports', '/about',
    '/payment/cancel', '/payment/success', '/register/success', '/register/customer', '/register/canceled',
    '/auth/login', '/auth/register/shop', '/auth/register/shop/client', '/auth/reset',
    '/auth/thank-you', '/auth/pending-approval',
    '/workorders/list', '/workorders/new', '/workorders/inshop',
  ],
  shop: [
    '/shop/home', '/shop/admin', '/shop/admin/settings', '/shop/admin/logs', '/shop/admin/health',
    '/shop/analytics', '/shop/analytics/performance', '/shop/analytics/sla',
    '/shop/ar-aging', '/shop/automations', '/shop/bays', '/shop/branding', '/shop/calendar',
    '/shop/campaigns', '/shop/complete-profile', '/shop/condition-reports', '/shop/core-returns',
    '/shop/customer-messages', '/shop/customer-reports', '/shop/dvi', '/shop/environmental-fees',
    '/shop/eod-report', '/shop/fleet', '/shop/inspections', '/shop/integrations',
    '/shop/inventory', '/shop/inventory/shared', '/shop/loaners', '/shop/locations',
    '/shop/manage-team', '/shop/new-inshop-job', '/shop/parts-labor', '/shop/payment-links',
    '/shop/payroll', '/shop/profile', '/shop/profit-margins', '/shop/purchase-orders',
    '/shop/recurring-workorders', '/shop/referrals', '/shop/reports', '/shop/reviews',
    '/shop/services', '/shop/settings', '/shop/settings/api-keys', '/shop/settings/permissions',
    '/shop/settings/schedule', '/shop/settings/sessions', '/shop/settings/two-factor',
    '/shop/settings/webhooks', '/shop/subscribe', '/shop/tax-settings', '/shop/templates',
    '/shop/timeclock', '/shop/vendors', '/shop/waiting-room', '/shop/work-authorizations',
  ],
  tech: [
    '/tech/home', '/tech/all-tools', '/tech/customers', '/tech/diagnostics', '/tech/dtc-lookup',
    '/tech/dvi', '/tech/enhanced', '/tech/inventory', '/tech/manuals', '/tech/messages',
    '/tech/new-inshop-job', '/tech/new-roadside-job', '/tech/photos', '/tech/profile',
    '/tech/settings/two-factor', '/tech/share-location', '/tech/timeclock', '/tech/timesheet',
  ],
  manager: [
    '/manager/home', '/manager/admin/logs', '/manager/admin/settings', '/manager/approvals',
    '/manager/assignments', '/manager/dashboard', '/manager/estimates',
    '/manager/inspections', '/manager/inventory', '/manager/messages', '/manager/overview',
    '/manager/payroll', '/manager/profile', '/manager/recurring-workorders', '/manager/reports',
    '/manager/schedule', '/manager/settings', '/manager/settings/permissions',
    '/manager/settings/two-factor', '/manager/team', '/manager/templates', '/manager/timeclock',
    '/manager/work-authorizations',
  ],
  customer: [
    '/customer/home', '/customer/appointments', '/customer/appointments/new',
    '/customer/dashboard', '/customer/documents', '/customer/estimates',
    '/customer/favorites', '/customer/features', '/customer/findshops', '/customer/history',
    '/customer/insights', '/customer/messages', '/customer/notifications', '/customer/overview',
    '/customer/pay/test', '/customer/payments', '/customer/profile', '/customer/recurring-approvals',
    '/customer/reviews', '/customer/rewards', '/customer/tracking', '/customer/vehicles',
  ],
  admin: [
    '/admin/home', '/admin/accepted-shops', '/admin/activity-logs', '/admin/admin-tools',
    '/admin/backup-restore', '/admin/command-center', '/admin/coupons', '/admin/dashboard',
    '/admin/email-templates', '/admin/enhanced', '/admin/financial-reports', '/admin/guide',
    '/admin/login', '/admin/manage-customers', '/admin/manage-shops', '/admin/manage-tenants',
    '/admin/messages', '/admin/pending-shops', '/admin/platform-analytics', '/admin/profile',
    '/admin/revenue', '/admin/security-settings', '/admin/sessions', '/admin/settings',
    '/admin/subscriptions', '/admin/system-settings', '/admin/test', '/admin/user-management',
  ],
  superadmin: [
    '/superadmin/analytics', '/superadmin/dashboard', '/superadmin/deployments',
    '/superadmin/infrastructure', '/superadmin/profile', '/superadmin/security',
    '/superadmin/settings', '/superadmin/tenants', '/superadmin/users',
  ],
};

function fetchPage(url, token) {
  return new Promise((resolve) => {
    const headers = { 'Accept': 'text/html' };
    if (token) {
      headers['Cookie'] = `sos_auth=${token}`;
    }
    const req = http.get(`http://localhost:3000${url}`, { headers, timeout: 10000 }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({ url, status: res.statusCode, size: body.length, redirect: res.headers.location || null, body });
      });
    });
    req.on('error', (err) => resolve({ url, status: 0, size: 0, error: err.message, body: '' }));
    req.on('timeout', () => { req.destroy(); resolve({ url, status: 0, size: 0, error: 'TIMEOUT', body: '' }); });
  });
}

async function testRoutes(role, routeList, token) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TESTING ${role.toUpperCase()} ROUTES (${routeList.length} pages)`);
  console.log('='.repeat(60));
  
  const problems = [];
  
  for (const url of routeList) {
    const result = await fetchPage(url, token);
    
    // Check for problems
    let issue = null;
    if (result.error) {
      issue = `ERROR: ${result.error}`;
    } else if (result.status === 500) {
      issue = `500 SERVER ERROR`;
    } else if (result.status === 404) {
      issue = `404 NOT FOUND`;
    } else if (result.status >= 300 && result.status < 400) {
      // Redirects are OK - just note them
      console.log(`  [${result.status}] ${url} → ${result.redirect} (${result.size}b)`);
      continue;
    } else if (result.size < 500) {
      issue = `TINY RESPONSE (${result.size}b) - likely blank`;
    } else {
      // Check for error indicators in body
      const bodyLower = result.body.toLowerCase();
      if (bodyLower.includes('application error') || bodyLower.includes('internal server error')) {
        issue = `ERROR PAGE in HTML`;
      } else if (bodyLower.includes('<!doctype') && !bodyLower.includes('__next')) {
        issue = `NO NEXT.JS SHELL - possible error page`;
      }
    }
    
    if (issue) {
      problems.push({ url, status: result.status, size: result.size, issue });
      console.log(`  *** [${result.status}] ${url} - ${issue} (${result.size}b)`);
    } else {
      console.log(`  [${result.status}] ${url} (${result.size}b)`);
    }
  }
  
  if (problems.length > 0) {
    console.log(`\n  PROBLEMS FOUND: ${problems.length}`);
    for (const p of problems) {
      console.log(`    - ${p.url}: ${p.issue}`);
    }
  } else {
    console.log(`\n  All ${routeList.length} routes OK`);
  }
  
  return problems;
}

async function main() {
  console.log('FixTray Page Route Tester');
  console.log('Testing all pages for blank/error responses...\n');
  
  const allProblems = [];
  
  allProblems.push(...await testRoutes('public', routes.public, null));
  allProblems.push(...await testRoutes('shop', routes.shop, tokens.shop));
  allProblems.push(...await testRoutes('tech', routes.tech, tokens.tech));
  allProblems.push(...await testRoutes('manager', routes.manager, tokens.manager));
  allProblems.push(...await testRoutes('customer', routes.customer, tokens.customer));
  // Admin and superadmin use shop token (admin role) - we don't have admin creds, test without auth
  allProblems.push(...await testRoutes('admin', routes.admin, null));
  allProblems.push(...await testRoutes('superadmin', routes.superadmin, null));
  
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  
  const totalRoutes = Object.values(routes).reduce((sum, r) => sum + r.length, 0);
  console.log(`Total routes tested: ${totalRoutes}`);
  console.log(`Problems found: ${allProblems.length}`);
  
  if (allProblems.length > 0) {
    console.log('\nALL PROBLEMS:');
    for (const p of allProblems) {
      console.log(`  ${p.url} [${p.status}] - ${p.issue}`);
    }
  }
}

main().catch(console.error);
