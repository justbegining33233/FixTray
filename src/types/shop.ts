// Shop Profile Types

export type ShopType =
  | 'diesel'
  | 'gas'
  | 'small-engine'
  | 'heavy-equipment'
  | 'resurfacing'
  | 'welding'
  | 'tire'
  | 'mixed';
export type ServiceLocation = 'mobile-only' | 'shop-only' | 'both';

// Diesel/Heavy-Duty Services
export type DieselServiceType = 
  | 'engine-diagnostics'
  | 'engine-repair'
  | 'engine-rebuild'
  | 'transmission-repair'
  | 'brake-system'
  | 'air-brake-service'
  | 'electrical-diagnostics'
  | 'electrical-repair'
  | 'tire-service'
  | 'tire-replacement'
  | 'wheel-alignment'
  | 'suspension-repair'
  | 'hydraulic-systems'
  | 'air-conditioning'
  | 'exhaust-repair'
  | 'def-system'
  | 'dpf-cleaning'
  | 'oil-change'
  | 'preventive-maintenance'
  | 'dot-inspections'
  | 'trailer-repair'
  | 'reefer-repair'
  | 'welding'
  | 'roadside-assistance';

// Gas/Automotive Services
export type GasServiceType = 
  | 'engine-diagnostics'
  | 'engine-repair'
  | 'transmission-service'
  | 'transmission-repair'
  | 'brake-service'
  | 'brake-replacement'
  | 'oil-change'
  | 'tune-up'
  | 'electrical-diagnostics'
  | 'electrical-repair'
  | 'battery-service'
  | 'tire-rotation'
  | 'tire-replacement'
  | 'wheel-alignment'
  | 'suspension-repair'
  | 'air-conditioning'
  | 'heating-repair'
  | 'exhaust-repair'
  | 'catalytic-converter'
  | 'emissions-testing'
  | 'state-inspection'
  | 'windshield-replacement'
  | 'fluid-service'
  | 'coolant-flush'
  | 'fuel-system-cleaning'
  | 'timing-belt'
  | 'roadside-assistance';

// Small Engine Services
export type SmallEngineServiceType =
  | 'engine-diagnostics'
  | 'carburetor-cleaning-rebuild'
  | 'fuel-system-repair'
  | 'ignition-system-repair'
  | 'spark-plug-replacement'
  | 'oil-change-filter'
  | 'air-filter-service'
  | 'tune-up'
  | 'blade-sharpening'
  | 'belt-replacement'
  | 'starter-repair'
  | 'recoil-starter-repair'
  | 'compression-testing'
  | 'two-stroke-service'
  | 'chain-sharpening'
  | 'string-trimmer-repair'
  | 'blower-repair'
  | 'generator-service'
  | 'pressure-washer-repair'
  | 'preventive-maintenance'
  | 'parts-replacement'
  | 'winterization';

// Heavy Equipment Services
export type HeavyEquipmentServiceType =
  | 'hydraulic-system-diagnostics'
  | 'hydraulic-cylinder-rebuild'
  | 'undercarriage-repair'
  | 'track-chain-replacement'
  | 'sprocket-roller-replacement'
  | 'final-drive-repair'
  | 'engine-diagnostics-repair'
  | 'transmission-service-repair'
  | 'boom-arm-repair'
  | 'bucket-blade-repair'
  | 'pin-bushing-replacement'
  | 'electrical-system-repair'
  | 'brake-system-service'
  | 'cooling-system-repair'
  | 'preventive-maintenance-heavy'
  | 'field-service-onsite'
  | 'welding-fabrication-repair'
  | 'pump-repair'
  | 'valve-adjustment'
  | 'heavy-equipment-inspections';

// Resurfacing / Machining Services
export type ResurfacingServiceType =
  | 'cylinder-head-resurfacing'
  | 'engine-block-resurfacing'
  | 'flywheel-resurfacing'
  | 'brake-rotor-resurfacing'
  | 'surface-grinding'
  | 'milling-machining'
  | 'line-boring'
  | 'valve-seat-cutting'
  | 'crankshaft-grinding'
  | 'align-boring'
  | 'sleeving-boring-cylinders'
  | 'precision-measurement'
  | 'custom-machining'
  | 'head-gasket-prep'
  | 'deck-surfacing';

