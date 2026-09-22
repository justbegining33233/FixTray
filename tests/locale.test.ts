import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import {
  normalizeLocale,
  resolveLocale,
  isSupportedLocaleInput,
} from '../src/lib/locale';
import { platformSettingsUpdate } from '../src/lib/platformSettingsPatch';

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    const next = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) return flattenKeys(child, next);
    return [next];
  });
}

describe('locale resolution', () => {
  it('prefers the browser cookie over the platform default', () => {
    expect(resolveLocale({ cookie: 'es', platformDefault: 'en' })).toBe('es');
    expect(resolveLocale({ cookie: 'en', platformDefault: 'es' })).toBe('en');
  });

  it('uses the platform default when no cookie is set', () => {
    expect(resolveLocale({ cookie: null, platformDefault: 'es' })).toBe('es');
    expect(resolveLocale({ cookie: '   ', platformDefault: 'es' })).toBe('es');
  });

  it('falls back to English for unknown values', () => {
    expect(normalizeLocale('fr')).toBe('en');
    expect(normalizeLocale(null)).toBe('en');
    expect(resolveLocale({ cookie: 'fr', platformDefault: 'es' })).toBe('en');
    expect(resolveLocale({})).toBe('en');
  });

  it('accepts regional Spanish tags', () => {
    expect(normalizeLocale('es-MX')).toBe('es');
    expect(normalizeLocale('es_ES')).toBe('es');
    expect(isSupportedLocaleInput('es-MX')).toBe(true);
    expect(isSupportedLocaleInput('fr')).toBe(false);
    expect(isSupportedLocaleInput(1)).toBe(false);
  });
});

describe('platform language setting', () => {
  it('stores English or Spanish and rejects other languages', () => {
    expect(platformSettingsUpdate({ defaultLanguage: 'es' }).data).toEqual({ defaultLanguage: 'es' });
    expect(platformSettingsUpdate({ defaultLanguage: 'es-MX' }).data).toEqual({ defaultLanguage: 'es' });
    expect(platformSettingsUpdate({ defaultLanguage: 'fr' }).error).toMatch(/Unsupported language/);
    expect(platformSettingsUpdate({ defaultLanguage: 'fr' }).data).toEqual({});
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
  });
});

describe('message catalogs', () => {
  it('gives English and Spanish the same keys', () => {
    const en = JSON.parse(fs.readFileSync(path.join(__dirname, '../messages/en.json'), 'utf8'));
    const es = JSON.parse(fs.readFileSync(path.join(__dirname, '../messages/es.json'), 'utf8'));
    expect(flattenKeys(es).sort()).toEqual(flattenKeys(en).sort());
  });
});
