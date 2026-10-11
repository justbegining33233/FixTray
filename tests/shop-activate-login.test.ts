import { NextRequest } from 'next/server';
import {
  SHOP_APPROVED_STATUS,
  SHOP_PENDING_LOGIN_MESSAGE,
  SHOP_SUSPENDED_LOGIN_MESSAGE,
  canonicalShopStatusWrite,
  shopMayLogIn,
} from '../src/lib/shopAccountStatus';
import { countApprovedShops } from '../src/lib/shopCensus';

jest.mock('bcrypt', () => {
  const compare = jest.fn();
  const hash = jest.fn().mockResolvedValue('hashed-refresh');
  const api = { compare, hash };
  return { __esModule: true, ...api, default: api };
});

jest.mock('@/lib/rateLimit', () => ({
  checkRateLimit: jest.fn().mockResolvedValue({ success: true, resetTime: Date.now() + 60000, message: '' }),
  getClientIP: jest.fn().mockReturnValue('127.0.0.1'),
  resetRateLimit: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  requireRole: jest.fn(() => ({ id: 'supadm', role: 'superadmin', username: 'SupAdm1006' })),
  hashPassword: jest.fn(),
  generateAccessToken: jest.fn().mockReturnValue('mock-access-token'),
  generateTempToken: jest.fn(),
  generateRandomToken: jest.fn().mockReturnValue('mock-refresh-raw'),
  refreshExpiryDate: jest.fn().mockReturnValue(new Date(Date.now() + 86400000)),
}));

jest.mock('@/lib/auth-lockout', () => ({
  checkAccountLockout: jest.fn().mockResolvedValue({ isLocked: false }),
  recordFailedLoginAttempt: jest.fn(),
  clearLoginAttempts: jest.fn(),
}));

jest.mock('@/lib/sessionPolicy', () => ({
  enforceSingleActiveSession: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/activityLogger', () => ({
  logActivity: jest.fn(),
}));

jest.mock('@/lib/auditLog', () => ({
  logAdminAction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/owner-access', () => ({
  isOwnerAdmin: jest.fn().mockReturnValue(false),
}));

jest.mock('@/lib/csrf', () => ({
  generateCsrfToken: jest.fn().mockReturnValue('mock-csrf'),
}));

jest.mock('@/lib/demoShop', () => ({
  demoLoginWindow: jest.fn().mockResolvedValue({ blocked: false }),
}));

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    shop: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    shopSettings: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    refreshToken: {
      create: jest.fn().mockResolvedValue({ id: 'refresh-1' }),
    },
  },
}));

import bcrypt from 'bcrypt';
import prisma from '@/lib/prisma';
import { PUT as updateUser } from '../src/app/api/admin/users/route';
import { POST as shopLogin } from '../src/app/api/auth/shop/route';

type StoredShop = {
  id: string;
  username: string;
  email: string;
  shopName: string;
  password: string;
  status: string;
  approvedAt: Date | null;
  phone: string;
  profileComplete: boolean;
  twoFactorEnabled: boolean;
};

function weekSimShop(status: string): StoredShop {
  return {
    id: 'week-sim',
    username: 'weeksim',
    email: 'weeksim@example.com',
    shopName: 'Week Sim',
    password: 'hashed-password',
    status,
    approvedAt: null,
    phone: '555',
    profileComplete: true,
    twoFactorEnabled: false,
  };
}

function useShop(initial: StoredShop) {
  const store = { ...initial };
  (prisma.shop.findUnique as jest.Mock).mockImplementation(async () => ({ ...store }));
  (prisma.shop.findFirst as jest.Mock).mockImplementation(async () => ({ ...store }));
  (prisma.shop.update as jest.Mock).mockImplementation(async ({ data }: { data: Partial<StoredShop> }) => {
    Object.assign(store, data);
    return { ...store };
  });
  return store;
}

function loginRequest(password: string) {
  return new NextRequest('http://localhost/api/auth/shop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'weeksim', password }),
  });
}

function activateRequest(status: string) {
  return new NextRequest('http://localhost/api/admin/users', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'week-sim', userType: 'shop', status }),
  });
}

describe('shop account status', () => {
  it('writes Activate as the same status approval uses, and counts that shop as approved', () => {
    expect(canonicalShopStatusWrite('active')).toBe(SHOP_APPROVED_STATUS);
    expect(canonicalShopStatusWrite('approved')).toBe('approved');
    expect(canonicalShopStatusWrite('inactive')).toBe('suspended');
    expect(canonicalShopStatusWrite('nope')).toBeNull();
    expect(shopMayLogIn('active')).toBe(true);
    expect(shopMayLogIn('Approved')).toBe(true);
    expect(shopMayLogIn('pending')).toBe(false);
    expect(shopMayLogIn('suspended')).toBe(false);
    const shops = [
      { status: 'approved' },
      { status: 'active' },
      { status: 'pending' },
      { status: 'suspended' },
    ];
    expect(countApprovedShops(shops)).toBe(2);
  });
});

describe('activate then shop login', () => {
  beforeEach(() => {
    (bcrypt.compare as jest.Mock).mockImplementation(async (plain: string) => plain === 'secret');
  });

  it('stores approved when Activate sends active, then the owner can sign in', async () => {
    const store = useShop(weekSimShop('suspended'));
    const activated = await updateUser(activateRequest('active'));
    const activatedBody = await activated.json();
    expect(activated.status).toBe(200);
    expect(store.status).toBe('approved');
    expect(store.approvedAt).toBeInstanceOf(Date);
    expect(activatedBody.user.status).toBe('approved');

    const login = await shopLogin(loginRequest('secret'));
    const loginBody = await login.json();
    expect(login.status).toBe(200);
    expect(loginBody.accessToken).toBe('mock-access-token');
    expect(loginBody.status).toBe('approved');
  });

  it('lets a shop already stored as active sign in', async () => {
    useShop(weekSimShop('active'));
    const login = await shopLogin(loginRequest('secret'));
    expect(login.status).toBe(200);
  });

  it('tells a suspended or pending owner why sign-in failed', async () => {
    useShop(weekSimShop('suspended'));
    const suspended = await shopLogin(loginRequest('secret'));
    const suspendedBody = await suspended.json();
    expect(suspended.status).toBe(403);
    expect(suspendedBody.error).toBe(SHOP_SUSPENDED_LOGIN_MESSAGE);
    expect(suspendedBody.error).not.toBe('Invalid credentials');

    useShop(weekSimShop('pending'));
    const pending = await shopLogin(loginRequest('secret'));
    const pendingBody = await pending.json();
    expect(pending.status).toBe(403);
    expect(pendingBody.error).toBe(SHOP_PENDING_LOGIN_MESSAGE);
  });

  it('keeps a wrong password as invalid credentials', async () => {
    useShop(weekSimShop('suspended'));
    const login = await shopLogin(loginRequest('wrong'));
    const body = await login.json();
    expect(login.status).toBe(401);
    expect(body.error).toBe('Invalid credentials');
  });
});
