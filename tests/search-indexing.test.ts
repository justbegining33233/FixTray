import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import robots from '../src/app/robots';
import sitemap from '../src/app/sitemap';
import { HELP_ARTICLES, helpArticlePath } from '../src/lib/helpCenter';
import { marketingMetadata, PUBLIC_SITE_ORIGIN, publicCanonicalUrl } from '../src/lib/publicMetadata';
import { PUBLIC_AND_ADMIN_REDIRECTS } from '../src/lib/publicRedirects';
import { isNoindexPath, PRIVATE_PATH_PREFIXES, setNoindexHeader } from '../src/lib/searchIndexing';

const root = path.join(__dirname, '..');

function sitemapPath(url: string): string {
  if (url === PUBLIC_SITE_ORIGIN || url === `${PUBLIC_SITE_ORIGIN}/`) return '/';
  return url.slice(PUBLIC_SITE_ORIGIN.length);
}

describe('search indexing', () => {
  it('keeps the sitemap to public canonical pages and disallows private prefixes', () => {
    const entries = sitemap();
    const sources = new Set(PUBLIC_AND_ADMIN_REDIRECTS.map((row) => row.source));
    expect(entries.length).toBe(10 + HELP_ARTICLES.length);
    expect(entries.map((entry) => entry.url)).toContain(publicCanonicalUrl('/'));
    expect(entries.map((entry) => entry.url)).toContain(publicCanonicalUrl('/help/approve-an-estimate'));

    for (const entry of entries) {
      const pagePath = sitemapPath(entry.url);
      expect(entry.url).toBe(publicCanonicalUrl(pagePath));
      expect(sources.has(pagePath)).toBe(false);
      for (const prefix of PRIVATE_PATH_PREFIXES) {
        const bare = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
        const hit = pagePath === bare || pagePath.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`);
        expect(hit).toBe(false);
      }
    }

    const robot = robots();
    expect(robot.host).toBeUndefined();
    expect(robot.sitemap).toBe(`${PUBLIC_SITE_ORIGIN}/sitemap.xml`);
    const rules = Array.isArray(robot.rules) ? robot.rules[0] : robot.rules;
    expect(rules.allow).toBe('/');
    expect(rules.disallow).toEqual([...PRIVATE_PATH_PREFIXES]);
  });

  it('gives each public page its own title and description', () => {
    const metas = sitemap().map((entry) => marketingMetadata(sitemapPath(entry.url)));
    const titles = metas.map((meta) => meta.title);
    const descriptions = metas.map((meta) => meta.description);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
    for (const description of descriptions) {
      expect(String(description)).not.toMatch(/\$\d/);
    }
    expect(marketingMetadata('/').alternates?.canonical).toBe(publicCanonicalUrl('/'));
    expect(sitemap()[0].url).toBe(marketingMetadata('/').alternates?.canonical);
    for (const article of HELP_ARTICLES) {
      const meta = marketingMetadata(helpArticlePath(article.slug));
      expect(meta.title).not.toBe(marketingMetadata('/help').title);
      expect(String(meta.title)).toContain('| FixTray Help');
      expect(meta.alternates?.canonical).toBe(publicCanonicalUrl(helpArticlePath(article.slug)));
    }
  });

  it('marks private prefixes noindex, including auth redirects and /api', () => {
    expect(isNoindexPath('/shop')).toBe(true);
    expect(isNoindexPath('/manager/home')).toBe(true);
    expect(isNoindexPath('/tech')).toBe(true);
    expect(isNoindexPath('/tech-offline')).toBe(false);
    expect(isNoindexPath('/customer')).toBe(true);
    expect(isNoindexPath('/admin')).toBe(true);
    expect(isNoindexPath('/superadmin')).toBe(true);
    expect(isNoindexPath('/auth/login')).toBe(true);
    expect(isNoindexPath('/auth/reset')).toBe(true);
    expect(isNoindexPath('/auth/thank-you')).toBe(true);
    expect(isNoindexPath('/auth/register/shop')).toBe(true);
    expect(isNoindexPath('/workorders')).toBe(true);
    expect(isNoindexPath('/reports')).toBe(true);
    expect(isNoindexPath('/payment/success')).toBe(true);
    expect(isNoindexPath('/sign/token')).toBe(true);
    expect(isNoindexPath('/register/customer')).toBe(true);
    expect(isNoindexPath('/offline')).toBe(true);
    expect(isNoindexPath('/forbidden')).toBe(true);
    expect(isNoindexPath('/api')).toBe(true);
    expect(isNoindexPath('/api/contact')).toBe(true);
    expect(isNoindexPath('/features')).toBe(false);
    expect(isNoindexPath('/')).toBe(false);

    const blocked = new Headers();
    setNoindexHeader(blocked, '/shop');
    expect(blocked.get('X-Robots-Tag')).toBe('noindex, nofollow');
    const open = new Headers();
    setNoindexHeader(open, '/features');
    expect(open.get('X-Robots-Tag')).toBeNull();

    const middleware = fs.readFileSync(path.join(root, 'middleware.ts'), 'utf8');
    expect(middleware).toContain('setNoindexHeader');
    expect(middleware).toContain('NOINDEX_REQUEST_HEADER');

    const segments = [
      'shop', 'manager', 'tech', 'customer', 'admin', 'superadmin', 'auth',
      'workorders', 'reports', 'payment', 'sign', 'register', 'offline', 'forbidden',
    ];
    for (const segment of segments) {
      const src = fs.readFileSync(path.join(root, 'src/app', segment, 'layout.tsx'), 'utf8');
      expect(src).toContain('NOINDEX_METADATA');
    }
    const notFound = fs.readFileSync(path.join(root, 'src/app/not-found.tsx'), 'utf8');
    expect(notFound).toContain('NOINDEX_METADATA');
  });
});
