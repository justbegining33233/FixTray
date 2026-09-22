export const SUPPORTED_LOCALES = ['en', 'es'] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'en';

/** Browser cookie set by the language switcher. Not httpOnly so the client can update it. */
export const LOCALE_COOKIE = 'fixtray_locale';

export const LOCALE_LABELS: Record<AppLocale, string> = {
  en: 'English',
  es: 'Español',
};

function localeBase(value: string): string {
  return value.trim().toLowerCase().replace('_', '-').split('-')[0] ?? '';
}

export function isSupportedLocale(value: string | null | undefined): value is AppLocale {
  return value === 'en' || value === 'es';
}

/** Accepts "es", "es-MX", and "es_MX". Anything else is not a supported choice. */
export function isSupportedLocaleInput(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const base = localeBase(value);
  return base === 'en' || base === 'es';
}

export function normalizeLocale(value: string | null | undefined): AppLocale {
  if (!value) return DEFAULT_LOCALE;
  const base = localeBase(value);
  return base === 'es' ? 'es' : DEFAULT_LOCALE;
}

/**
 * User cookie wins. Otherwise use the platform default saved in Global Settings.
 * Unknown values fall back to English.
 */
export function resolveLocale(input: {
  cookie?: string | null;
  platformDefault?: string | null;
}): AppLocale {
  const cookie = input.cookie?.trim();
  if (cookie) return normalizeLocale(cookie);
  const platformDefault = input.platformDefault?.trim();
  if (platformDefault) return normalizeLocale(platformDefault);
  return DEFAULT_LOCALE;
}

export function writeLocaleCookie(locale: AppLocale) {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; secure' : '';
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax${secure}`;
  document.documentElement.lang = locale;
}
