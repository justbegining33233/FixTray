import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { marketingMetadata } from '@/lib/publicMetadata';

export const metadata: Metadata = marketingMetadata('/privacy');

export default function PrivacyLayout({ children }: { children: ReactNode }) {
  return children;
}
