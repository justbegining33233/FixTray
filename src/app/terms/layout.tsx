import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { marketingMetadata } from '@/lib/publicMetadata';

export const metadata: Metadata = marketingMetadata('/terms');

export default function TermsLayout({ children }: { children: ReactNode }) {
  return children;
}
