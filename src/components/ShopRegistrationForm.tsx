'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import {
  ShopFormData,
  ShopType,
  ServiceLocation,
  DieselServiceType,
  GasServiceType,
  SmallEngineServiceType,
  HeavyEquipmentServiceType,
   ResurfacingServiceType,
  WeldingServiceType,
  TireServiceType,
} from '../types/shop';
import '../styles/sos-theme.css';
import { FaArrowLeft, FaArrowRight, FaSmile } from 'react-icons/fa';

const MAX_SERVICES = 5;

const dieselServiceOptions: { value: DieselServiceType; label: string }[] = [
  { value: 'engine-diagnostics', label: 'Engine Diagnostics' },
  { value: 'engine-repair', label: 'Engine Repair' },
  { value: 'engine-rebuild', label: 'Engine Rebuild' },
  { value: 'transmission-repair', label: 'Transmission Repair' },
  { value: 'brake-system', label: 'Brake System' },
  { value: 'air-brake-service', label: 'Air Brake Service' },
  { value: 'electrical-diagnostics', label: 'Electrical Diagnostics' },
  { value: 'electrical-repair', label: 'Electrical Repair' },
  { value: 'tire-service', label: 'Tire Service' },
  { value: 'tire-replacement', label: 'Tire Replacement' },
  { value: 'wheel-alignment', label: 'Wheel Alignment' },
  { value: 'suspension-repair', label: 'Suspension Repair' },
  { value: 'hydraulic-systems', label: 'Hydraulic Systems' },
  { value: 'air-conditioning', label: 'Air Conditioning' },
  { value: 'exhaust-repair', label: 'Exhaust Repair' },
  { value: 'def-system', label: 'DEF System' },
  { value: 'dpf-cleaning', label: 'DPF Cleaning' },
  { value: 'oil-change', label: 'Oil Change' },
  { value: 'preventive-maintenance', label: 'Preventive Maintenance' },
  { value: 'dot-inspections', label: 'DOT Inspections' },
  { value: 'trailer-repair', label: 'Trailer Repair' },
  { value: 'reefer-repair', label: 'Reefer Repair' },
  { value: 'welding', label: 'Welding' },
  { value: 'roadside-assistance', label: 'Roadside Assistance' },
];

const gasServiceOptions: { value: GasServiceType; label: string }[] = [
  { value: 'engine-diagnostics', label: 'Engine Diagnostics' },
  { value: 'engine-repair', label: 'Engine Repair' },
  { value: 'transmission-service', label: 'Transmission Service' },
  { value: 'transmission-repair', label: 'Transmission Repair' },
  { value: 'brake-service', label: 'Brake Service' },
  { value: 'brake-replacement', label: 'Brake Replacement' },
  { value: 'oil-change', label: 'Oil Change' },
  { value: 'tune-up', label: 'Tune-Up' },
  { value: 'electrical-diagnostics', label: 'Electrical Diagnostics' },
  { value: 'electrical-repair', label: 'Electrical Repair' },
  { value: 'battery-service', label: 'Battery Service' },
  { value: 'tire-rotation', label: 'Tire Rotation' },
  { value: 'tire-replacement', label: 'Tire Replacement' },
  { value: 'wheel-alignment', label: 'Wheel Alignment' },
  { value: 'suspension-repair', label: 'Suspension Repair' },
  { value: 'air-conditioning', label: 'Air Conditioning' },
  { value: 'heating-repair', label: 'Heating Repair' },
  { value: 'exhaust-repair', label: 'Exhaust Repair' },
  { value: 'catalytic-converter', label: 'Catalytic Converter' },
  { value: 'emissions-testing', label: 'Emissions Testing' },
  { value: 'state-inspection', label: 'State Inspection' },
  { value: 'windshield-replacement', label: 'Windshield Replacement' },
  { value: 'fluid-service', label: 'Fluid Service' },
  { value: 'coolant-flush', label: 'Coolant Flush' },
  { value: 'fuel-system-cleaning', label: 'Fuel System Cleaning' },
  { value: 'timing-belt', label: 'Timing Belt Replacement' },
  { value: 'roadside-assistance', label: 'Roadside Assistance' },
];

