import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import { HELP_ARTICLES, helpArticlePath } from '../src/lib/helpCenter';
import {
  marketingMetadata,
  PUBLIC_SITE_DESCRIPTION,
  PUBLIC_SITE_ORIGIN,
  PUBLIC_SITE_TITLE,
} from '../src/lib/publicMetadata';
import { PUBLIC_AND_ADMIN_REDIRECTS } from '../src/lib/publicRedirects';

const root = path.join(__dirname, '..');

const retiredPhrases = [
  'Request a demo',
  'Book a demo',
  'Mobile tech suite',
  'Offline capture and sync',
  'API routes in production',
  'Realtime + automation',
  'The full stack for world-class work orders',
];

const marketingFiles = [
  'src/components/MarketingHome.tsx',
  'src/components/MarketingShell.tsx',
  'src/app/features/page.tsx',
  'src/app/about/page.tsx',
  'src/app/contact/page.tsx',
  'src/app/security/page.tsx',
  'src/app/privacy/page.tsx',
  'src/app/terms/page.tsx',
  'src/app/get-started/page.tsx',
  'src/app/help/page.tsx',
  'src/app/not-found.tsx',
];

describe('public marketing copy', () => {
  it('drops the retired oversell from public pages and the English catalog', () => {
    for (const file of marketingFiles) {
      const src = fs.readFileSync(path.join(root, file), 'utf8');
      for (const phrase of retiredPhrases) {
        expect(src.includes(phrase)).toBe(false);
      }
      expect(src.includes('150+')).toBe(false);
    }
    const phrases = JSON.parse(fs.readFileSync(path.join(root, 'messages/en.json'), 'utf8')).phrases as Record<string, string>;
    const visible = Object.values(phrases).join('\n');
    for (const phrase of retiredPhrases) {
      expect(visible.includes(phrase)).toBe(false);
    }
    const index = JSON.parse(fs.readFileSync(path.join(root, 'src/lib/phraseIndex.json'), 'utf8')) as Record<string, string>;
    for (const phrase of retiredPhrases) {
      expect(index[phrase]).toBeUndefined();
    }
    expect(index['Contact us']).toBe('request_a_demo');
    expect(index['Save a job for offline use']).toBe('offline_capture_and_sync');
    expect(index['Free']).toBe('free');
  });

  it('keeps real product lines and the contact response promise', () => {
    const features = fs.readFileSync(path.join(root, 'src/app/features/page.tsx'), 'utf8');
    const home = fs.readFileSync(path.join(root, 'src/components/MarketingHome.tsx'), 'utf8');
    const contact = fs.readFileSync(path.join(root, 'src/app/contact/page.tsx'), 'utf8');
    expect(features).toContain('SLA timing for completed jobs');
    expect(features).toContain('Email and text campaigns, plus reminder messages');
    expect(features).toContain('Save a job for offline use');
    expect(features).toContain('A mobile app is in development.');
    expect(home).toContain('A mobile app is in development.');
    expect(home).not.toContain('no mobile app');
    expect(contact).toContain('Expect a response within one business day.');
  });

  it('shows a real apostrophe on the 404 page', () => {
    const src = fs.readFileSync(path.join(root, 'src/app/not-found.tsx'), 'utf8');
    expect(src).not.toContain('&apos;');
    expect(src).not.toContain('&amp;');
    expect(src).toContain("The page you're looking for doesn't exist or has been moved.");
  });

  it('describes FixTray and points search metadata at the public site', () => {
    const home = marketingMetadata('/');
    expect(home.title).toBe(PUBLIC_SITE_TITLE);
    expect(PUBLIC_SITE_TITLE.startsWith('FixTray')).toBe(true);
    expect(home.description).toBe(PUBLIC_SITE_DESCRIPTION);
    expect(PUBLIC_SITE_DESCRIPTION).toContain('free work-order system');
    expect(PUBLIC_SITE_DESCRIPTION).toContain('mobile app is in development');
    expect(home.alternates?.canonical).toBe(PUBLIC_SITE_ORIGIN);
    expect(home.openGraph?.url).toBe(PUBLIC_SITE_ORIGIN);
    expect(home.openGraph?.siteName).toBe('FixTray');
    expect(marketingMetadata('/features').alternates?.canonical).toBe(`${PUBLIC_SITE_ORIGIN}/features`);
    const sources = PUBLIC_AND_ADMIN_REDIRECTS.map((row) => row.source);
    expect(sources).not.toContain('/docs');
    expect(sources).not.toContain('/blog');
    expect(sources).toContain('/pricing');
    const sitemap = fs.readFileSync(path.join(root, 'src/app/sitemap.ts'), 'utf8');
    expect(sitemap).not.toContain("'/docs'");
    expect(sitemap).not.toContain("'/blog'");
    expect(sitemap).toContain('HELP_ARTICLES');
    for (const article of HELP_ARTICLES) {
      expect(helpArticlePath(article.slug).startsWith('/help/')).toBe(true);
    }
  });
});
