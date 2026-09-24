import { addressesToGeocode, buildRoadCallMap, formatAddressParts, isTrackableRoadCall, shopAddressFromRecord } from '../src/lib/roadCallMap';
import { clearGeocodeCache, geocodeAddress, geocodeAddresses, stripUnitDesignators } from '../src/lib/geocodeAddress';

const shop = { id: 'shop-1', name: 'Jose Diesel', address: '' };

function tech(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    firstName: id === 'inshop' ? 'In' : 'Road',
    lastName: 'Tech',
    phone: '555-0100',
    latitude: 30.27,
    longitude: -97.74,
    lastLocationUpdate: new Date().toISOString(),
    ...extra,
  };
}

describe('shop address for the ops map', () => {
  it('joins street, city, state, and zip from the shop profile', () => {
    expect(formatAddressParts({
      address: '500 Congress Ave',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
    })).toBe('500 Congress Ave, Austin, TX 78701');
  });

  it('uses the main shop location when the profile address is empty', () => {
    expect(shopAddressFromRecord({
      address: '',
      city: '',
      state: '',
      zipCode: '',
      shopLocations: [
        { address: '1 Side St', city: 'Dallas', state: 'TX', zip: '75201', isMain: false, status: 'active' },
        { address: '9 Main St', city: 'Austin', state: 'TX', zip: '78702', isMain: true, status: 'active' },
      ],
    })).toBe('9 Main St, Austin, TX 78702');
  });

  it('does not invent coordinates when the address is missing or geocoding fails', () => {
    const missing = buildRoadCallMap({ shop: { ...shop, address: '' }, jobs: [] });
    expect(missing.shop.status).toBe('missing-address');
    expect(missing.shop.latitude).toBeNull();
    expect(missing.shop.longitude).toBeNull();

    const ungeocoded = buildRoadCallMap({
      shop: { ...shop, address: '500 Congress Ave, Austin, TX 78701' },
      jobs: [],
      geocodes: { '500 Congress Ave, Austin, TX 78701': null },
    });
    expect(ungeocoded.shop.status).toBe('ungeocoded');
    expect(ungeocoded.shop.latitude).toBeNull();
    expect(ungeocoded.shop.address).toContain('Congress');
  });

  it('pins the shop only at the geocoded address', () => {
    const pinned = buildRoadCallMap({
      shop: { ...shop, address: '500 Congress Ave, Austin, TX 78701' },
      jobs: [],
      geocodes: { '500 Congress Ave, Austin, TX 78701': { latitude: 30.2672, longitude: -97.7431 } },
    });
    expect(pinned.shop.status).toBe('pinned');
    expect(pinned.shop.latitude).toBe(30.2672);
    expect(pinned.shop.longitude).toBe(-97.7431);
  });
});

describe('road-call tech and job markers', () => {
  const now = Date.parse('2026-09-23T18:00:00Z');

  it('ignores in-shop work even when the tech has a GPS fix', () => {
    expect(isTrackableRoadCall({ serviceLocation: 'in-shop', status: 'in-progress' })).toBe(false);
    const map = buildRoadCallMap({
      shop,
      now,
      jobs: [{
        id: 'job-inshop',
        status: 'in-progress',
        serviceLocation: 'in-shop',
        assignedTechId: 'inshop',
        assignedTo: tech('inshop'),
        location: { latitude: 30.1, longitude: -97.1 },
        tracking: { latitude: 30.2, longitude: -97.2, updatedAt: new Date(now).toISOString() },
      }],
    });
    expect(map.techs).toEqual([]);
    expect(map.jobs).toEqual([]);
  });

  it('shows an assigned road-call tech and the customer stop', () => {
    const map = buildRoadCallMap({
      shop,
      now,
      jobs: [{
        id: 'abcdef123456',
        status: 'en-route',
        serviceLocation: 'road-call',
        issueDescription: { symptoms: 'No start' },
        assignedTechId: 'road',
        customer: { firstName: 'Ana', lastName: 'Lopez' },
        assignedTo: tech('road', { latitude: null, longitude: null }),
        location: { latitude: 30.31, longitude: -97.8, address: '10 Customer Rd', city: 'Austin', state: 'TX' },
        tracking: { latitude: 30.4, longitude: -97.9, updatedAt: new Date(now - 30_000).toISOString() },
      }],
    });

    expect(map.jobs).toHaveLength(1);
    expect(map.jobs[0].customerName).toBe('Ana Lopez');
    expect(map.jobs[0].locationStatus).toBe('pinned');
    expect(map.jobs[0].latitude).toBe(30.31);
    expect(map.techs).toHaveLength(1);
    expect(map.techs[0].locationStatus).toBe('live');
    expect(map.techs[0].latitude).toBe(30.4);
    expect(map.techs[0].jobs[0].label).toContain('No start');
  });

  it('keeps a road-call tech on the list without a pin when location is unavailable', () => {
    const map = buildRoadCallMap({
      shop,
      now,
      jobs: [{
        id: 'job-noloc',
        status: 'assigned',
        serviceLocation: 'roadside',
        assignedTechId: 'road',
        assignedTo: tech('road', { latitude: null, longitude: null, lastLocationUpdate: null }),
        location: { locationType: 'not-provided' },
      }],
    });
    expect(map.techs[0].locationStatus).toBe('unavailable');
    expect(map.techs[0].latitude).toBeNull();
    expect(map.jobs[0].locationStatus).toBe('missing');
    expect(map.jobs[0].latitude).toBeNull();
  });

  it('includes a tech clocked into a road call and does not reuse another tech GPS', () => {
    const map = buildRoadCallMap({
      shop,
      now,
      jobs: [{
        id: 'job-clock',
        status: 'in-progress',
        serviceLocation: 'roadcall',
        assignedTechId: 'lead',
        assignedTo: tech('lead', { firstName: 'Lead', latitude: null, longitude: null }),
        tracking: { latitude: 30.5, longitude: -97.5, updatedAt: new Date(now).toISOString() },
        clockedInTechs: [tech('helper', { firstName: 'Helper', latitude: null, longitude: null })],
        location: { address: '44 Service Ln', city: 'Austin', state: 'TX', zipCode: '78704' },
      }],
      geocodes: { '44 Service Ln, Austin, TX 78704': { latitude: 30.25, longitude: -97.76 } },
    });

    const helper = map.techs.find((row) => row.id === 'helper');
    const lead = map.techs.find((row) => row.id === 'lead');
    expect(helper?.locationStatus).toBe('unavailable');
    expect(helper?.latitude).toBeNull();
    expect(lead?.latitude).toBe(30.5);
    expect(map.jobs[0].latitude).toBe(30.25);
    expect(map.jobs[0].locationStatus).toBe('pinned');
  });

  it('marks an older fix as last-known', () => {
    const map = buildRoadCallMap({
      shop,
      now,
      jobs: [{
        id: 'job-old',
        status: 'in-progress',
        serviceLocation: 'road_call',
        assignedTechId: 'road',
        assignedTo: tech('road', { lastLocationUpdate: new Date(now - 10 * 60 * 1000).toISOString() }),
        tracking: { latitude: 30.1, longitude: -97.1, updatedAt: new Date(now - 10 * 60 * 1000).toISOString() },
      }],
    });
    expect(map.techs[0].locationStatus).toBe('last-known');
  });

  it('asks to geocode the shop and job addresses that have no coordinates', () => {
    const queries = addressesToGeocode('500 Congress Ave, Austin, TX 78701', [{
      id: 'job-addr',
      status: 'assigned',
      serviceLocation: 'road-call',
      location: { address: '10 Customer Rd', city: 'Austin', state: 'TX', zipCode: '78701' },
    }, {
      id: 'job-point',
      status: 'assigned',
      serviceLocation: 'road-call',
      location: { latitude: 1, longitude: 2, address: 'Already pinned' },
    }]);
    expect(queries).toEqual([
      '500 Congress Ave, Austin, TX 78701',
      '10 Customer Rd, Austin, TX 78701',
    ]);
  });
});