const smallEngineServiceOptions: { value: SmallEngineServiceType; label: string }[] = [
  { value: 'engine-diagnostics', label: 'Engine Diagnostics' },
  { value: 'carburetor-cleaning-rebuild', label: 'Carburetor Cleaning & Rebuild' },
  { value: 'fuel-system-repair', label: 'Fuel System Repair' },
  { value: 'ignition-system-repair', label: 'Ignition System Repair' },
  { value: 'spark-plug-replacement', label: 'Spark Plug Replacement' },
  { value: 'oil-change-filter', label: 'Oil Change & Filter Service' },
  { value: 'air-filter-service', label: 'Air Filter Cleaning/Replacement' },
  { value: 'tune-up', label: 'Tune-Up' },
  { value: 'blade-sharpening', label: 'Blade Sharpening' },
  { value: 'belt-replacement', label: 'Belt Replacement' },
  { value: 'starter-repair', label: 'Starter Repair' },
  { value: 'recoil-starter-repair', label: 'Recoil Starter Repair' },
  { value: 'compression-testing', label: 'Compression Testing' },
  { value: 'two-stroke-service', label: 'Two-Stroke / Four-Stroke Service' },
  { value: 'chain-sharpening', label: 'Chain Sharpening (Chainsaws)' },
  { value: 'string-trimmer-repair', label: 'String Trimmer Repair' },
  { value: 'blower-repair', label: 'Blower Repair' },
  { value: 'generator-service', label: 'Generator Service' },
  { value: 'pressure-washer-repair', label: 'Pressure Washer Repair' },
  { value: 'preventive-maintenance', label: 'Preventive Maintenance' },
  { value: 'parts-replacement', label: 'Parts Replacement' },
  { value: 'winterization', label: 'Winterization / Storage Prep' },
];

const heavyEquipmentServiceOptions: { value: HeavyEquipmentServiceType; label: string }[] = [
  { value: 'hydraulic-system-diagnostics', label: 'Hydraulic System Diagnostics & Repair' },
  { value: 'hydraulic-cylinder-rebuild', label: 'Hydraulic Cylinder Rebuild' },
  { value: 'undercarriage-repair', label: 'Undercarriage Inspection & Repair' },
  { value: 'track-chain-replacement', label: 'Track / Chain Replacement' },
  { value: 'sprocket-roller-replacement', label: 'Sprocket & Roller Replacement' },
  { value: 'final-drive-repair', label: 'Final Drive Repair' },
  { value: 'engine-diagnostics-repair', label: 'Engine Diagnostics & Repair' },
  { value: 'transmission-service-repair', label: 'Transmission Service & Repair' },
  { value: 'boom-arm-repair', label: 'Boom & Arm Repair' },
  { value: 'bucket-blade-repair', label: 'Bucket / Blade Repair' },
  { value: 'pin-bushing-replacement', label: 'Pin & Bushing Replacement' },
  { value: 'electrical-system-repair', label: 'Electrical System Repair' },
  { value: 'brake-system-service', label: 'Brake System Service' },
  { value: 'cooling-system-repair', label: 'Cooling System Flush & Repair' },
  { value: 'preventive-maintenance-heavy', label: 'Preventive Maintenance' },
  { value: 'field-service-onsite', label: 'Field Service / On-Site Repair' },
  { value: 'welding-fabrication-repair', label: 'Welding & Fabrication Repair' },
  { value: 'pump-repair', label: 'Pump Repair' },
  { value: 'valve-adjustment', label: 'Valve Adjustment' },
  { value: 'heavy-equipment-inspections', label: 'Heavy Equipment Inspections' },
];

