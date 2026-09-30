import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import {
  normalizeLocale,
  resolveLocale,
  isSupportedLocaleInput,
  SUPPORTED_LOCALES,
} from '../src/lib/locale';
import { platformSettingsUpdate } from '../src/lib/platformSettingsPatch';
import { englishCatalog, readLocaleCatalog } from '../src/lib/messageCatalog';
import { appDocumentTitle, phraseIndexKey, presentPhrase } from '../src/lib/phraseKey';

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    const next = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) return flattenKeys(child, next);
    return [next];
  });
}

function walkFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else if (/\.(tsx|ts)$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('locale resolution', () => {
  it('prefers the browser cookie over the platform default', () => {
    expect(resolveLocale({ cookie: 'es', platformDefault: 'en' })).toBe('es');
    expect(resolveLocale({ cookie: 'en', platformDefault: 'es' })).toBe('en');
    expect(resolveLocale({ cookie: 'fr', platformDefault: 'es' })).toBe('fr');
  });

  it('uses the platform default when no cookie is set', () => {
    expect(resolveLocale({ cookie: null, platformDefault: 'vi' })).toBe('vi');
    expect(resolveLocale({ cookie: '   ', platformDefault: 'es' })).toBe('es');
  });

  it('falls back to English for unknown values', () => {
    expect(normalizeLocale('zz')).toBe('en');
    expect(normalizeLocale(null)).toBe('en');
    expect(resolveLocale({ cookie: 'zz', platformDefault: 'es' })).toBe('en');
    expect(resolveLocale({})).toBe('en');
  });

  it('accepts regional tags and the historical French option', () => {
    expect(normalizeLocale('es-MX')).toBe('es');
    expect(normalizeLocale('es_ES')).toBe('es');
    expect(normalizeLocale('zh-CN')).toBe('zh');
    expect(normalizeLocale('fil')).toBe('tl');
    expect(normalizeLocale('fr')).toBe('fr');
    expect(normalizeLocale('ru')).toBe('ru');
    expect(normalizeLocale('ka')).toBe('ka');
    expect(normalizeLocale('bn-IN')).toBe('bn');
    expect(normalizeLocale('pa')).toBe('pa');
    expect(normalizeLocale('mr')).toBe('mr');
    expect(isSupportedLocaleInput('es-MX')).toBe(true);
    expect(isSupportedLocaleInput('fr')).toBe(true);
    expect(isSupportedLocaleInput('ka')).toBe(true);
    expect(isSupportedLocaleInput('ta')).toBe(true);
    expect(isSupportedLocaleInput('te')).toBe(true);
    expect(isSupportedLocaleInput('gu')).toBe(true);
    expect(isSupportedLocaleInput('zz')).toBe(false);
    expect(isSupportedLocaleInput(1)).toBe(false);
    expect(SUPPORTED_LOCALES).toHaveLength(23);
  });
});

describe('platform language setting', () => {
  it('stores a supported language and rejects unknown codes', () => {
    expect(platformSettingsUpdate({ defaultLanguage: 'es' }).data).toEqual({ defaultLanguage: 'es' });
    expect(platformSettingsUpdate({ defaultLanguage: 'es-MX' }).data).toEqual({ defaultLanguage: 'es' });
    expect(platformSettingsUpdate({ defaultLanguage: 'fr' }).data).toEqual({ defaultLanguage: 'fr' });
    expect(platformSettingsUpdate({ defaultLanguage: 'ht' }).data).toEqual({ defaultLanguage: 'ht' });
    expect(platformSettingsUpdate({ defaultLanguage: 'ru' }).data).toEqual({ defaultLanguage: 'ru' });
    expect(platformSettingsUpdate({ defaultLanguage: 'ka' }).data).toEqual({ defaultLanguage: 'ka' });
    expect(platformSettingsUpdate({ defaultLanguage: 'bn' }).data).toEqual({ defaultLanguage: 'bn' });
    expect(platformSettingsUpdate({ defaultLanguage: 'zz' }).error).toMatch(/Unsupported language/);
    expect(platformSettingsUpdate({ defaultLanguage: 'zz' }).data).toEqual({});
  });

  it('keeps the existing fee and name fields', () => {
    expect(platformSettingsUpdate({
      platformName: 'FixTray',
      serviceFeeRaw: 500,
      maintenanceMode: false,
      defaultLanguage: 'en',
    }).data).toEqual({
      platformName: 'FixTray',
      serviceFee: 500,
      maintenanceMode: false,
      defaultLanguage: 'en',
    });
    expect(platformSettingsUpdate({ serviceFee: 1000 }).data.serviceFee).toBe(1000);
    expect(platformSettingsUpdate({ serviceFee: 1000, serviceFeeRaw: 750 }).data.serviceFee).toBe(750);
  });
});

describe('catalog fallback', () => {
  it('returns null for a missing or unsafe locale and keeps English readable', () => {
    expect(readLocaleCatalog('zz')).toBeNull();
    expect(readLocaleCatalog('../en')).toBeNull();
    expect(readLocaleCatalog('ka')).not.toBeNull();
    expect(englishCatalog()).toEqual(readLocaleCatalog('en'));
  });
});

describe('message catalogs', () => {
  const root = path.join(__dirname, '..');

  it('gives every locale the same keys as English', () => {
    const en = JSON.parse(fs.readFileSync(path.join(root, 'messages/en.json'), 'utf8'));
    const enKeys = flattenKeys(en).sort();
    for (const locale of SUPPORTED_LOCALES) {
      const file = path.join(root, `messages/${locale}.json`);
      const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));
      expect(flattenKeys(catalog).sort()).toEqual(enKeys);
    }
  });

  it('indexes every literal passed to say()', () => {
    const index = JSON.parse(fs.readFileSync(path.join(root, 'src/lib/phraseIndex.json'), 'utf8')) as Record<string, string>;
    const sayRe = /say\(\s*'([^'\\]*(?:\\.[^'\\]*)*)'\s*\)|say\(\s*"([^"\\]*(?:\\.[^"\\]*)*)"\s*\)/g;
    const missing: string[] = [];
    for (const file of walkFiles(path.join(root, 'src'))) {
      const src = fs.readFileSync(file, 'utf8');
      sayRe.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = sayRe.exec(src))) {
        const text = (match[1] || match[2] || '').replace(/\\'/g, "'");
        if (!text || text.includes('${')) continue;
        if (!index[text]) missing.push(`${path.relative(root, file)}: ${text}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('looks up a newline phrase when the catalog stored a literal backslash-n', () => {
    const index = JSON.parse(fs.readFileSync(path.join(root, 'src/lib/phraseIndex.json'), 'utf8')) as Record<string, string>;
    const src = fs.readFileSync(path.join(root, 'src/app/shop/complete-profile/page.tsx'), 'utf8');
    const match = src.match(/say\("(By signing, you confirm[^"]*)"\)/);
    expect(match).not.toBeNull();
    const runtime = (match?.[1] ?? '').replaceAll('\\n', '\n');
    expect(runtime.includes('\n')).toBe(true);
    const key = phraseIndexKey(runtime, index);
    expect(key).toBe('by_signing_you_confirm_your_shop_details_are_accurate_you_are_authorized_to_operate_this_busines');
    const es = JSON.parse(fs.readFileSync(path.join(root, 'messages/es.json'), 'utf8'));
    const shown = presentPhrase(runtime, es.phrases[key]);
    expect(shown.includes('\n')).toBe(true);
    expect(shown.includes('\\n')).toBe(false);
    expect(shown.toLowerCase()).toContain('taller');
  });

  it('builds the document title from the work-order phrase', () => {
    expect(appDocumentTitle('Work Order Management')).toBe('FixTray - Work Order Management');
    const es = JSON.parse(fs.readFileSync(path.join(root, 'messages/es.json'), 'utf8'));
    expect(appDocumentTitle(es.phrases.work_order_management_2)).toBe('FixTray - Gestión de órdenes de trabajo');
  });

  it('uses workshop, manufacturer, work-order, service-bay, and app-screen senses', () => {
    const es = JSON.parse(fs.readFileSync(path.join(root, 'messages/es.json'), 'utf8'));
    const de = JSON.parse(fs.readFileSync(path.join(root, 'messages/de.json'), 'utf8'));
    const zh = JSON.parse(fs.readFileSync(path.join(root, 'messages/zh.json'), 'utf8'));
    expect(es.phrases.shop).toBe('Taller');
    expect(es.phrases.make).toBe('Marca *');
    expect(es.phrases.open_jobs).toBe('Órdenes abiertas');
    expect(es.phrases.open_jobs.toLowerCase()).not.toContain('empleo');
    expect(es.phrases.bay.toLowerCase()).toContain('servicio');
    expect(es.phrases.dashboard).toBe('Panel');
    expect(es.phrases.member_since).toBe('Cliente desde:');
    expect(es.validation.minLength).toContain('{min}');
    expect(de.phrases.dashboard).not.toContain('Armaturenbrett');
    expect(de.phrases.to_shop).toBe('Zur Werkstatt');
    expect(zh.phrases.jobs).toBe('工单');
    expect(zh.phrases.dashboard).toBe('控制面板');
    expect(zh.phrases.view_jobs).toBe('查看工单');
  });

  it('keeps interpolation tokens aligned with the English source', () => {
    const en = JSON.parse(fs.readFileSync(path.join(root, 'messages/en.json'), 'utf8'));
    const identRe = /\{\{?[A-Za-z_][A-Za-z0-9_]*\}?\}/g;
    const walk = (value: unknown, prefix: string, out: Array<[string, string]>) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return;
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        const next = prefix ? `${prefix}.${key}` : key;
        if (typeof child === 'string') out.push([next, child]);
        else walk(child, next, out);
      }
    };
    const enPairs: Array<[string, string]> = [];
    walk(en, '', enPairs);
    for (const locale of SUPPORTED_LOCALES) {
      if (locale === 'en') continue;
      const catalog = JSON.parse(fs.readFileSync(path.join(root, `messages/${locale}.json`), 'utf8'));
      const pairs: Array<[string, string]> = [];
      walk(catalog, '', pairs);
      const map = new Map(pairs);
      for (const [key, english] of enPairs) {
        const tokens = english.match(identRe);
        if (!tokens) continue;
        const translated = map.get(key) ?? '';
        for (const token of tokens) expect(translated).toContain(token);
      }
    }
  });
});
