import type { Metadata } from 'next';
import NotFoundScreen from '@/components/NotFoundScreen';
import { NOINDEX_METADATA } from '@/lib/searchIndexing';

export const metadata: Metadata = {
  ...NOINDEX_METADATA,
  title: 'Page not found | FixTray',
};

export default function NotFound() {
  return <NotFoundScreen />;
}
