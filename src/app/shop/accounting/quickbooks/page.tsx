'use client';

import useRequireAuth from '@/lib/useRequireAuth';
import ShopQuickBooksCard from '@/components/ShopQuickBooksCard';
import { pageStyle } from '@/components/books/drillChrome';

export default function QuickBooksPage() {
  const { user, isLoading } = useRequireAuth(['shop', 'accountant']);
  if (isLoading || !user) return null;
  return (
    <div style={pageStyle}>
      <h1 style={{ marginTop: 0 }}>QuickBooks</h1>
      <p style={{ color: '#c4a8a4' }}>Shop sales, payments, and labor. The FixTray fee is not a shop expense.</p>
      {user.role === 'accountant' ? <p style={{ color: '#c4a8a4' }}>Read only. The owner connects QuickBooks.</p> : null}
      <ShopQuickBooksCard readOnly={user.role !== 'shop'} />
    </div>
  );
}
