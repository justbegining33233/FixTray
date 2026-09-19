import { describe, it, expect } from '@jest/globals';
import {
  canSubmitAppointment,
  hasAppointmentVehicle,
  isAppointmentDateInPast,
  normalizeDateRange,
} from '../src/lib/appointmentValidation';
import { slaComplianceRate, formatSlaCompliance } from '../src/lib/slaMetrics';
import {
  canShopStaffMessageRole,
  mapCustomerContacts,
  mapShopEntityContact,
  mapShopStaffContacts,
} from '../src/lib/messageContacts';
import { portalDashboardHref, techJobCreateHref } from '../src/lib/portalHome';
import { unwrapWorkOrders } from '../src/lib/workOrderList';

describe('appointment validation (VIS-088)', () => {
  it('requires a vehicle and rejects past in-shop dates', () => {
    expect(hasAppointmentVehicle({ vehicleMake: 'Ford', vehicleModel: 'F-150' })).toBe(true);
    expect(hasAppointmentVehicle({ selectedVehicleId: '' })).toBe(false);
    expect(isAppointmentDateInPast('2020-01-01', new Date('2026-09-19T12:00:00'))).toBe(true);
    expect(isAppointmentDateInPast('2026-09-19', new Date('2026-09-19T12:00:00'))).toBe(false);

    const past = canSubmitAppointment({
      visitType: 'in-shop',
      appointmentDate: '2020-01-01',
      appointmentTime: '09:00',
      vehicleMake: 'Ford',
      vehicleModel: 'F-150',
    }, new Date('2026-09-19T12:00:00'));
    expect(past.ok).toBe(false);

    const ready = canSubmitAppointment({
      visitType: 'in-shop',
      appointmentDate: '2026-09-20',
      appointmentTime: '09:00',
      vehicleMake: 'Ford',
      vehicleModel: 'F-150',
    }, new Date('2026-09-19T12:00:00'));
    expect(ready.ok).toBe(true);
  });
});

describe('SLA empty math (VIS-027)', () => {
  it('does not report 100% when there are zero completed jobs', () => {
    expect(slaComplianceRate(0, 0)).toBeNull();
    expect(formatSlaCompliance(null)).toBe('N/A');
    expect(slaComplianceRate(3, 4)).toBe(75);
  });
});

describe('message contacts (VIS-058/065)', () => {
  it('includes shop entity and shop staff, excluding the current user', () => {
    const staff = mapShopStaffContacts([
      { id: 'm1', firstName: 'Pat', lastName: 'Manager', role: 'manager', shopId: 'shop-1' },
      { id: 't1', firstName: 'Ty', lastName: 'Tech', role: 'tech', shopId: 'shop-1' },
    ], 'm1');
    expect(staff).toEqual([
      { id: 't1', name: 'Ty Tech', role: 'tech', shopId: 'shop-1', contextLabel: 'Shop Technician' },
    ]);
    expect(mapShopEntityContact({ id: 'shop-1', shopName: 'Audit Shop' }, 'm1')).toEqual([
      { id: 'shop-1', name: 'Audit Shop', role: 'shop', shopId: 'shop-1', contextLabel: 'Shop' },
    ]);
    expect(mapCustomerContacts([{ id: 'c1', firstName: 'Ann', lastName: 'Customer' }], 'shop-1')[0].role).toBe('customer');
    expect(canShopStaffMessageRole('tech')).toBe(true);
    expect(canShopStaffMessageRole('unknown')).toBe(false);
  });
});

describe('tech job routing (VIS-066/083)', () => {
  it('keeps techs on /tech create URLs', () => {
    expect(techJobCreateHref('inshop', 'tech')).toBe('/tech/new-inshop-job');
    expect(techJobCreateHref('roadside', 'tech')).toBe('/tech/new-roadside-job');
    expect(techJobCreateHref('inshop', 'shop')).toBe('/shop/new-inshop-job');
    expect(portalDashboardHref('tech')).toBe('/tech/home');
  });
});

describe('customer overview unwrap (VIS-018)', () => {
  it('reads workOrders envelopes', () => {
    expect(unwrapWorkOrders({ workOrders: [{ id: '1', status: 'pending' }] })).toHaveLength(1);
  });
});

describe('analytics range (VIS-078)', () => {
  it('swaps reversed dates', () => {
    expect(normalizeDateRange('2026-10-01', '2026-09-01')).toEqual({
      start: '2026-09-01',
      end: '2026-10-01',
      reversed: true,
    });
  });
});
