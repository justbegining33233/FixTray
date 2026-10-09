import { NextRequest } from 'next/server';
import { middleware } from '../middleware';

describe('private X-Robots-Tag', () => {
  it('sets noindex on private paths and leaves the public marketing page alone', async () => {
    const shop = await middleware(new NextRequest('http://localhost/shop/jobs'));
    expect(shop.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');

    const api = await middleware(new NextRequest('http://localhost/api/health'));
    expect(api.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');

    const features = await middleware(new NextRequest('http://localhost/features'));
    expect(features.headers.get('X-Robots-Tag')).toBeNull();
  });
});
