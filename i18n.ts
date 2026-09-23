// i18n configuration for next-intl.
// Locale comes from the fixtray_locale cookie, then the platform default
// saved in Global Settings. Message files live in ./messages.
// A missing or half-written catalog must not 500 the app: fall back to English.
import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { LOCALE_COOKIE, resolveLocale, type AppLocale } from './src/lib/locale';
import { readPlatformDefaultLocale } from './src/lib/platformConfig';
import { englishCatalog, readLocaleCatalog } from './src/lib/messageCatalog';

async function importCatalog(locale: AppLocale): Promise<Record<string, unknown> | null> {
  if (locale === 'en') return englishCatalog();
  try {
    const imported = await import(
      /* webpackInclude: /(en|es|zh|tl|vi|ar|fr|ko|ru|de|ht|hi|pt|it|pl|ur|ka|bn|ta|te|gu|pa|mr)\.json$/ */
      `./messages/${locale}.json`
    );
    const data = imported?.default;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }
  } catch (error) {
    console.error(`Locale catalog ${locale} import failed. Using a safe fallback.`, error);
  }
  return readLocaleCatalog(locale);
}

async function loadMessages(locale: AppLocale): Promise<Record<string, unknown>> {
  return (await importCatalog(locale)) ?? englishCatalog();
}

function onIntlError(error: { code?: string; message?: string }) {
  console.error(`Translation lookup failed (${error.code ?? 'unknown'}). Showing fallback text.`);
}

function messageFallback(info: { key: string }) {
  return info.key;
}

export default getRequestConfig(async () => {
  try {
    let cookieValue: string | null = null;
    try {
      const jar = await cookies();
      cookieValue = jar.get(LOCALE_COOKIE)?.value ?? null;
    } catch {
      cookieValue = null;
    }

    let platformDefault: string | null = null;
    if (!cookieValue) {
      try {
        platformDefault = await readPlatformDefaultLocale();
      } catch {
        platformDefault = null;
      }
    }

    const locale = resolveLocale({
      cookie: cookieValue,
      platformDefault,
    });

    return {
      locale,
      messages: await loadMessages(locale),
      onError: onIntlError,
      getMessageFallback: messageFallback,
    };
  } catch (error) {
    console.error('Locale setup failed. Using English.', error);
    return {
      locale: 'en' as const,
      messages: englishCatalog(),
      onError: onIntlError,
      getMessageFallback: messageFallback,
    };
  }
});
