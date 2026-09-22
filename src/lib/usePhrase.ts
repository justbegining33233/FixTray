'use client';

import { useTranslations } from 'next-intl';
import phraseIndex from '@/lib/phraseIndex.json';

const index = phraseIndex as Record<string, string>;

/** Look up a catalog phrase by its English source string. */
export function usePhrase() {
  const t = useTranslations('phrases');
  return (text: string) => {
    if (!text) return text;
    const key = index[text];
    if (!key || !t.has(key)) return text;
    return t(key);
  };
}
