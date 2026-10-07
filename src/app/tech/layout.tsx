import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import LayoutClient from './LayoutClient';
import { NOINDEX_METADATA } from '@/lib/searchIndexing';

export const metadata: Metadata = NOINDEX_METADATA;

export default function TechLayout({ children }: { children: ReactNode }) {
  return <LayoutClient>{children}</LayoutClient>;
}
