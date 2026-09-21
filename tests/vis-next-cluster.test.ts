import { describe, it, expect } from '@jest/globals';
import { calendarDateToUtcNoon, formatCalendarDate } from '../src/lib/calendarDate';
import { photoUploadMessage } from '../src/lib/photoUpload';
import { formatPermissionLabel } from '../src/lib/permissionLabels';
import { canViewPlatformHealthCatalog } from '../src/lib/shopRestrictedRoutes';
import {
  validateDviCreate,
  validateEnvironmentalFee,
  validateFleetAccount,
  validateInspectionRecord,
  validateInventoryRequest,
  validateLoanerVehicle,
  validatePaymentLink,
  validatePurchaseOrder,
  validateRecurringSchedule,
  validateReferralCreate,
  validateWorkOrderTemplate,
} from '../src/lib/shopFormValidation';
import { normalizeVehicleType, vehicleTypeLabel } from '../src/lib/vehicleTypes';

describe('VIS-024 platform health catalog', () => {
  it('hides the env catalog from shop, manager, and tech', () => {
    expect(canViewPlatformHealthCatalog('shop')).toBe(false);
    expect(canViewPlatformHealthCatalog('manager')).toBe(false);
    expect(canViewPlatformHealthCatalog('tech')).toBe(false);
    expect(canViewPlatformHealthCatalog('superadmin')).toBe(true);
  });
});

describe('VIS-030 permission labels', () => {
  it('renders a readable label instead of raw JSON', () => {
    expect(formatPermissionLabel('workorders.create')).toBe('Workorders · Create');
    expect(formatPermissionLabel('workorders.create')).not.toContain('{');
  });
});

describe('VIS-082 photo cancel', () => {
  it('does not toast success when the upload is cancelled', () => {
    expect(photoUploadMessage('cancel')).toBeNull();
    expect(photoUploadMessage('dismiss')).toBeNull();
    expect(photoUploadMessage('save-success')?.text).toBe('Photo saved successfully.');
  });
});

describe('VIS-105 vehicle type', () => {
  it('keeps Personal Vehicle through create, display, and edit', () => {
    expect(normalizeVehicleType('personal-vehicle')).toBe('personal-vehicle');
    expect(normalizeVehicleType('car')).toBe('personal-vehicle');
    expect(vehicleTypeLabel('car')).toBe('Personal Vehicle');
    expect(vehicleTypeLabel('personal-vehicle')).toBe('Personal Vehicle');
    expect(normalizeVehicleType('')).toBe('personal-vehicle');
    expect(normalizeVehicleType('semi-truck')).toBe('semi-truck');
  });
});

describe('VIS-107 purchase order expected date', () => {
  it('stores noon UTC and redisplays the entered calendar day', () => {
    const stored = calendarDateToUtcNoon('2026-09-20');
    expect(stored?.toISOString()).toBe('2026-09-20T12:00:00.000Z');
    expect(formatCalendarDate(stored?.toISOString())).toBe('2026-09-20');
    expect(formatCalendarDate('2026-09-20T00:00:00.000Z')).toBe('2026-09-20');
  });
});

describe('blank create validation', () => {
  it('rejects empty environmental fees, loaners, fleet, dvi, inspections, templates, and recurring', () => {
    expect(validateEnvironmentalFee({ name: '', amount: 0 }).ok).toBe(false);
    expect(validateEnvironmentalFee({ name: 'Oil', amount: 4.5 }).ok).toBe(true);
    expect(validateLoanerVehicle({ make: '', model: '', year: '' }).ok).toBe(false);
    expect(validateLoanerVehicle({ make: 'Ford', model: 'Escape', year: 2020 }).ok).toBe(true);
    expect(validateFleetAccount({ companyName: 'Acme', contactName: 'Pat' }).ok).toBe(false);
    expect(validateFleetAccount({ companyName: 'Acme', contactName: 'Pat', contactEmail: 'pat@acme.com' }).ok).toBe(true);
    expect(validateDviCreate({}).ok).toBe(false);
    expect(validateDviCreate({ vehicleDesc: '2020 F-150' }).ok).toBe(true);
    expect(validateInspectionRecord({ inspectionType: 'safety', result: 'pass' }).ok).toBe(false);
    expect(validateInspectionRecord({ inspectionType: 'safety', result: 'pass', vehicleDesc: '2020 F-150' }).ok).toBe(true);
    expect(validateWorkOrderTemplate({ name: '   ', serviceType: 'oil' }).ok).toBe(false);
    expect(validateRecurringSchedule({ customerId: 'c1', title: 'Oil', issueDescription: '' }).ok).toBe(false);
  });

  it('rejects empty referrals, inventory requests, zero PO lines, and $0 payment links', () => {
    expect(validateReferralCreate({ referredName: '  ' }).ok).toBe(false);
    expect(validateReferralCreate({ referredName: 'Jane' }).ok).toBe(true);
    expect(validateInventoryRequest({ itemName: 'Pads', quantity: 1, reason: '' }).ok).toBe(false);
    expect(validatePurchaseOrder({ vendor: 'Napa', items: [{ itemName: 'Pad', quantity: 1, unitCost: 0 }] }).ok).toBe(false);
    expect(validatePurchaseOrder({ vendor: 'Napa', items: [{ description: 'Pad', qty: 1, unitCost: 12 }] }).ok).toBe(true);
    expect(validatePaymentLink({ amount: 0, description: '', customerName: '' }).ok).toBe(false);
    expect(validatePaymentLink({ amount: 25, description: 'Brakes', customerName: 'Ann' }).ok).toBe(true);
  });
});
