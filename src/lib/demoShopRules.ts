/**
 * Demo-shop rules that do not touch the database.
 * The 30 minutes start at the first shop login, not when the email is sent
 * and not when the request form is submitted.
 */

export const DEMO_DURATION_MS = 30 * 60 * 1000;

/** Reserved shop username prefix. Customer shop lists hide these accounts. */
export const DEMO_USERNAME_PREFIX = 'fixtraydemo';

export function isDemoUsername(username: string | null | undefined): boolean {
  return typeof username === 'string' && username.startsWith(DEMO_USERNAME_PREFIX);
}

/** Sample customer created with the demo shop. Not a real customer's address. */
export function isDemoSeedCustomerEmail(email: string | null | undefined): boolean {
  return typeof email === 'string' && /^demo-customer\+[^@]+@fixtray\.app$/i.test(email);
}

/**
 * A customer who already existed is detached and kept.
 * A customer created for the demo is deleted once nothing outside the demo still points at them.
 */
export function decideCustomerReset(input: {
  createdAt: Date;
  sessionCreatedAt: Date;
  isSeed: boolean;
  otherShopTies: number;
}): 'delete' | 'detach' {
  const preExisting = !input.isSeed && input.createdAt.getTime() < input.sessionCreatedAt.getTime();
  if (preExisting) return 'detach';
  if (input.otherShopTies > 0) return 'detach';
  return 'delete';
}

export const DEMO_SHOP_NAME = 'FixTray Demo Shop';

export const DEMO_FROM_EMAIL = 'FixTray <noreply@fixtray.app>';

export const DEMO_ENDED_MESSAGE =
  'This demo has ended. The password was reset and changes in the demo shop were cleared.';

export type DemoSessionClock = {
  firstLoginAt: Date | null;
  expiresAt: Date | null;
  resetAt: Date | null;
};

export type DemoLoginDecision =
  | { action: 'absent' }
  | { action: 'allow'; expiresAt: Date | null }
  | { action: 'start'; firstLoginAt: Date; expiresAt: Date }
  | { action: 'end' };

/**
 * Decide what a login should do with a demo session.
 * `startClock` is true only for the shop login we email. A technician login
 * does not start the 30 minutes.
 */
export function decideDemoLogin(
  session: DemoSessionClock | null,
  now: Date,
  options: { startClock: boolean },
): DemoLoginDecision {
  if (!session) return { action: 'absent' };
  if (session.resetAt) return { action: 'end' };
  if (session.expiresAt && now.getTime() >= session.expiresAt.getTime()) return { action: 'end' };
  if (!session.firstLoginAt) {
    if (!options.startClock) return { action: 'allow', expiresAt: null };
    const firstLoginAt = new Date(now.getTime());
    return {
      action: 'start',
      firstLoginAt,
      expiresAt: new Date(firstLoginAt.getTime() + DEMO_DURATION_MS),
    };
  }
  return { action: 'allow', expiresAt: session.expiresAt };
}

/** Seconds until the demo ends. Undefined when this login is not inside a running demo. */
export function demoAccessExpiresIn(expiresAt: Date | null, now: Date): number | undefined {
  if (!expiresAt) return undefined;
  return Math.max(1, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildDemoLoginEmail(input: {
  username: string;
  password: string;
  loginUrl: string;
}): { subject: string; html: string } {
  const username = escapeHtml(input.username);
  const password = escapeHtml(input.password);
  const loginUrl = escapeHtml(input.loginUrl);
  return {
    subject: 'Your FixTray demo shop login',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
        <h1 style="font-size: 22px;">Your FixTray demo shop login</h1>
        <p>Use this login to look at a demo shop and see if you like FixTray before you sign up.</p>
        <p><strong>Username:</strong> ${username}<br /><strong>Password:</strong> ${password}</p>
        <p><a href="${loginUrl}">Sign in to the demo shop</a></p>
        <p>This demo shop is only so you can see if you like FixTray before signing up. Do not do real work in it. It is not your shop.</p>
        <p>The demo lasts 30 minutes. The 30 minutes start at your first login. They do not start when this email is sent, and they do not start when you submit the form.</p>
        <p>When the 30 minutes end, the password resets and any changes made in the demo shop reset too.</p>
        <p>Questions: <a href="mailto:support@fixtray.app">support@fixtray.app</a></p>
      </div>
    `,
  };
}
