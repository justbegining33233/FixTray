import { describe, it, expect } from '@jest/globals';
import { mapShopServiceOptions } from '../src/lib/shopServiceOptions';
import {
  unwrapWorkOrders,
  unwrapTechs,
  isAwaitingClockIn,
  workOrderDetailPath,
} from '../src/lib/workOrderList';

describe('shop service options', () => {
  it('maps serviceName records from the shop catalog', () => {
    const options = mapShopServiceOptions([
      { serviceName: 'Oil Change', category: 'gas' },
      { serviceName: 'Engine Diagnostics', category: 'diesel' },
      { name: 'AUDIT TEST SERVICE r7k2' },
      { serviceName: 'Oil Change', category: 'diesel' },
      { serviceName: '  ' },
    ]);

    expect(options).toEqual([
      { value: 'Oil Change', label: 'Oil Change' },
      { value: 'Engine Diagnostics', label: 'Engine Diagnostics' },
      { value: 'AUDIT TEST SERVICE r7k2', label: 'AUDIT TEST SERVICE r7k2' },
    ]);
  });

  it('returns empty options when the payload is not a service list', () => {
    expect(mapShopServiceOptions({ error: 'Shop ID required' })).toEqual([]);
    expect(mapShopServiceOptions(null)).toEqual([]);
  });
});

describe('work order list helpers', () => {
  it('unwraps { workOrders } list payloads used by /api/workorders', () => {
    expect(unwrapWorkOrders({ workOrders: [{ id: 'wo-1' }] })).toEqual([{ id: 'wo-1' }]);
    expect(unwrapWorkOrders([{ id: 'wo-2' }])).toEqual([{ id: 'wo-2' }]);
    expect(unwrapWorkOrders({ techs: [] })).toEqual([]);
  });

  it('unwraps { techs } list payloads used by /api/techs', () => {
    expect(unwrapTechs({ techs: [{ id: 't1' }] })).toEqual([{ id: 't1' }]);
    expect(unwrapTechs([])).toEqual([]);
  });

  it('treats missing assignee as awaiting clock-in', () => {
    expect(isAwaitingClockIn({ assignedTechId: null, assignedTo: null })).toBe(true);
    expect(isAwaitingClockIn({ assignedTechId: 'tech-1' })).toBe(false);
    expect(isAwaitingClockIn({ assignedTo: { id: 'tech-1' } })).toBe(false);
  });

  it('builds cuid-based detail paths instead of display codes', () => {
    expect(workOrderDetailPath('cmu39te40000310ga9fdrupxm')).toBe('/workorders/cmu39te40000310ga9fdrupxm');
    expect(workOrderDetailPath('WO-cmu39te4')).not.toBe('/workorders/WO-cmu39te4'.replace('WO-', ''));
  });
});
