import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { marketingMetadata } from '@/lib/publicMetadata';

export const metadata: Metadata = marketingMetadata('/help');

export default function HelpLayout({ children }: { children: ReactNode }) {
  return children;
}
