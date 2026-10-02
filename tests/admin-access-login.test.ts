import { describe, expect, it } from '@jest/globals';
import { ADMIN_HOME_PATH, adminAccessSession, adminLoginUsername } from '../src/lib/adminAccessLogin';

describe('Admin Access login', () => {
  it('keeps the typed username case and opens /admin/home', () => {
    expect(adminLoginUsername('SupAdm1006')).toBe('SupAdm1006');
    expect(adminLoginUsername('  SupAdm1006  ')).toBe('SupAdm1006');
    expect(adminLoginUsername('supadm1006')).toBe('supadm1006');
    expect(adminLoginUsername('supadm1006')).not.toBe(adminLoginUsername('SupAdm1006'));

    const session = adminAccessSession({
      token: 'header.payload.sig',
      admin: {
        id: 'admin-1',
        username: 'SupAdm1006',
        isSuperAdmin: true,
        isOwner: true,
      },
    });
    expect(session).toEqual({
      token: 'header.payload.sig',
      role: 'admin',
      name: 'SupAdm1006',
      id: 'admin-1',
      isSuperAdmin: true,
      isOwner: true,
      destination: ADMIN_HOME_PATH,
    });
    expect(session?.destination).toBe('/admin/home');
  });
});
