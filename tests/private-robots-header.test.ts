import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';
import { proxy } from '../src/proxy';

describe('private X-Robots-Tag', () => {
  it('sets noindex on private paths and leaves the public marketing page alone', async () => {
    const shop = await middleware(new NextRequest('http://localhost/shop/jobs'));
    expect(shop.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');

    const api = await middleware(new NextRequest('http://localhost/api/health'));
    expect(api.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');

    const features = await middleware(new NextRequest('http://localhost/features'));
    expect(features.headers.get('X-Robots-Tag')).toBeNull();
  });

  it('sets the header from the Next 16 proxy and from next.config headers', async () => {
    const shop = await proxy(new NextRequest('http://localhost/shop/jobs'));
    expect(shop.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');

    const api = await proxy(new NextRequest('http://localhost/api/health'));
    expect(api.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');

    const login = await proxy(new NextRequest('http://localhost/auth/login'));
    expect(login.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');

    const features = await proxy(new NextRequest('http://localhost/features'));
    expect(features.headers.get('X-Robots-Tag')).toBeNull();

    const config = fs.readFileSync(path.join(__dirname, '../next.config.ts'), 'utf8');
    expect(config).toContain("key: 'X-Robots-Tag'");
    expect(config).toContain('privateNoindexSources');
    expect(config).toContain("source: '/tech/clock'");
    expect(config).toContain("destination: '/tech/timeclock'");
    expect(config).toContain("source: '/admin/analytics'");
    expect(config).toContain("destination: '/admin/platform-analytics'");
  });
});
