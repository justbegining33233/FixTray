const pages = [
  '/admin/home',
  '/admin/shops',
  '/admin/security',
  '/admin/inventory',
  '/admin/messaging',
  '/admin/performance',
  '/admin/manage-tenants',
  '/admin/manage-shops',
  '/admin/command-center',
  '/admin/dashboard',
  '/shop/vendors',
  '/shop/loaners',
  '/shop/fleet',
  '/shop/calendar',
  '/shop/recurring-workorders',
  '/tech/diagnostics',
  '/tech/timesheet',
  '/tech/customers',
  '/manager/dashboard',
  '/manager/assignments',
  '/manager/team',
  '/customer/rewards',
  '/customer/tracking',
];

(async () => {
  console.log('Page Status Check\n' + '='.repeat(60));
  for (const page of pages) {
    try {
      const res = await fetch(`http://localhost:3000${page}`, { 
        redirect: 'manual',
        headers: { 'Cookie': 'token=test' },
        timeout: 3000
      });
      console.log(`${page.padEnd(40)} : ${res.status}`);
    } catch (e) {
      console.log(`${page.padEnd(40)} : ERROR (${e.message})`);
    }
  }
  console.log('='.repeat(60));
})();
