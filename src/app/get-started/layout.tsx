import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { marketingMetadata } from '@/lib/publicMetadata';

export const metadata: Metadata = marketingMetadata('/get-started');

export default function GetStartedLayout({ children }: { children: ReactNode }) {
  return children;
}
