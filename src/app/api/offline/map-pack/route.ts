import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import { OFFLINE_MAP_PROVIDER, overpassQuery, roadsFromOverpass } from '@/lib/offlineMapPack';
import logger from '@/lib/logger';

export const runtime = 'nodejs';

/** One small Overpass extract for a job. OSMF raster tiles are not downloaded. */
export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (!['tech', 'manager', 'shop'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const latitude = Number(params.get('lat'));
  const longitude = Number(params.get('lng'));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 });
  }

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
        'User-Agent': 'FixTrayOffline/1.0 (job prep download)',
      },
      body: overpassQuery(latitude, longitude, 1500),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      return NextResponse.json({
        roads: [],
        warning: 'Street map did not finish downloading. The job pin and your location still work.',
        attribution: OFFLINE_MAP_PROVIDER.attribution,
        provider: OFFLINE_MAP_PROVIDER.offline,
      });
    }
    const payload = await response.json();
    return NextResponse.json({
      roads: roadsFromOverpass(payload),
      attribution: OFFLINE_MAP_PROVIDER.attribution,
      provider: OFFLINE_MAP_PROVIDER.offline,
      latitude,
      longitude,
    });
  } catch (error) {
    logger.error('Offline map pack failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({
      roads: [],
      warning: 'Street map did not finish downloading. The job pin and your location still work.',
      attribution: OFFLINE_MAP_PROVIDER.attribution,
      provider: OFFLINE_MAP_PROVIDER.offline,
    });
  }
}
