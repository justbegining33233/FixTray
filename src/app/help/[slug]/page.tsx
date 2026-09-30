'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import MarketingShell from '@/components/MarketingShell';
import { usePhrase } from '@/lib/usePhrase';
import { HELP_ARTICLES } from '@/lib/helpCenter';

export default function HelpArticlePage() {
  const say = usePhrase();
  const params = useParams<{ slug: string }>();
  const article = HELP_ARTICLES.find((item) => item.slug === params?.slug);

  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-6 pt-24 pb-24">
        <Link href="/help" className="text-sm text-slate-400 hover:text-white">{say('Help Center')}</Link>
        {article ? (
          <>
            <h1 className="mt-4 text-4xl font-semibold text-white">{article.title}</h1>
            <p className="mt-4 text-lg text-slate-300">{article.summary}</p>
            <div className="mt-8 space-y-4 text-slate-200">
              {article.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-3xl font-semibold text-white">{say('Article not found')}</h1>
            <p className="mt-4 text-slate-300">{say('That how-to is not in the help center.')}</p>
          </>
        )}
        <p className="mt-10 text-sm text-slate-400">
          {say('Email support')}: <a className="text-white underline" href="mailto:support@fixtray.app">support@fixtray.app</a>
        </p>
      </article>
    </MarketingShell>
  );
}
