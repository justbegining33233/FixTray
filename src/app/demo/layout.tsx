import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { marketingMetadata } from '@/lib/publicMetadata';

export const metadata: Metadata = marketingMetadata('/demo');

export default function DemoLayout({ children }: { children: ReactNode }) {
  return children;
}
