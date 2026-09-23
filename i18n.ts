// i18n configuration for next-intl.
// Locale comes from the fixtray_locale cookie, then the platform default
// saved in Global Settings. Message files live in ./messages.
import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { LOCALE_COOKIE, resolveLocale, type AppLocale } from './src/lib/locale';
import { readPlatformDefaultLocale } from './src/lib/platformConfig';

const catalogs: Record<AppLocale, () => Promise<{ default: Record<string, unknown> }>> = {
  en: () => import('./messages/en.json'),
  es: () => import('./messages/es.json'),
  zh: () => import('./messages/zh.json'),
  tl: () => import('./messages/tl.json'),
  vi: () => import('./messages/vi.json'),
  ar: () => import('./messages/ar.json'),
  fr: () => import('./messages/fr.json'),
  ko: () => import('./messages/ko.json'),
  ru: () => import('./messages/ru.json'),
  de: () => import('./messages/de.json'),
  ht: () => import('./messages/ht.json'),
  hi: () => import('./messages/hi.json'),
  pt: () => import('./messages/pt.json'),
  it: () => import('./messages/it.json'),
  pl: () => import('./messages/pl.json'),
  ur: () => import('./messages/ur.json'),
  ka: () => import('./messages/ka.json'),
  bn: () => import('./messages/bn.json'),
  ta: () => import('./messages/ta.json'),
  te: () => import('./messages/te.json'),
  gu: () => import('./messages/gu.json'),
  pa: () => import('./messages/pa.json'),
  mr: () => import('./messages/mr.json'),
};

async function loadMessages(locale: AppLocale) {
  try {
    const load = catalogs[locale] ?? catalogs.en;
    const loaded = await load();
    if (loaded?.default && typeof loaded.default === 'object') return loaded.default;
  } catch (error) {
    console.error(`Locale catalog ${locale} failed to load. Using English.`, error);
  }
  const english = await catalogs.en();
  return english.default;
}

export default getRequestConfig(async () => {
  let cookieValue: string | null = null;
  try {
    const jar = await cookies();
    cookieValue = jar.get(LOCALE_COOKIE)?.value ?? null;
  } catch {
    cookieValue = null;
  }

  const platformDefault = cookieValue ? null : await readPlatformDefaultLocale();
  const locale = resolveLocale({
    cookie: cookieValue,
    platformDefault,
  });

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
