import { describe, it, expect } from '@jest/globals';
import {
  APPOINTMENT_OVERDUE_GRACE_MS,
  isAppointmentOverdue,
  isUpcomingAppointment,
} from '../src/lib/appointmentValidation';
import { formatInventoryType, normalizeInventoryType, optionalInventoryText } from '../src/lib/inventoryItem';
import { isServiceOfferedForChannel, mapShopServiceOptions } from '../src/lib/shopServiceOptions';
import { isShopEdgeSensitivePath, SHOP_EDGE_SENSITIVE_PATHS } from '../src/lib/shopRestrictedRoutes';
import { isRoadsideLocation } from '../src/lib/waitingRoomBoard';

describe('VIS-104 inventory edit', () => {
  it('accepts displayed Part and Labor regardless of case', () => {
    expect(normalizeInventoryType('Part')).toBe('part');
    expect(normalizeInventoryType(' PART ')).toBe('part');
    expect(normalizeInventoryType('Labor')).toBe('labor');
    expect(formatInventoryType('part')).toBe('Part');
    expect(normalizeInventoryType('Oil')).toBeNull();
  });

  it('keeps supplier and notes, including clears', () => {
    expect(optionalInventoryText(' NAPA ')).toBe('NAPA');
    expect(optionalInventoryText('')).toBeNull();
    expect(optionalInventoryText(undefined)).toBeUndefined();
  });
});

describe('VIS-019 past appointments', () => {
  const start = new Date('2026-09-15T15:56:00');
  const laterThatEvening = new Date('2026-09-15T20:38:00');

  it('marks an open appointment overdue after the grace window', () => {
    expect(laterThatEvening.getTime() - start.getTime()).toBeGreaterThan(APPOINTMENT_OVERDUE_GRACE_MS);
    expect(isAppointmentOverdue('scheduled', start, laterThatEvening)).toBe(true);
    expect(isAppointmentOverdue('SCHEDULED', start, laterThatEvening)).toBe(true);
    expect(isUpcomingAppointment('scheduled', start, laterThatEvening)).toBe(false);
  });

  it('leaves recent, future, and closed appointments alone', () => {
    const tenMinutesLater = new Date(start.getTime() + 10 * 60 * 1000);
    expect(isAppointmentOverdue('scheduled', start, tenMinutesLater)).toBe(false);
    expect(isUpcomingAppointment('confirmed', start, tenMinutesLater)).toBe(true);
    expect(isAppointmentOverdue('completed', start, laterThatEvening)).toBe(false);
    expect(isAppointmentOverdue('cancelled', start, laterThatEvening)).toBe(false);
    expect(isUpcomingAppointment('scheduled', '2026-09-16T15:00:00', laterThatEvening)).toBe(true);
  });
});

describe('VIS-110 service channel toggles', () => {
  const services = [
    { serviceName: 'Oil Change', isActive: true, availableInShop: true, availableRoadside: false },
    { serviceName: 'Roadside Assistance', isActive: true, availableInShop: false, availableRoadside: true },
    { serviceName: 'Hidden', isActive: false, availableInShop: true, availableRoadside: true },
    { serviceName: 'Legacy' },
  ];

  it('keeps legacy services listed and honors roadside vs in-shop flags', () => {
    expect(mapShopServiceOptions(services).map((option) => option.label)).toEqual([
      'Oil Change',
      'Roadside Assistance',
      'Legacy',
    ]);
    expect(mapShopServiceOptions(services, 'roadside').map((option) => option.value)).toEqual([
      'Roadside Assistance',
      'Legacy',
    ]);
    expect(mapShopServiceOptions(services, 'in-shop').map((option) => option.value)).toEqual([
      'Oil Change',
      'Legacy',
    ]);
    expect(isServiceOfferedForChannel(services[2], 'any')).toBe(false);
  });
});

describe('VIS-002 roadside queue locations', () => {
  it('recognizes roadside location labels used by the jobs list', () => {
    expect(isRoadsideLocation('road-call')).toBe(true);
    expect(isRoadsideLocation('Roadside')).toBe(true);
    expect(isRoadsideLocation('in-shop')).toBe(false);
  });
});

describe('VIS-057 shop edge-sensitive links', () => {
  it('hides the audit cluster from shop navigation targets', () => {
    for (const path of SHOP_EDGE_SENSITIVE_PATHS) {
      expect(isShopEdgeSensitivePath(path)).toBe(true);
    }
    expect(isShopEdgeSensitivePath('/shop/settings?tab=security')).toBe(false);
    expect(isShopEdgeSensitivePath('/shop/home')).toBe(false);
    expect(isShopEdgeSensitivePath('/shop/settings/two-factor/')).toBe(true);
  });
});