const resurfacingServiceOptions: { value: ResurfacingServiceType; label: string }[] = [
  { value: 'cylinder-head-resurfacing', label: 'Cylinder Head Resurfacing' },
  { value: 'engine-block-resurfacing', label: 'Engine Block Resurfacing' },
  { value: 'flywheel-resurfacing', label: 'Flywheel Resurfacing' },
  { value: 'brake-rotor-resurfacing', label: 'Brake Rotor Resurfacing' },
  { value: 'surface-grinding', label: 'Surface Grinding' },
  { value: 'milling-machining', label: 'Milling & Machining' },
  { value: 'line-boring', label: 'Line Boring' },
  { value: 'valve-seat-cutting', label: 'Valve Seat Cutting' },
  { value: 'crankshaft-grinding', label: 'Crankshaft Grinding' },
  { value: 'align-boring', label: 'Align Boring' },
  { value: 'sleeving-boring-cylinders', label: 'Sleeving / Boring Engine Cylinders' },
  { value: 'precision-measurement', label: 'Precision Measurement & Inspection' },
  { value: 'custom-machining', label: 'Custom Machining' },
  { value: 'head-gasket-prep', label: 'Head Gasket Surface Prep' },
  { value: 'deck-surfacing', label: 'Deck Surfacing' },
];

const weldingServiceOptions: { value: WeldingServiceType; label: string }[] = [
  { value: 'mig-welding', label: 'MIG Welding' },
  { value: 'tig-welding', label: 'TIG Welding' },
  { value: 'stick-welding', label: 'Stick Welding' },
  { value: 'aluminum-welding', label: 'Aluminum Welding' },
  { value: 'stainless-welding', label: 'Stainless Steel Welding' },
  { value: 'cast-iron-repair-welding', label: 'Cast Iron Repair Welding' },
  { value: 'structural-welding', label: 'Structural Welding' },
  { value: 'custom-fabrication', label: 'Custom Fabrication' },
  { value: 'weld-repairs', label: 'Weld Repairs' },
  { value: 'hardfacing', label: 'Hardfacing / Wear Resistant Overlay' },
  { value: 'mobile-onsite-welding', label: 'Mobile / On-Site Welding' },
  { value: 'pipe-welding', label: 'Pipe Welding' },
  { value: 'trailer-frame-repair', label: 'Trailer & Frame Repair' },
  { value: 'heavy-equipment-weld-repair', label: 'Heavy Equipment Weld Repair' },
  { value: 'metal-cutting-prep', label: 'Metal Cutting & Preparation' },
  { value: 'weld-inspection', label: 'Weld Inspection & Testing' },
];

const tireServiceOptions: { value: TireServiceType; label: string }[] = [
  { value: 'tire-replacement', label: 'Tire Replacement' },
  { value: 'tire-installation', label: 'Tire Installation' },
  { value: 'flat-tire-repair', label: 'Flat Tire Repair' },
  { value: 'tire-patching', label: 'Tire Patching' },
  { value: 'tire-rotation', label: 'Tire Rotation' },
  { value: 'wheel-balancing', label: 'Wheel Balancing' },
  { value: 'wheel-alignment', label: 'Wheel Alignment' },
  { value: 'tpms-service', label: 'TPMS Service' },
  { value: 'tpms-sensor-replacement', label: 'TPMS Sensor Replacement' },
  { value: 'tire-inspection', label: 'Tire Inspection' },
  { value: 'tread-depth-check', label: 'Tread Depth Check' },
  { value: 'tire-mounting', label: 'Tire Mounting' },
  { value: 'tire-demounting', label: 'Tire Demounting' },
  { value: 'valve-stem-replacement', label: 'Valve Stem Replacement' },
  { value: 'tire-plug-repair', label: 'Tire Plug Repair' },
  { value: 'run-flat-service', label: 'Run-Flat Tire Service' },
  { value: 'seasonal-changeover', label: 'Seasonal Tire Changeover (Winter/Summer)' },
  { value: 'tire-storage', label: 'Tire Storage' },
  { value: 'used-tire-sales', label: 'Used Tire Sales' },
  { value: 'tire-disposal-recycling', label: 'Tire Disposal / Recycling' },
  { value: 'road-hazard-warranty', label: 'Road Hazard Warranty' },
  { value: 'tire-roadside-assistance', label: 'Tire Roadside Assistance' },
  { value: 'custom-wheel-installation', label: 'Custom Wheel Installation' },
  { value: 'rim-repair', label: 'Rim Repair' },
  { value: 'preventive-tire-maintenance', label: 'Preventive Tire Maintenance' },
];

