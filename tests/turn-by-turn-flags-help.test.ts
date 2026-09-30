import { describe, expect, it } from '@jest/globals';
import {
  activeStepIndex,
  browserDirectionLinks,
  formatTripDistance,
  jobNeedsDirections,
  osrmRouteUrl,
  parseOsrmRoute,
  resolveDirectionTarget,
  stepInstruction,
} from '../src/lib/turnByTurn';
import {
  acknowledgeAttentionFlag,
  estimateDeniedFlag,
  flagVisibleTo,
  parseAttentionFlag,
  serializeAttentionFlag,
} from '../src/lib/notificationFlags';
import { isCustomerVisibleNotification } from '../src/lib/customerNotifications';
import { HELP_ARTICLES, searchHelpArticles } from '../src/lib/helpCenter';

const osrmFixture = {
  code: 'Ok',
  routes: [{
    distance: 1200,
    duration: 180,
    geometry: { type: 'LineString', coordinates: [[-97.74, 30.27], [-97.75, 30.28]] },
    legs: [{
      steps: [
        {
          distance: 400,
          duration: 60,
          name: 'Congress Ave',
          maneuver: { type: 'depart', modifier: 'right', location: [-97.74, 30.27] },
        },
        {
          distance: 800,
          duration: 120,
          name: '6th St',
          maneuver: { type: 'turn', modifier: 'left', location: [-97.745, 30.275] },
        },
        {
          distance: 0,
          duration: 0,
          name: '',
          maneuver: { type: 'arrive', location: [-97.75, 30.28] },
        },
      ],
    }],
  }],
};

describe('turn-by-turn on a job', () => {
  it('offers directions to a technician on a road call or an assigned job', () => {
    expect(jobNeedsDirections({ viewerRole: 'tech', serviceLocation: 'road-call', assignedTechId: null })).toBe(true);
    expect(jobNeedsDirections({ viewerRole: 'tech', serviceLocation: 'in-shop', assignedTechId: 'tech-1' })).toBe(true);
    expect(jobNeedsDirections({ viewerRole: 'manager', serviceLocation: 'roadside', assignedTechId: 'tech-1' })).toBe(true);
    expect(jobNeedsDirections({ viewerRole: 'customer', serviceLocation: 'road-call', assignedTechId: 'tech-1' })).toBe(false);
    expect(jobNeedsDirections({ viewerRole: 'tech', serviceLocation: 'in-shop', assignedTechId: null })).toBe(false);
    expect(jobNeedsDirections({ viewerRole: 'shop', serviceLocation: 'road-call', assignedTechId: 'tech-1' })).toBe(false);
  });

  it('routes a road call to the job site and an in-shop job to the shop', () => {
    const road = resolveDirectionTarget({
      serviceLocation: 'road-call',
      location: { latitude: 30.31, longitude: -97.8, address: '10 Customer Rd', city: 'Austin', state: 'TX' },
      shopAddress: '9 Main St, Austin, TX 78702',
    });
    expect(road?.kind).toBe('job');
    expect(road?.point).toEqual({ latitude: 30.31, longitude: -97.8 });
    expect(road?.address).toContain('Customer Rd');

    const shop = resolveDirectionTarget({
      serviceLocation: 'in-shop',
      location: null,
      shopAddress: '9 Main St, Austin, TX 78702',
      geocodes: { '9 Main St, Austin, TX 78702': { latitude: 30.26, longitude: -97.74 } },
    });
    expect(shop?.kind).toBe('shop');
    expect(shop?.point?.latitude).toBe(30.26);

    expect(resolveDirectionTarget({
      serviceLocation: 'road-call',
      location: { locationType: 'not-provided' },
      shopAddress: '9 Main St',
    })).toBeNull();
  });

  it('turns an OSRM route into steps a tech can follow', () => {
    const route = parseOsrmRoute(osrmFixture);
    expect(route?.steps.map((step) => step.instruction)).toEqual([
      'Head right on Congress Ave',
      'Turn left onto 6th St',
      'Arrive at the job',
    ]);
    expect(route?.line[0]).toEqual({ latitude: 30.27, longitude: -97.74 });
    expect(formatTripDistance(30)).toMatch(/ft/);
    expect(formatTripDistance(400)).toMatch(/mi/);
    expect(stepInstruction({ type: 'merge' }, 'I-35')).toBe('Merge onto I-35');
    expect(parseOsrmRoute({ code: 'NoRoute' })).toBeNull();
    expect(osrmRouteUrl(
      { latitude: 30.27, longitude: -97.74 },
      { latitude: 30.31, longitude: -97.8 },
    )).toContain('router.project-osrm.org');
  });

  it('keeps browser map links and highlights the nearest step', () => {
    const links = browserDirectionLinks(
      { latitude: 30.31, longitude: -97.8 },
      { latitude: 30.27, longitude: -97.74 },
    );
    expect(links.google).toContain('google.com/maps');
    expect(links.google).toContain('origin=');
    expect(links.apple).toContain('maps.apple.com');
    const index = activeStepIndex([
      { latitude: 30.27, longitude: -97.74 },
      { latitude: 30.4, longitude: -97.9 },
    ], { latitude: 30.39, longitude: -97.89 });
    expect(index).toBe(1);
  });
});

