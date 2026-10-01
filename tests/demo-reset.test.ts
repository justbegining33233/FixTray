import { describe, expect, it } from '@jest/globals';
import {
  decideCustomerReset,
  isDemoSeedCustomerEmail,
  isDemoUsername,
} from '../src/lib/demoShopRules';
import { shouldBlockOutbound, withDemoBlock, demoOutboundBlocked } from '../src/lib/demoOutboundContext';

describe('demo customer reset', () => {
  const sessionCreatedAt = new Date('2026-09-30T15:00:00.000Z');

  it('keeps a customer that already existed and deletes one that exists only for the demo', () => {
    expect(decideCustomerReset({
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
      sessionCreatedAt,
      isSeed: false,
      otherShopTies: 0,
    })).toBe('detach');

    expect(decideCustomerReset({
      createdAt: new Date('2026-09-30T15:10:00.000Z'),
      sessionCreatedAt,
      isSeed: false,
      otherShopTies: 0,
    })).toBe('delete');

    expect(decideCustomerReset({
      createdAt: sessionCreatedAt,
      sessionCreatedAt,
      isSeed: true,
      otherShopTies: 0,
    })).toBe('delete');
  });

  it('does not delete a demo-window customer who still belongs to another shop', () => {
    expect(decideCustomerReset({
      createdAt: new Date('2026-09-30T15:10:00.000Z'),
      sessionCreatedAt,
      isSeed: true,
      otherShopTies: 1,
    })).toBe('detach');
  });

  it('recognizes demo shop usernames and the sample customer address', () => {
    expect(isDemoUsername('fixtraydemoabc123')).toBe(true);
    expect(isDemoUsername('realtshop')).toBe(false);
    expect(isDemoSeedCustomerEmail('demo-customer+shop1@fixtray.app')).toBe(true);
    expect(isDemoSeedCustomerEmail('customer@example.com')).toBe(false);
  });
});

describe('demo outbound block', () => {
  it('allows only the demo login email', () => {
    expect(shouldBlockOutbound({ purpose: 'demo-login', demoContext: true, shopIsDemo: true })).toBe(false);
    expect(shouldBlockOutbound({ demoContext: true })).toBe(true);
    expect(shouldBlockOutbound({ shopIsDemo: true })).toBe(true);
    expect(shouldBlockOutbound({})).toBe(false);
  });

  it('marks the current call as a demo actor without leaking past the call', () => {
    expect(demoOutboundBlocked()).toBe(false);
    withDemoBlock(() => {
      expect(demoOutboundBlocked()).toBe(true);
    });
    expect(demoOutboundBlocked()).toBe(false);
  });
});
