import { describe, expect, it } from '@jest/globals';
import { FIXTRAY_SERVICE_FEE } from '../src/lib/constants';
import {
  DEMO_DURATION_MS,
  buildDemoLoginEmail,
  decideDemoLogin,
  demoAccessExpiresIn,
} from '../src/lib/demoShopRules';
import { fixtrayServiceFeeLabel, memberAndCustomerFeeCopy } from '../src/lib/publicFeeCopy';

describe('demo shop clock', () => {
  const now = new Date('2026-09-30T15:00:00.000Z');

  it('does not start before the first shop login', () => {
    const waiting = {
      firstLoginAt: null,
      expiresAt: null,
      resetAt: null,
    };
    expect(decideDemoLogin(null, now, { startClock: true })).toEqual({ action: 'absent' });
    expect(decideDemoLogin(waiting, now, { startClock: false })).toEqual({ action: 'allow', expiresAt: null });
    const started = decideDemoLogin(waiting, now, { startClock: true });
    expect(started).toEqual({
      action: 'start',
      firstLoginAt: now,
      expiresAt: new Date(now.getTime() + DEMO_DURATION_MS),
    });
    expect(DEMO_DURATION_MS).toBe(30 * 60 * 1000);
  });

  it('keeps the original end time and ends at 30 minutes', () => {
    const firstLoginAt = new Date('2026-09-30T15:00:00.000Z');
    const expiresAt = new Date(firstLoginAt.getTime() + DEMO_DURATION_MS);
    const session = { firstLoginAt, expiresAt, resetAt: null };
    const during = new Date(firstLoginAt.getTime() + 10 * 60 * 1000);
    expect(decideDemoLogin(session, during, { startClock: true })).toEqual({ action: 'allow', expiresAt });
    expect(decideDemoLogin(session, expiresAt, { startClock: true })).toEqual({ action: 'end' });
    expect(decideDemoLogin({ ...session, resetAt: during }, during, { startClock: true })).toEqual({ action: 'end' });
    expect(demoAccessExpiresIn(expiresAt, during)).toBe(20 * 60);
  });
});

describe('demo login email', () => {
  it('states the demo shop rules and escapes the password', () => {
    const message = buildDemoLoginEmail({
      username: 'fixtraydemoabc',
      password: 'secret<demo>',
      loginUrl: 'https://fixtray.app/auth/login',
    });
    expect(message.subject).toBe('Your FixTray demo shop login');
    expect(message.html).toContain('fixtraydemoabc');
    expect(message.html).toContain('secret&lt;demo&gt;');
    expect(message.html).toContain('before signing up');
    expect(message.html).toContain('It is not your shop.');
    expect(message.html).toContain('30 minutes');
    expect(message.html).toContain('first login');
    expect(message.html).toContain('do not start when this email is sent');
    expect(message.html).toContain('do not start when you submit the form');
    expect(message.html).toContain('password resets');
    expect(message.html).toContain('changes made in the demo shop reset');
    expect(message.html.toLowerCase()).not.toContain('calendar');
    expect(message.html.toLowerCase()).not.toContain('book a demo');
  });
});

describe('public service fee copy', () => {
  it('uses the flat fee named in the product', () => {
    expect(FIXTRAY_SERVICE_FEE).toBe(5);
    expect(fixtrayServiceFeeLabel()).toBe('$5.00');
    expect(memberAndCustomerFeeCopy()).toContain('no charge');
    expect(memberAndCustomerFeeCopy()).toContain('does not charge members a subscription');
    expect(memberAndCustomerFeeCopy()).toContain('$5.00');
    expect(memberAndCustomerFeeCopy()).toContain('when that fee applies');
  });
});
