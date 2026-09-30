'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import MarketingShell from '@/components/MarketingShell';
import { usePhrase } from '@/lib/usePhrase';
import { HELP_ARTICLES, helpArticlePath, searchHelpArticles } from '@/lib/helpCenter';

export default function HelpCenterPage() {
  const say = usePhrase();
  const [query, setQuery] = useState('');
  const articles = useMemo(() => searchHelpArticles(query, HELP_ARTICLES), [query]);

  return (
    <MarketingShell>
      <section className="mx-auto max-w-6xl px-6 pt-24 pb-10">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">{say('Help Center')}</p>
        <h1 className="mt-4 text-4xl font-semibold text-white sm:text-5xl">{say('Short how-tos')}</h1>
        <p className="mt-5 max-w-2xl text-lg text-slate-300">
          {say('Search articles for estimates, adding a technician, turn-by-turn directions, and notification flags. Email support is still available.')}
        </p>
        <label className="mt-8 block max-w-xl">
          <span className="sr-only">{say('Search help articles')}</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={say('Search help articles')}
            className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
          />
        </label>
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-24">
        {articles.length === 0 ? (
          <p className="text-slate-300">{say('No articles match that search.')} <Link href="/contact" className="text-white underline">{say('Email support')}</Link></p>
        ) : (
          <div className="grid gap-4">
            {articles.map((article) => (
              <Link
                key={article.slug}
                href={helpArticlePath(article.slug) as Route}
                className="rounded-3xl border border-white/10 bg-black p-6 transition hover:border-white/30"
              >
                <h2 className="text-xl font-semibold text-white">{article.title}</h2>
                <p className="mt-2 text-sm text-slate-300">{article.summary}</p>
              </Link>
            ))}
          </div>
        )}
        <p className="mt-8 text-sm text-slate-400">
          {say('Email support')}: <a className="text-white underline" href="mailto:support@fixtray.app">support@fixtray.app</a>
        </p>
      </section>
    </MarketingShell>
  );
}
