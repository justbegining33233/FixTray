'use client';

import ShopSecurityPanel from '@/components/ShopSecurityPanel';

export default function TwoFactorSettingsPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 16 }}>
      <ShopSecurityPanel focus="twoFactor" />
    </div>
  );
}