// Welding / Fabrication Services
export type WeldingServiceType =
  | 'mig-welding'
  | 'tig-welding'
  | 'stick-welding'
  | 'aluminum-welding'
  | 'stainless-welding'
  | 'cast-iron-repair-welding'
  | 'structural-welding'
  | 'custom-fabrication'
  | 'weld-repairs'
  | 'hardfacing'
  | 'mobile-onsite-welding'
  | 'pipe-welding'
  | 'trailer-frame-repair'
  | 'heavy-equipment-weld-repair'
  | 'metal-cutting-prep'
  | 'weld-inspection';

// Tire Shop Services
export type TireServiceType =
  | 'tire-replacement'
  | 'tire-installation'
  | 'flat-tire-repair'
  | 'tire-patching'
  | 'tire-rotation'
  | 'wheel-balancing'
  | 'wheel-alignment'
  | 'tpms-service'
  | 'tpms-sensor-replacement'
  | 'tire-inspection'
  | 'tread-depth-check'
  | 'tire-mounting'
  | 'tire-demounting'
  | 'valve-stem-replacement'
  | 'tire-plug-repair'
  | 'run-flat-service'
  | 'seasonal-changeover'
  | 'tire-storage'
  | 'used-tire-sales'
  | 'tire-disposal-recycling'
  | 'road-hazard-warranty'
  | 'tire-roadside-assistance'
  | 'custom-wheel-installation'
  | 'rim-repair'
  | 'preventive-tire-maintenance';

export interface ShopProfile {
  id: string;
  shopName: string;
  ownerName: string;
  email: string;
  phone: string;
  
  // Shop Type
  shopType: ShopType;
  serviceLocation: ServiceLocation;
  
  // Services Offered
  dieselServices?: DieselServiceType[];
  gasServices?: GasServiceType[];
  smallEngineServices?: SmallEngineServiceType[];
  heavyEquipmentServices?: HeavyEquipmentServiceType[];
  resurfacingServices?: ResurfacingServiceType[];
  weldingServices?: WeldingServiceType[];
  tireServices?: TireServiceType[];
  
  // Location
  address: string;
  city: string;
  state: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;
  
  // Business Details
  businessLicense?: string;
  insuranceCertificate?: string;
  taxId?: string;
  
  // Hours of Operation
  hours?: {
    monday?: { open: string; close: string; closed?: boolean };
    tuesday?: { open: string; close: string; closed?: boolean };
    wednesday?: { open: string; close: string; closed?: boolean };
    thursday?: { open: string; close: string; closed?: boolean };
    friday?: { open: string; close: string; closed?: boolean };
    saturday?: { open: string; close: string; closed?: boolean };
    sunday?: { open: string; close: string; closed?: boolean };
  };
  
  // Additional Info
  mobileServiceRadius?: number; // miles
  emergencyService24_7?: boolean;
  acceptedPaymentMethods?: ('cash' | 'credit-card' | 'debit-card' | 'check' | 'financing')[];
  
  // Status
  verified: boolean;
  active: boolean;
  profileComplete: boolean; // Tracks if shop has completed onboarding (business license, insurance, services)
  createdAt: string;
  updatedAt: string;
}

export interface ShopFormData {
  shopName: string;
  ownerName: string;
  email: string;
  phone: string;
  shopType: ShopType;
  serviceLocation: ServiceLocation;
  dieselServices: DieselServiceType[];
  gasServices: GasServiceType[];
  smallEngineServices: SmallEngineServiceType[];
  heavyEquipmentServices: HeavyEquipmentServiceType[];
  resurfacingServices: ResurfacingServiceType[];
  weldingServices: WeldingServiceType[];
  tireServices: TireServiceType[];
  address: string;
  city: string;
  state: string;
  zipCode: string;
  username: string;
  password: string;
  businessLicense?: string;
  insuranceCertificate?: string;
  taxId?: string;
  mobileServiceRadius?: number;
  emergencyService24_7: boolean;
  acceptedPaymentMethods: ('cash' | 'credit-card' | 'debit-card' | 'check' | 'financing')[];
  couponCode?: string;
}
