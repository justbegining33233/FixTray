import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { NOINDEX_METADATA } from '@/lib/searchIndexing';

export const metadata: Metadata = NOINDEX_METADATA;

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="role-route-shell">
      <div
        style={{
          position: 'fixed',
          top: 12,
          right: 12,
          zIndex: 50,
          width: 'auto',
        }}
      >
        <LanguageSwitcher />
      </div>
      <div data-page-shell>{children}</div>
    </div>
  );
}
