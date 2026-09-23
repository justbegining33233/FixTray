'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  writeLocaleCookie,
  type AppLocale,
} from '@/lib/locale';

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations('chrome');

  const choose = (next: string) => {
    if (next === locale) return;
    if (!(SUPPORTED_LOCALES as readonly string[]).includes(next)) return;
    writeLocaleCookie(next as AppLocale);
    router.refresh();
  };

  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 'auto' }}>
      <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, letterSpacing: '0.04em' }}>
        {t('language')}
      </span>
      <select
        aria-label={t('language')}
        value={locale}
        onChange={(event) => choose(event.target.value)}
        style={{
          minWidth: 168,
          maxWidth: 220,
          padding: '6px 8px',
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.16)',
          background: 'rgba(0,0,0,0.55)',
          color: '#f8fafc',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        {SUPPORTED_LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_LABELS[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
