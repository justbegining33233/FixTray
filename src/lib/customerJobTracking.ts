import { isRoadsideLocation } from '@/lib/waitingRoomBoard';

export const TRACK_UNAVAILABLE_MESSAGE =
  'Tracking is available for roadside calls or while your tech is sharing location for this job';

/** A share is live when the tech posted a position in the last 30 minutes. */
export const LOCATION_SHARE_FRESH_MS = 30 * 60 * 1000;

export function locationShareIsLive(
  updatedAt: Date | string | null | undefined,
  now = new Date(),
): boolean {
  if (!updatedAt) return false;
  const at = new Date(updatedAt).getTime();
  if (!Number.isFinite(at)) return false;
  return now.getTime() - at <= LOCATION_SHARE_FRESH_MS;
}

export function customerMayTrackJob(input: {
  serviceLocation?: string | null;
  sharingLocation?: boolean;
}): { enabled: boolean; reason: string | null } {
  if (isRoadsideLocation(input.serviceLocation) || input.sharingLocation) {
    return { enabled: true, reason: null };
  }
  return { enabled: false, reason: TRACK_UNAVAILABLE_MESSAGE };
}
