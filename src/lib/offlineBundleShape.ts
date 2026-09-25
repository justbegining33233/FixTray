import { readLatLng } from './offlineMapPack';
import { assessTechPrep, type PrepJob } from './offlineSafety';
import { readJobAddress } from './roadCallMap';

type JobRow = {
  id: string;
  status?: string;
  issueDescription?: unknown;
  serviceLocation?: string | null;
  vehicleType?: string | null;
  location?: unknown;
  techLabor?: unknown;
  partsUsed?: unknown;
  workPhotos?: unknown;
  completion?: unknown;
  customer?: { firstName?: string | null; lastName?: string | null; phone?: string | null } | null;
  vehicle?: { year?: number | null; make?: string | null; model?: string | null; licensePlate?: string | null; vin?: string | null; vehicleType?: string | null } | null;
  messages?: unknown;
  mapPack?: PrepJob['mapPack'];
  [key: string]: unknown;
};

export function shapeOfflineJob(
  row: JobRow,
  extras: { laborRate?: number | null; laborRates?: unknown[] | null; catalog?: unknown[] | null; strictPrep: boolean },
) {
  const point = readLatLng(row.location);
  const fromLocation = readJobAddress(row.location);
  const service = String(row.serviceLocation || '').trim();
  const serviceIsPlace = service && !['roadside', 'in-shop', 'inshop', 'shop'].includes(service.toLowerCase());
  const jobAddress = fromLocation || (serviceIsPlace ? service : '');
  const techLabor = Array.isArray(row.techLabor) ? row.techLabor : [];
  const partsUsed = Array.isArray(row.partsUsed) ? row.partsUsed : [];
  const workPhotos = Array.isArray(row.workPhotos) ? row.workPhotos : [];
  const prepInput: PrepJob = {
    id: row.id,
    customer: row.customer,
    jobAddress,
    vehicle: row.vehicle,
    vehicleType: row.vehicleType,
    linesFetched: true,
    photosFetched: true,
    notesFetched: true,
    laborRate: extras.laborRate ?? null,
    laborRates: extras.laborRates || null,
    catalog: Array.isArray(extras.catalog) ? extras.catalog : null,
    latitude: point?.latitude ?? null,
    longitude: point?.longitude ?? null,
    mapPack: row.mapPack || null,
  };
  const prep = extras.strictPrep
    ? assessTechPrep(prepInput)
    : { ready: true, missing: [] as string[], warning: null as string | null };
  return {
    ...row,
    techLabor,
    partsUsed,
    workPhotos,
    jobAddress,
    latitude: point?.latitude ?? null,
    longitude: point?.longitude ?? null,
    prep,
  };
}