describe('notification flags', () => {
  const flag = estimateDeniedFlag({ shopId: 'shop-1', assignedTechId: 'tech-1' });

  it('marks a denied estimate for a look and does not carry a job status', () => {
    expect(flag.event).toBe('estimate-denied');
    expect(flag.flagLabel).toBe('Needs a look');
    expect(flag.acknowledged).toBe(false);
    const raw = serializeAttentionFlag(flag);
    expect(raw).not.toMatch(/woStatus|approved|handoff/i);
    expect(parseAttentionFlag(raw)?.shopId).toBe('shop-1');
  });

  it('shows the flag to the shop, the manager, and the assigned tech only', () => {
    expect(flagVisibleTo(flag, { id: 'shop-1', role: 'shop' })).toBe(true);
    expect(flagVisibleTo(flag, { id: 'mgr-1', role: 'manager', shopId: 'shop-1' })).toBe(true);
    expect(flagVisibleTo(flag, { id: 'tech-1', role: 'tech', shopId: 'shop-1' })).toBe(true);
    expect(flagVisibleTo(flag, { id: 'tech-2', role: 'tech', shopId: 'shop-1' })).toBe(false);
    expect(flagVisibleTo(flag, { id: 'cust-1', role: 'customer' })).toBe(false);
    expect(flagVisibleTo(flag, { id: 'shop-2', role: 'shop' })).toBe(false);
  });

  it('clears the flag without a work order update', () => {
    const ack = acknowledgeAttentionFlag(serializeAttentionFlag(flag), new Date('2026-09-30T00:00:00.000Z'));
    expect(ack?.workOrderUpdate).toBeNull();
    expect(ack?.read).toBe(true);
    const next = parseAttentionFlag(ack?.metadata || '');
    expect(next?.acknowledged).toBe(true);
    expect(next?.acknowledgedAt).toBe('2026-09-30T00:00:00.000Z');
    expect(ack?.metadata).not.toMatch(/status|woStatus/);
    expect(flagVisibleTo(next!, { id: 'shop-1', role: 'shop' })).toBe(false);
  });

  it('hides the staff flag from the customer notification list', () => {
    expect(isCustomerVisibleNotification({
      type: 'attention',
      title: 'Customer denied an estimate',
      metadata: serializeAttentionFlag(flag),
    })).toBe(false);
    expect(isCustomerVisibleNotification({
      type: 'estimate',
      title: 'You denied this estimate',
    })).toBe(true);
  });
});

describe('help center', () => {
  it('searches real how-tos and does not invent a store app', () => {
    expect(searchHelpArticles('reissue').map((article) => article.slug)).toEqual(['deny-an-estimate']);
    expect(searchHelpArticles('deny estimate').map((article) => article.slug)).toContain('deny-an-estimate');
    expect(searchHelpArticles('add a tech')[0].slug).toBe('add-a-tech');
    expect(searchHelpArticles('turn-by-turn')[0].body.join(' ')).toMatch(/browser/i);
    const all = HELP_ARTICLES.map((article) => `${article.title} ${article.body.join(' ')}`).join('\n');
    expect(all).not.toMatch(/App Store|Google Play/);
    expect(all).not.toMatch(/automatic approval|email drip|bookable demo/i);
    expect(searchHelpArticles('zzzz-not-a-feature')).toEqual([]);
    expect(searchHelpArticles('')).toHaveLength(HELP_ARTICLES.length);
  });
});
