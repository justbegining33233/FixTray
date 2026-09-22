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
};

async function loadMessages(locale: AppLocale) {
  const load = catalogs[locale] ?? catalogs.en;
  return (await load()).default;
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
