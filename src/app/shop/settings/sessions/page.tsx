'use client';

import ShopSecurityPanel from '@/components/ShopSecurityPanel';
import { useRequireAuth } from '@/contexts/AuthContext';

export default function SessionsPage() {
  useRequireAuth(['shop']);
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 16 }}>
      <ShopSecurityPanel focus="sessions" />
    </div>
  );
}
