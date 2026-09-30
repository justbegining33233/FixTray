'use client';

import { useTranslations } from 'next-intl';
import phraseIndex from '@/lib/phraseIndex.json';
import { phraseIndexKey, presentPhrase } from '@/lib/phraseKey';

const index = phraseIndex as Record<string, string>;

/** Look up a catalog phrase by its English source string. Non-strings pass through. */
export function usePhrase() {
  const t = useTranslations('phrases');
  return function say<T>(text: T): T {
    if (typeof text !== 'string' || !text) return text;
    const key = phraseIndexKey(text, index);
    if (!key || !t.has(key)) return text;
    // t.raw keeps {customer_name} and similar tokens as text. say() does not
    // pass interpolation values; formatting them would blank the template hint.
    const raw = t.raw(key);
    const translated = typeof raw === 'string' ? raw : t(key);
    return presentPhrase(text, translated) as T;
  };
}
