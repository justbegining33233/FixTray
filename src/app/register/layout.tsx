import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { NOINDEX_METADATA } from '@/lib/searchIndexing';

export const metadata: Metadata = NOINDEX_METADATA;

export default function RegisterLayout({ children }: { children: ReactNode }) {
  return (
    <div className="role-route-shell">
      <div data-page-shell>{children}</div>
    </div>
  );
}
