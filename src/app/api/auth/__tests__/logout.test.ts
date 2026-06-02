/**
 * Unit tests for POST /api/auth/logout
 */

import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    refreshToken: {
      delete: jest.fn(),
    },
  },
}));

jest.mock('@/lib/csrf', () => ({
  validateCsrf: jest.fn(),
}));

import prisma from '@/lib/prisma';
import { validateCsrf } from '@/lib/csrf';
import { POST } from '../logout/route';

function makeRequest(cookies: Record<string, string> = {}, csrfHeader?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (csrfHeader) headers['x-csrf-token'] = csrfHeader;

  const cookieStr = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
  if (cookieStr) headers['cookie'] = cookieStr;

  return new NextRequest('http://localhost/api/auth/logout', {
    method: 'POST',
    headers,
  });
}

beforeEach(() => jest.clearAllMocks());

describe('POST /api/auth/logout', () => {
  it('returns 403 when CSRF validation fails', async () => {
    (validateCsrf as jest.Mock).mockResolvedValue(false);
    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/csrf/i);
  });

  it('deletes the refresh token and clears cookies on success', async () => {
    (validateCsrf as jest.Mock).mockResolvedValue(true);
    (prisma.refreshToken.delete as jest.Mock).mockResolvedValue({});

    const res = await POST(makeRequest({ refresh_id: 'token-abc' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);

    // Verify the refresh token was deleted
    expect(prisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'token-abc' } });

    // Verify auth cookies are cleared
    const setCookie = res.headers.getSetCookie?.() ?? [];
    const cleared = setCookie.filter((c: string) => c.includes('Max-Age=0') || c.includes('Expires=Thu, 01 Jan 1970'));
    expect(cleared.length).toBeGreaterThan(0);
  });

  it('succeeds even when there is no refresh_id cookie', async () => {
    (validateCsrf as jest.Mock).mockResolvedValue(true);
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    // delete should NOT be called when there is no cookie
    expect(prisma.refreshToken.delete).not.toHaveBeenCalled();
  });

  it('succeeds even when refreshToken.delete rejects (already gone)', async () => {
    (validateCsrf as jest.Mock).mockResolvedValue(true);
    (prisma.refreshToken.delete as jest.Mock).mockRejectedValue(new Error('Record not found'));

    const res = await POST(makeRequest({ refresh_id: 'stale-token' }));
    expect(res.status).toBe(200);
  });
});