describe('nominatim geocoder', () => {
  const sheridan = '1309 Coffeen Avenue STE 1200, Sheridan, Wyoming 82801';
  const sheridanStreet = '1309 Coffeen Avenue, Sheridan, Wyoming 82801';

  afterEach(() => clearGeocodeCache());

  it('strips suite, unit, apartment, and hash tokens without touching a state ZIP', () => {
    expect(stripUnitDesignators(sheridan)).toBe(sheridanStreet);
    expect(stripUnitDesignators('123 Main St, Ste. 5, Austin, TX 78701')).toBe('123 Main St, Austin, TX 78701');
    expect(stripUnitDesignators('456 Oak Ave Apt. 4B, Denver, CO 80202')).toBe('456 Oak Ave, Denver, CO 80202');
    expect(stripUnitDesignators('789 Pine Rd, Unit #12, Miami, FL 33101')).toBe('789 Pine Rd, Miami, FL 33101');
    expect(stripUnitDesignators('10 Elm St #1200, Boise, ID 83702')).toBe('10 Elm St, Boise, ID 83702');
    expect(stripUnitDesignators('100 West Street, Sheridan, WY 82801')).toBe('100 West Street, Sheridan, WY 82801');
    expect(stripUnitDesignators('200 Ocean Dr, Miami, FL 33101')).toBe('200 Ocean Dr, Miami, FL 33101');
  });

  it('returns null instead of a fallback coordinate when every variant misses', async () => {
    const fetchImpl = jest.fn(async () => ({ ok: true, json: async () => [] })) as unknown as typeof fetch;
    await expect(geocodeAddress('Nowhere Known, ZZ', fetchImpl)).resolves.toBeNull();
    await expect(geocodeAddress(sheridan, fetchImpl)).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('reads the first nominatim hit and does not retry a clean address', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => [{ lat: '30.2672', lon: '-97.7431' }],
    })) as unknown as typeof fetch;
    await expect(geocodeAddress('500 Congress Ave, Austin, TX', fetchImpl)).resolves.toEqual({
      latitude: 30.2672,
      longitude: -97.7431,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('pins the Sheridan shop address by retrying without the suite', async () => {
    const fetchImpl = jest.fn(async (url: string | URL | Request) => {
      const query = decodeURIComponent(String(url).split('q=')[1] || '');
      if (query.includes('STE')) return { ok: true, json: async () => [] };
      return { ok: true, json: async () => [{ lat: '44.7841500', lon: '-106.9410171' }] };
    }) as unknown as typeof fetch;

    const geocodes = await geocodeAddresses([sheridan], { fetchImpl });
    expect(geocodes[sheridan]).toEqual({ latitude: 44.78415, longitude: -106.9410171 });

    const map = buildRoadCallMap({
      shop: { id: 'shop-sheridan', name: 'Audit Shop', address: sheridan },
      jobs: [],
      geocodes,
    });
    expect(map.shop.address).toBe(sheridan);
    expect(map.shop.status).toBe('pinned');
    expect(map.shop.latitude).toBeCloseTo(44.78415, 4);
    expect(map.shop.longitude).toBeCloseTo(-106.94102, 4);

    const calls = (fetchImpl as unknown as jest.Mock).mock.calls.map((call) => decodeURIComponent(String(call[0]).split('q=')[1]));
    expect(calls).toEqual([sheridan, sheridanStreet]);
  });
});
