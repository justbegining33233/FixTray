import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { marketingMetadata } from '@/lib/publicMetadata';

export const metadata: Metadata = marketingMetadata('/features');

export default function FeaturesLayout({ children }: { children: ReactNode }) {
  return children;
}
