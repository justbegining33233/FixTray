import { AsyncLocalStorage } from 'async_hooks';
import { DEMO_USERNAME_PREFIX } from '@/lib/demoShopRules';

type DemoOutboundStore = { blocked: boolean };

const storage = new AsyncLocalStorage<DemoOutboundStore>();

type DemoActorClaims = {
  demo?: boolean;
  role?: string;
  username?: string;
};

/**
 * Mark the rest of this request as a demo shop actor.
 * Shop usernames with the demo prefix count even on older tokens that
 * were issued before the `demo` claim existed.
 */
export function noteDemoActor(claims: DemoActorClaims | null | undefined): void {
  if (!claims || typeof claims !== 'object') return;
  const byClaim = claims.demo === true;
  const byShopUsername = claims.role === 'shop'
    && typeof claims.username === 'string'
    && claims.username.startsWith(DEMO_USERNAME_PREFIX);
  if (byClaim || byShopUsername) {
    storage.enterWith({ blocked: true });
    return;
  }
  if (storage.getStore()) storage.enterWith({ blocked: false });
}

export function demoOutboundBlocked(): boolean {
  return storage.getStore()?.blocked === true;
}

/** Run a function inside a demo-outbound block. Tests use this so the store does not leak. */
export function withDemoBlock<T>(fn: () => T): T {
  return storage.run({ blocked: true }, fn);
}

/**
 * The demo login email is the only outbound message a demo may send.
 * Every other email or text is blocked when this request is a demo actor
 * or the target shop is a demo shop.
 */
export function shouldBlockOutbound(input: {
  purpose?: string;
  demoContext?: boolean;
  shopIsDemo?: boolean;
}): boolean {
  if (input.purpose === 'demo-login') return false;
  return input.demoContext === true || input.shopIsDemo === true;
}
