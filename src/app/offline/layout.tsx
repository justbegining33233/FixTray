import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { NOINDEX_METADATA } from '@/lib/searchIndexing';

export const metadata: Metadata = NOINDEX_METADATA;

export default function OfflineLayout({ children }: { children: ReactNode }) {
  return children;
}
