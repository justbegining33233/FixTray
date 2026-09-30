import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { HELP_ARTICLES } from '@/lib/helpCenter';
import { marketingMetadata } from '@/lib/publicMetadata';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const known = HELP_ARTICLES.some((article) => article.slug === slug);
  return marketingMetadata(known ? `/help/${slug}` : '/help');
}

export default function HelpArticleLayout({ children }: { children: ReactNode }) {
  return children;
}
