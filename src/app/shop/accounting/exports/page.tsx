'use client';

import useRequireAuth from '@/lib/useRequireAuth';
import { pageStyle } from '@/components/books/drillChrome';

const LINKS = [
  { href: '/api/shop/books/export', label: 'Books CSV' },
  { href: '/api/shop/accounting/payroll', label: 'Timesheet CSV' },
  { href: '/api/shop/accounting/deposits', label: 'Bank deposits' },
];

export default function AccountingExportsPage() {
  const { user, isLoading } = useRequireAuth(['shop', 'accountant']);
  if (isLoading || !user) return null;
  return (
    <div style={pageStyle}>
      <h1 style={{ marginTop: 0 }}>Exports</h1>
      <p style={{ color: '#c4a8a4' }}>Shop books only. The FixTray fee is not a shop export. Timesheets are hours and rates. FixTray does not run payroll or withhold taxes.</p>
      <ul>
        {LINKS.map((link) => (
          <li key={link.href} style={{ margin: '8px 0' }}>
            <a href={link.href} style={{ color: '#fff' }}>{link.label}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