export default function ShopRegistrationForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<ShopFormData>({
    shopName: '',
    ownerName: '',
    email: '',
    phone: '',
    username: '',
    password: '',
    shopType: 'diesel',
    serviceLocation: 'both',
    dieselServices: [],
    gasServices: [],
    smallEngineServices: [],
    heavyEquipmentServices: [],
    resurfacingServices: [],
    weldingServices: [],
    tireServices: [],
    address: '',
    city: '',
    state: '',
    zipCode: '',
    mobileServiceRadius: 50,
    emergencyService24_7: false,
    acceptedPaymentMethods: ['cash', 'credit-card'],
    couponCode: '',
  });

  const totalSelectedServices =
    formData.dieselServices.length +
    formData.gasServices.length +
    formData.smallEngineServices.length +
    formData.heavyEquipmentServices.length +
    formData.resurfacingServices.length +
    formData.weldingServices.length +
    formData.tireServices.length;

  const handleServiceToggle = (
    service:
      | DieselServiceType
      | GasServiceType
      | SmallEngineServiceType
      | HeavyEquipmentServiceType
      | ResurfacingServiceType
      | WeldingServiceType
      | TireServiceType,
    category: 'diesel' | 'gas' | 'small-engine' | 'heavy-equipment' | 'resurfacing' | 'welding' | 'tire'
  ) => {
    const currentlySelected = (() => {
      switch (category) {
        case 'diesel':
          return formData.dieselServices.includes(service as DieselServiceType);
        case 'gas':
          return formData.gasServices.includes(service as GasServiceType);
        case 'small-engine':
          return formData.smallEngineServices.includes(service as SmallEngineServiceType);
        case 'heavy-equipment':
          return formData.heavyEquipmentServices.includes(service as HeavyEquipmentServiceType);
        case 'resurfacing':
          return formData.resurfacingServices.includes(service as ResurfacingServiceType);
        case 'welding':
          return formData.weldingServices.includes(service as WeldingServiceType);
        case 'tire':
          return formData.tireServices.includes(service as TireServiceType);
      }
    })();

    // Enforce max services when trying to add a new one
    if (!currentlySelected && totalSelectedServices >= MAX_SERVICES) {
      setError(`You can select up to ${MAX_SERVICES} services.`);
      return;
    }

    setFormData((prev: ShopFormData) => {
      switch (category) {
        case 'diesel':
          return {
            ...prev,
            dieselServices: currentlySelected
              ? prev.dieselServices.filter((s: DieselServiceType) => s !== service)
              : [...prev.dieselServices, service as DieselServiceType]
          };
        case 'gas':
          return {
            ...prev,
            gasServices: currentlySelected
              ? prev.gasServices.filter((s: GasServiceType) => s !== service)
              : [...prev.gasServices, service as GasServiceType]
          };
        case 'small-engine':
          return {
            ...prev,
            smallEngineServices: currentlySelected
              ? prev.smallEngineServices.filter((s: SmallEngineServiceType) => s !== service)
              : [...prev.smallEngineServices, service as SmallEngineServiceType]
          };
        case 'heavy-equipment':
          return {
            ...prev,
            heavyEquipmentServices: currentlySelected
              ? prev.heavyEquipmentServices.filter((s: HeavyEquipmentServiceType) => s !== service)
              : [...prev.heavyEquipmentServices, service as HeavyEquipmentServiceType]
          };
        case 'resurfacing':
          return {
            ...prev,
            resurfacingServices: currentlySelected
              ? prev.resurfacingServices.filter((s: ResurfacingServiceType) => s !== service)
              : [...prev.resurfacingServices, service as ResurfacingServiceType]
          };
        case 'welding':
          return {
            ...prev,
            weldingServices: currentlySelected
              ? prev.weldingServices.filter((s: WeldingServiceType) => s !== service)
              : [...prev.weldingServices, service as WeldingServiceType]
          };
        case 'tire':
          return {
            ...prev,
            tireServices: currentlySelected
              ? prev.tireServices.filter((s: TireServiceType) => s !== service)
              : [...prev.tireServices, service as TireServiceType]
          };
      }
    });

    // Clear any previous max selection message once toggle succeeds
    setError(null);
  };

  const handlePaymentMethodToggle = (method: 'cash' | 'credit-card' | 'debit-card' | 'check' | 'financing') => {
    setFormData((prev: ShopFormData) => ({
      ...prev,
      acceptedPaymentMethods: prev.acceptedPaymentMethods.includes(method)
        ? prev.acceptedPaymentMethods.filter((m: 'cash' | 'credit-card' | 'debit-card' | 'check' | 'financing') => m !== method)
        : [...prev.acceptedPaymentMethods, method]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (step < 5) {
      setStep(step + 1);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Obtain a public CSRF token (double-submit) and set cookie
      let csrf = '';
      try {
        const csrfRes = await fetch('/api/auth/csrf', { method: 'GET', credentials: 'include' });
        if (csrfRes.ok) {
          const csrfData = await csrfRes.json();
          csrf = csrfData.csrfToken || '';
        }
      } catch {
        // Fallback: try cookie
        const m = document.cookie.match("(?:^|; )csrf_token=([^;]+)");
        csrf = m ? decodeURIComponent(m[1]) : '';
      }
      if (!csrf) {
        setError('Security token missing. Please refresh the page and try again.');
        setLoading(false);
        return;
      }
      const res = await fetch('/api/shops/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.checkoutUrl) {
          // Redirect to hosted onboarding flow when enabled on the backend
          window.location.href = data.checkoutUrl;
        } else {
          // Fallback: Stripe wasn't configured  -  go to thank-you page
          router.push('/auth/thank-you' as Route);
        }
      } else {
        const errorData = await res.json();
        setError(errorData.error || 'Registration failed');
      }
    } catch {
      console.error('Shop registration failed:', error);
      setError('Network error or server issue');
    } finally {
      setLoading(false);
    }
  };

  const showDieselServices = true;
  const showGasServices = true;
  const canSelectMoreServices = totalSelectedServices < MAX_SERVICES;

  return (
    <div className="sos-wrap">
      <div className="sos-card" style={{maxWidth:800}}>
        <div className="sos-header">
          <div className="sos-brand">
            <span className="mark">FixTray</span>
            <span className="sub">Shop Registration</span>
          </div>
          <div style={{fontSize:13, color:'#9aa3b2'}}>Step {step} of 5</div>
        </div>

        {error && (
          <div style={{backgroundColor: '#fee', border: '1px solid #fcc', color: '#c33', padding: '12px', borderRadius: '4px', marginBottom: '16px'}}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="sos-pane" style={{padding:28}}>
            
            {/* Step 1: Basic Information */}
            {step === 1 && (
              <div>
                <div className="sos-title">Basic Information</div>
                <p className="sos-desc">Tell us about your shop</p>

                <div style={{marginTop:24, display:'flex', flexDirection:'column', gap:16}}>
                  <div>
                    <label className="sos-label">Shop Name *</label>
                    <input
                      className="sos-input"
                      value={formData.shopName}
                      onChange={e => setFormData({...formData, shopName: e.target.value})}
                      required
                    />
                  </div>

                  <div>
                    <label className="sos-label">Owner Name *</label>
                    <input
                      className="sos-input"
                      value={formData.ownerName}
                      onChange={e => setFormData({...formData, ownerName: e.target.value})}
                      required
                    />
                  </div>

                  <div>
                    <label className="sos-label">Email *</label>
                    <input
                      type="email"
                      className="sos-input"
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      required
                    />
                  </div>

                  <div>
                    <label className="sos-label">Phone *</label>
                    <input
                      type="tel"
                      className="sos-input"
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Shop Type & Service Location */}
            {step === 2 && (
              <div>
                <div className="sos-title">Shop Type & Services</div>
                <p className="sos-desc">Select your primary shop category</p>

                <div style={{marginTop:24}}>
                  <label className="sos-label">Shop Type *</label>
                  <div style={{display:'flex', flexDirection:'column', gap:12, marginTop:8}}>
                    {[
                      { value: 'diesel', label: 'Diesel / Heavy-Duty Services' },
                      { value: 'gas', label: 'Gas / Automotive Services' },
                      { value: 'small-engine', label: 'Small Engine Services' },
                      { value: 'heavy-equipment', label: 'Heavy Equipment Services' },
                      { value: 'resurfacing', label: 'Resurfacing / Machining' },
                      { value: 'welding', label: 'Welding & Fabrication' },
                      { value: 'tire', label: 'Tire Shop Services' },
                      { value: 'mixed', label: 'Mixed / Multi-Category' },
                    ].map(option => (
                      <label key={option.value} className="sos-item" style={{cursor:'pointer', padding:16}}>
                        <input
                          type="radio"
                          checked={formData.shopType === option.value}
                          onChange={() => setFormData({...formData, shopType: option.value as ShopType})}
                        />
                        <span style={{marginLeft:12, fontSize:14}}>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{marginTop:24}}>
                  <label className="sos-label">Service Location *</label>
                  <div style={{display:'flex', flexDirection:'column', gap:12, marginTop:8}}>
                    {[
                      { value: 'mobile-only', label: 'Mobile/Roadside Only' },
                      { value: 'shop-only', label: 'Shop Location Only' },
                      { value: 'both', label: 'Both Mobile & Shop' },
                    ].map(option => (
                      <label key={option.value} className="sos-item" style={{cursor:'pointer', padding:16}}>
                        <input
                          type="radio"
                          checked={formData.serviceLocation === option.value}
                          onChange={() => setFormData({...formData, serviceLocation: option.value as ServiceLocation})}
                        />
                        <span style={{marginLeft:12, fontSize:14}}>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {formData.serviceLocation !== 'shop-only' && (
                  <div style={{marginTop:24}}>
                    <label className="sos-label">Mobile Service Radius (miles)</label>
                    <input
                      type="number"
                      className="sos-input"
                      value={formData.mobileServiceRadius || ''}
                      onChange={e => setFormData({...formData, mobileServiceRadius: parseInt(e.target.value) || 0})}
                      placeholder="50"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Services Offered */}
            {step === 3 && (
              <div>
                <div className="sos-title">Services You Offer</div>
                <p className="sos-desc">Select up to {MAX_SERVICES} services across all categories ({totalSelectedServices} selected)</p>

                {showDieselServices && (
                  <div style={{marginTop:24}}>
                    <div style={{fontSize:16, fontWeight:700, marginBottom:12}}>Diesel / Heavy-Duty Services</div>
                    <div style={{display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:8}}>
                      {dieselServiceOptions.map(service => (
                        <label key={service.value} className="sos-item" style={{cursor:'pointer', padding:12}}>
                          <input
                            type="checkbox"
                            checked={formData.dieselServices.includes(service.value)}
                            onChange={() => handleServiceToggle(service.value, 'diesel')}
                            disabled={!formData.dieselServices.includes(service.value) && !canSelectMoreServices}
                          />
                          <span style={{marginLeft:8, fontSize:13}}>{service.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {showGasServices && (
                  <div style={{marginTop:32}}>
                    <div style={{fontSize:16, fontWeight:700, marginBottom:12}}>Gas / Automotive Services</div>
                    <div style={{display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:8}}>
                      {gasServiceOptions.map(service => (
                        <label key={service.value} className="sos-item" style={{cursor:'pointer', padding:12}}>
                          <input
                            type="checkbox"
                            checked={formData.gasServices.includes(service.value)}
                            onChange={() => handleServiceToggle(service.value, 'gas')}
                            disabled={!formData.gasServices.includes(service.value) && !canSelectMoreServices}
                          />
                          <span style={{marginLeft:8, fontSize:13}}>{service.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{marginTop:32}}>
                  <div style={{fontSize:16, fontWeight:700, marginBottom:12}}>Small Engine Services</div>
                  <div style={{display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:8}}>
                    {smallEngineServiceOptions.map(service => (
                      <label key={service.value} className="sos-item" style={{cursor:'pointer', padding:12}}>
                        <input
                          type="checkbox"
                          checked={formData.smallEngineServices.includes(service.value)}
                          onChange={() => handleServiceToggle(service.value, 'small-engine')}
                          disabled={!formData.smallEngineServices.includes(service.value) && !canSelectMoreServices}
                        />
                        <span style={{marginLeft:8, fontSize:13}}>{service.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{marginTop:32}}>
                  <div style={{fontSize:16, fontWeight:700, marginBottom:12}}>Heavy Equipment Services</div>
                  <div style={{display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:8}}>
                    {heavyEquipmentServiceOptions.map(service => (
                      <label key={service.value} className="sos-item" style={{cursor:'pointer', padding:12}}>
                        <input
                          type="checkbox"
                          checked={formData.heavyEquipmentServices.includes(service.value)}
                          onChange={() => handleServiceToggle(service.value, 'heavy-equipment')}
                          disabled={!formData.heavyEquipmentServices.includes(service.value) && !canSelectMoreServices}
                        />
                        <span style={{marginLeft:8, fontSize:13}}>{service.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{marginTop:32}}>
                  <div style={{fontSize:16, fontWeight:700, marginBottom:12}}>Resurfacing / Machining Services</div>
                  <div style={{display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:8}}>
                    {resurfacingServiceOptions.map(service => (
                      <label key={service.value} className="sos-item" style={{cursor:'pointer', padding:12}}>
                        <input
                          type="checkbox"
                          checked={formData.resurfacingServices.includes(service.value)}
                          onChange={() => handleServiceToggle(service.value, 'resurfacing')}
                          disabled={!formData.resurfacingServices.includes(service.value) && !canSelectMoreServices}
                        />
                        <span style={{marginLeft:8, fontSize:13}}>{service.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{marginTop:32}}>
                  <div style={{fontSize:16, fontWeight:700, marginBottom:12}}>Welding & Fabrication Services</div>
                  <div style={{display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:8}}>
                    {weldingServiceOptions.map(service => (
                      <label key={service.value} className="sos-item" style={{cursor:'pointer', padding:12}}>
                        <input
                          type="checkbox"
                          checked={formData.weldingServices.includes(service.value)}
                          onChange={() => handleServiceToggle(service.value, 'welding')}
                          disabled={!formData.weldingServices.includes(service.value) && !canSelectMoreServices}
                        />
                        <span style={{marginLeft:8, fontSize:13}}>{service.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{marginTop:32}}>
                  <div style={{fontSize:16, fontWeight:700, marginBottom:12}}>Tire Shop Services</div>
                  <div style={{display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:8}}>
                    {tireServiceOptions.map(service => (
                      <label key={service.value} className="sos-item" style={{cursor:'pointer', padding:12}}>
                        <input
                          type="checkbox"
                          checked={formData.tireServices.includes(service.value)}
                          onChange={() => handleServiceToggle(service.value, 'tire')}
                          disabled={!formData.tireServices.includes(service.value) && !canSelectMoreServices}
                        />
                        <span style={{marginLeft:8, fontSize:13}}>{service.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Location & Additional Info */}
            {step === 4 && (
              <div>
                <div className="sos-title">Location & Business Details</div>
                <p className="sos-desc">Where is your shop located?</p>

                <div style={{marginTop:24, display:'flex', flexDirection:'column', gap:16}}>
                  <div>
                    <label className="sos-label">Street Address *</label>
                    <input
                      className="sos-input"
                      value={formData.address}
                      onChange={e => setFormData({...formData, address: e.target.value})}
                      required
                    />
                  </div>

                  <div style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:12}}>
                    <div>
                      <label className="sos-label">City *</label>
                      <input
                        className="sos-input"
                        value={formData.city}
                        onChange={e => setFormData({...formData, city: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <label className="sos-label">State *</label>
                      <input
                        className="sos-input"
                        value={formData.state}
                        onChange={e => setFormData({...formData, state: e.target.value})}
                        required
                        maxLength={2}
                      />
                    </div>
                    <div>
                      <label className="sos-label">Zip *</label>
                      <input
                        className="sos-input"
                        value={formData.zipCode}
                        onChange={e => setFormData({...formData, zipCode: e.target.value})}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="sos-label">Accepted Payment Methods</label>
                    <div style={{display:'flex', gap:12, marginTop:8, flexWrap:'wrap'}}>
                      {['cash', 'credit-card', 'debit-card', 'check', 'financing'].map(method => (
                        <label key={method} style={{cursor:'pointer', display:'flex', alignItems:'center'}}>
                          <input
                            type="checkbox"
                            checked={formData.acceptedPaymentMethods.includes(method as any)}
                            onChange={() => handlePaymentMethodToggle(method as any)}
                          />
                          <span style={{marginLeft:8, fontSize:13, textTransform:'capitalize'}}>
                            {method.replace('-', ' ')}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <label style={{cursor:'pointer', display:'flex', alignItems:'center'}}>
                    <input
                      type="checkbox"
                      checked={formData.emergencyService24_7}
                      onChange={e => setFormData({...formData, emergencyService24_7: e.target.checked})}
                    />
                    <span style={{marginLeft:8, fontSize:14}}>We offer 24/7 emergency service</span>
                  </label>
                </div>
              </div>
            )}

            {/* Step 5: Final Review */}
            {step === 5 && (
              <div>
                <div className="sos-title">Final Review</div>
                <p className="sos-desc">Review your setup details before completing registration.</p>

                <div style={{marginTop:24}}>
                  <div style={{padding:16, backgroundColor:'rgba(255,255,255,0.04)', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)'}}>
                    <div style={{fontSize:14, color:'#f1f5f9', fontWeight:600, marginBottom:8}}>Registration Summary</div>
                    <div style={{fontSize:13, color:'#94a3b8', lineHeight:1.7}}>
                      <div><strong>Shop:</strong> {formData.shopName || 'Not provided'}</div>
                      <div><strong>Owner:</strong> {formData.ownerName || 'Not provided'}</div>
                      <div><strong>Primary contact:</strong> {formData.email || 'Not provided'}</div>
                      <div><strong>Location:</strong> {[formData.city, formData.state].filter(Boolean).join(', ') || 'Not provided'}</div>
                      <div><strong>Selected services:</strong> {totalSelectedServices}</div>
                    </div>
                  </div>
                </div>

                <div style={{marginTop:16, padding:16, backgroundColor:'rgba(255,255,255,0.04)', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)'}}>
                  <div style={{fontSize:14, fontWeight:600, color:'#f1f5f9', marginBottom:8}}><FaSmile style={{marginRight:4}} /> Ready to Launch</div>
                  <div style={{fontSize:13, color:'#94a3b8'}}>
                    Complete registration to activate your shop workspace and finish onboarding in the dashboard.
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="sos-footer">
            <div style={{display:'flex', gap:12}}>
              {step > 1 && (
                <button type="button" onClick={() => setStep(step - 1)} className="btn-outline">
                  <FaArrowLeft style={{marginRight:4}} /> Back
                </button>
              )}
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Submitting...' : step === 5 ? 'Complete Registration' : <><FaArrowRight style={{marginRight:4}} /> Next</>}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
