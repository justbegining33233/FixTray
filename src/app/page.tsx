import type { Metadata } from 'next';
import MarketingHome from '@/components/MarketingHome';
import { marketingMetadata } from '@/lib/publicMetadata';

export const metadata: Metadata = marketingMetadata('/');

export default function HomePage() {
  return <MarketingHome />;
}
