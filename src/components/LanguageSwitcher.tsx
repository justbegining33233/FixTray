'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  writeLocaleCookie,
  type AppLocale,
} from '@/lib/locale';

type LanguageSwitcherProps = {
  /** Short EN/ES buttons for tight headers. The profile menu uses full names. */
  compact?: boolean;
};

export default function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations('chrome');

  const choose = (next: AppLocale) => {
    if (next === locale) return;
    writeLocaleCookie(next);
    router.refresh();
  };

  return (
    <div
      role="group"
      aria-label={t('language')}
      style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}
    >
      {!compact && (
        <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{t('language')}</span>
      )}
      {SUPPORTED_LOCALES.map((code) => {
        const selected = locale === code;
        return (
          <button
            key={code}
            type="button"
            aria-pressed={selected}
            aria-label={LOCALE_LABELS[code]}
            title={LOCALE_LABELS[code]}
            onClick={() => choose(code)}
            style={{
              padding: compact ? '4px 8px' : '6px 10px',
              borderRadius: 8,
              border: selected ? '1px solid #e5332a' : '1px solid rgba(255,255,255,0.16)',
              background: selected ? 'rgba(229,51,42,0.22)' : 'rgba(0,0,0,0.35)',
              color: '#f8fafc',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              lineHeight: 1.2,
            }}
          >
            {compact ? code.toUpperCase() : LOCALE_LABELS[code]}
          </button>
        );
      })}
    </div>
  );
}
