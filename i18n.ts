// i18n configuration for next-intl.
// Locale comes from the fixtray_locale cookie, then the platform default
// saved in Global Settings. Message files live in ./messages.
import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { LOCALE_COOKIE, resolveLocale, type AppLocale } from './src/lib/locale';
import { readPlatformDefaultLocale } from './src/lib/platformConfig';

async function loadMessages(locale: AppLocale) {
  switch (locale) {
    case 'es':
      return (await import('./messages/es.json')).default;
    default:
      return (await import('./messages/en.json')).default;
  }
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
