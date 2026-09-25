import { assessTechPrep, logoutGuard, roleMayApply, shouldRecordGps, sortGpsPoints, stampTimes } from '../src/lib/offlineSafety';
import { externalMapLinks, roadsFromOverpass } from '../src/lib/offlineMapPack';

const readyJob = {
  id: 'wo-1',
  customer: { firstName: 'Riley', lastName: 'Nguyen', phone: '555-0100' },
  jobAddress: '100 Main St, Austin, TX 78701',
  vehicle: { year: 2019, make: 'Ford', model: 'F-150' },
  linesFetched: true,
  photosFetched: true,
  notesFetched: true,
  laborRate: 125,
  catalog: [],
  latitude: 30.27,
  longitude: -97.74,
  mapPack: { roads: [] },
};

describe('offline prep and safety', () => {
  it('marks a job ready only when the field download is complete', () => {
    expect(assessTechPrep(readyJob).ready).toBe(true);
    const missingPhone = assessTechPrep({ ...readyJob, customer: { firstName: 'Riley', lastName: 'Nguyen', phone: '' } });
    expect(missingPhone.ready).toBe(false);
    expect(missingPhone.missing).toContain('customer phone');
    const noMap = assessTechPrep({ ...readyJob, mapPack: null });
    expect(noMap.ready).toBe(true);
    expect(noMap.warning).toMatch(/Street map did not finish/);
  });

  it('sorts GPS breadcrumbs by device time', () => {
    const sorted = sortGpsPoints([
      { latitude: 2, longitude: 2, deviceAt: '2026-09-25T18:00:00.000Z', clientId: 'b' },
      { latitude: 1, longitude: 1, deviceAt: '2026-09-25T17:00:00.000Z', clientId: 'a' },
    ]);
    expect(sorted.map((point) => point.clientId)).toEqual(['a', 'b']);
  });

  it('skips GPS samples that are too soon or too close', () => {
    const last = { latitude: 30, longitude: -97, at: 1_000_000 };
    expect(shouldRecordGps(last, { latitude: 30.01, longitude: -97 }, last.at + 10_000)).toBe(false);
    expect(shouldRecordGps(last, { latitude: 30.0001, longitude: -97 }, last.at + 70_000)).toBe(false);
    expect(shouldRecordGps(last, { latitude: 30.01, longitude: -97 }, last.at + 70_000)).toBe(true);
  });

  it('rejects queued actions the role cannot perform', () => {
    expect(roleMayApply('customer', 'labor').ok).toBe(false);
    expect(roleMayApply('customer', 'message').ok).toBe(true);
    expect(roleMayApply('tech', 'payment').ok).toBe(false);
    expect(roleMayApply('superadmin', 'shop-approve').ok).toBe(false);
    expect(roleMayApply('shop', 'pay-change').ok).toBe(false);
    expect(roleMayApply('tech', 'gps').ok).toBe(true);
    expect(roleMayApply('customer', 'gps').ok).toBe(false);
  });

  it('refuses to wipe unsynced work on logout', () => {
    expect(logoutGuard(0).clearCache).toBe(true);
    const pending = logoutGuard(2);
    expect(pending.clearCache).toBe(false);
    expect(pending.warn).toBe(true);
    expect(pending.message).toMatch(/will not delete/);
  });

  it('keeps device time and flags a clock that is far off', () => {
    const received = new Date('2026-09-25T12:00:00.000Z');
    const close = stampTimes('2026-09-25T11:50:00.000Z', received);
    expect(close.clockAdjusted).toBe(false);
    expect(close.effectiveAt).toBe('2026-09-25T11:50:00.000Z');
    const wrong = stampTimes('2020-01-01T00:00:00.000Z', received);
    expect(wrong.clockAdjusted).toBe(true);
    expect(wrong.deviceAt).toBe('2020-01-01T00:00:00.000Z');
    expect(wrong.effectiveAt).toBe(received.toISOString());
  });

  it('builds turn-by-turn links without caching those providers', () => {
    const links = externalMapLinks(30.27, -97.74);
    expect(links.google).toContain('google.com/maps');
    expect(links.apple).toContain('maps.apple.com');
    expect(links.google).toContain('30.27');
    const roads = roadsFromOverpass({
      elements: [{ geometry: [{ lat: 1, lon: 2 }, { lat: 1.1, lon: 2.1 }] }],
    });
    expect(roads).toHaveLength(1);
    expect(roads[0][0]).toEqual({ lat: 1, lng: 2 });
  });
});
