import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HELP_ARTICLES } from '@/lib/helpCenter';
import { marketingMetadata } from '@/lib/publicMetadata';
import { NOINDEX_METADATA } from '@/lib/searchIndexing';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const known = HELP_ARTICLES.some((article) => article.slug === slug);
  if (!known) return NOINDEX_METADATA;
  return marketingMetadata(`/help/${slug}`);
}

export default async function HelpArticleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!HELP_ARTICLES.some((article) => article.slug === slug)) notFound();
  return children;
}
