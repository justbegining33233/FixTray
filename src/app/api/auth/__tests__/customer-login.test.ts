/**
 * Unit tests for POST /api/auth/customer
 *
 * Strategy: mock Prisma, bcrypt, rate-limit, and JWT helpers so the handler
 * runs entirely in-process with no real DB or network calls.
 */

import { NextRequest } from 'next/server';

// ── mock heavy runtime deps before importing the route ──────────────────────
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    customer: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
    },
  },
}));

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

jest.mock('@/lib/rateLimit', () => ({
  checkRateLimit: jest.fn(),
  getClientIP: jest.fn().mockReturnValue('127.0.0.1'),
  resetRateLimit: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  generateAccessToken: jest.fn().mockReturnValue('mock-access-token'),
  generateRandomToken: jest.fn().mockReturnValue('mock-refresh-raw'),
  refreshExpiryDate: jest.fn().mockReturnValue(new Date(Date.now() + 86400000)),
}));

jest.mock('@/lib/csrf', () => ({
  generateCsrfToken: jest.fn().mockReturnValue('mock-csrf-token'),
}));

import prisma from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { checkRateLimit } from '@/lib/rateLimit';
import { POST } from '../customer/route';

// ── helpers ──────────────────────────────────────────────────────────────────

const mockCustomer = {
  id: 'cust-001',
  email: 'alice@example.com',
  username: 'alice',
  password: '$2b$12$hashedpassword',
  firstName: 'Alice',
  lastName: 'Smith',
  emailVerified: true,
};

function makeRequest(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/auth/customer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function allowRateLimit() {
  (checkRateLimit as jest.Mock).mockResolvedValue({
    success: true,
    resetTime: Date.now() + 60000,
    message: '',
  });
}

function blockRateLimit() {
  (checkRateLimit as jest.Mock).mockResolvedValue({
    success: false,
    resetTime: Date.now() + 60000,
    message: 'Too many requests',
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.refreshToken.create as jest.Mock).mockResolvedValue({ id: 'refresh-001' });
});

// ── tests ────────────────────────────────────────────────────────────────────

describe('POST /api/auth/customer', () => {
  it('returns 400 when body is missing email', async () => {
    allowRateLimit();
    const res = await POST(makeRequest({ password: 'secret123' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/validation/i);
  });

  it('returns 400 when body is missing password', async () => {
    allowRateLimit();
    const res = await POST(makeRequest({ email: 'alice@example.com' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/validation/i);
  });

  it('returns 429 when rate limit is exceeded', async () => {
    blockRateLimit();
    const res = await POST(makeRequest({ email: 'alice@example.com', password: 'secret123' }));
    expect(res.status).toBe(429);
  });

  it('returns 401 when customer does not exist', async () => {
    allowRateLimit();
    (prisma.customer.findFirst as jest.Mock).mockResolvedValue(null);
    const res = await POST(makeRequest({ email: 'nobody@example.com', password: 'secret123' }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Invalid credentials');
  });

  it('returns 401 when password is wrong', async () => {
    allowRateLimit();
    (prisma.customer.findFirst as jest.Mock).mockResolvedValue(mockCustomer);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    const res = await POST(makeRequest({ email: 'alice@example.com', password: 'wrongpass' }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Invalid credentials');
  });

  it('returns 200 with accessToken on valid credentials', async () => {
    allowRateLimit();
    (prisma.customer.findFirst as jest.Mock).mockResolvedValue(mockCustomer);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh');

    const res = await POST(makeRequest({ email: 'alice@example.com', password: 'correct' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.accessToken).toBe('mock-access-token');
    expect(json.email).toBe('alice@example.com');
    expect(json.role).toBe('customer');
  });

  it('login is case-insensitive for email', async () => {
    allowRateLimit();
    (prisma.customer.findFirst as jest.Mock).mockResolvedValue(mockCustomer);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh');

    const res = await POST(makeRequest({ email: '  ALICE@EXAMPLE.COM  ', password: 'correct' }));
    expect(res.status).toBe(200);
    // The findFirst call should have received the lower-cased email
    const callArg = (prisma.customer.findFirst as jest.Mock).mock.calls[0][0];
    const emailConditions = callArg.where.OR.map((c: { email?: string }) => c.email).filter(Boolean);
    expect(emailConditions[0]).toBe('alice@example.com');
  });

  it('sets httpOnly cookies on successful login', async () => {
    allowRateLimit();
    (prisma.customer.findFirst as jest.Mock).mockResolvedValue(mockCustomer);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh');

    const res = await POST(makeRequest({ email: 'alice@example.com', password: 'correct' }));
    expect(res.status).toBe(200);
    const setCookie = res.headers.getSetCookie?.() ?? [];
    const names = setCookie.map((c: string) => c.split('=')[0]);
    expect(names).toContain('sos_auth');
    expect(names).toContain('refresh_id');
  });
});
