import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { marketingMetadata } from '@/lib/publicMetadata';

export const metadata: Metadata = marketingMetadata('/about');

export default function AboutLayout({ children }: { children: ReactNode }) {
  return children;
}
