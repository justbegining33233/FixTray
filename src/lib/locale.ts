/**
 * Languages FixTray offers in the UI.
 *
 * Git history only ever listed English, Spanish, and French
 * (superadmin settings, commit 75ad5bb). French was dropped in 60e5cbb.
 * The rest of this list is the next most common languages spoken at home
 * in the United States (US Census American Community Survey), so shops can
 * serve the customers they actually see. It is not a list recovered from
 * an older FixTray enum.
 */
export const SUPPORTED_LOCALES = [
  'en',
  'es',
  'zh',
  'tl',
  'vi',
  'ar',
  'fr',
  'ko',
  'ru',
  'de',
  'ht',
  'hi',
  'pt',
  'it',
  'pl',
  'ur',
] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'en';

/** Browser cookie set by the language dropdown. Not httpOnly so the client can update it. */
export const LOCALE_COOKIE = 'fixtray_locale';

/** Native names so the menu is readable before the UI language changes. */
export const LOCALE_LABELS: Record<AppLocale, string> = {
  en: 'English',
  es: 'Español',
  zh: '中文',
  tl: 'Tagalog',
  vi: 'Tiếng Việt',
  ar: 'العربية',
  fr: 'Français',
  ko: '한국어',
  ru: 'Русский',
  de: 'Deutsch',
  ht: 'Kreyòl Ayisyen',
  hi: 'हिन्दी',
  pt: 'Português',
  it: 'Italiano',
  pl: 'Polski',
  ur: 'اردو',
};

const LOCALE_BY_BASE: Record<string, AppLocale> = {
  en: 'en',
  es: 'es',
  zh: 'zh',
  tl: 'tl',
  fil: 'tl',
  vi: 'vi',
  ar: 'ar',
  fr: 'fr',
  ko: 'ko',
  ru: 'ru',
  de: 'de',
  ht: 'ht',
  hi: 'hi',
  pt: 'pt',
  it: 'it',
  pl: 'pl',
  ur: 'ur',
};

function localeBase(value: string): string {
  return value.trim().toLowerCase().replace('_', '-').split('-')[0] ?? '';
}

export function isSupportedLocale(value: string | null | undefined): value is AppLocale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** Accepts "es", "es-MX", "zh-CN", and "fil" (Filipino → Tagalog). */
export function isSupportedLocaleInput(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return localeBase(value) in LOCALE_BY_BASE;
}

export function normalizeLocale(value: string | null | undefined): AppLocale {
  if (!value) return DEFAULT_LOCALE;
  return LOCALE_BY_BASE[localeBase(value)] ?? DEFAULT_LOCALE;
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
