import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { marketingMetadata } from '@/lib/publicMetadata';

export const metadata: Metadata = marketingMetadata('/contact');

export default function ContactLayout({ children }: { children: ReactNode }) {
  return children;
}
